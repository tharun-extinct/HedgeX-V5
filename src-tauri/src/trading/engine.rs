use crate::error::{HedgeXError, Result};
use crate::models::trading::{
    Trade, TradeStatus, TradeType, Position, OrderRequest, OrderResponse, OrderType,
    MarketData, TradingSignal, SignalType, PerformanceMetrics
};
use crate::models::kite::{
    KiteOrderRequest, KiteOrderResponse, KiteTransactionType, KiteOrderType,
    KiteProduct, KiteValidity, KiteOrderVariety, KiteExchange
};
use crate::services::enhanced_database_service::EnhancedDatabaseService;
use crate::services::kite_service::KiteService;
use crate::trading::risk_manager::RiskManager;
use crate::trading::strategy_manager::StrategyManager;
use rust_decimal::{Decimal, prelude::ToPrimitive};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{RwLock, Mutex, mpsc};
use tokio::time::{sleep, timeout};
use tracing::{debug, error, info, warn, instrument};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use sqlx::Row;

/// The core high-frequency trading engine
pub struct TradingEngine {
    /// Database service for persistence
    db_service: Arc<EnhancedDatabaseService>,
    
    /// Kite API service for order execution
    kite_service: Arc<KiteService>,
    
    /// Risk manager for trade validation
    risk_manager: Arc<RiskManager>,
    
    /// Strategy manager for signal generation
    strategy_manager: Arc<StrategyManager>,
    
    /// Active trades by ID
    active_trades: Arc<RwLock<HashMap<String, Trade>>>,
    
    /// Order execution queue
    order_queue: Arc<Mutex<mpsc::UnboundedSender<OrderRequest>>>,
    
    /// Market data cache
    market_data_cache: Arc<RwLock<HashMap<String, MarketData>>>,
    
    /// Trading state
    is_running: Arc<RwLock<bool>>,
    
    /// Performance metrics
    performance_metrics: Arc<RwLock<PerformanceMetrics>>,
    
    /// User ID
    user_id: String,
    
    /// Last execution time for latency tracking
    last_execution_time: Arc<Mutex<Option<Instant>>>,
}

impl TradingEngine {
    /// Create a new trading engine
    pub async fn new(
        db_service: Arc<EnhancedDatabaseService>,
        kite_service: Arc<KiteService>,
        user_id: &str,
    ) -> Result<Self> {
        // Initialize risk manager
        let risk_manager = Arc::new(RiskManager::new(db_service.clone(), user_id).await?);
        
        // Initialize strategy manager
        let strategy_manager = Arc::new(StrategyManager::new(db_service.clone(), user_id).await?);
        
        // Create order execution channel
        let (order_sender, order_receiver) = mpsc::unbounded_channel();
        
        let engine = Self {
            db_service,
            kite_service,
            risk_manager,
            strategy_manager,
            active_trades: Arc::new(RwLock::new(HashMap::new())),
            order_queue: Arc::new(Mutex::new(order_sender)),
            market_data_cache: Arc::new(RwLock::new(HashMap::new())),
            is_running: Arc::new(RwLock::new(false)),
            performance_metrics: Arc::new(RwLock::new(PerformanceMetrics::new(user_id))),
            user_id: user_id.to_string(),
            last_execution_time: Arc::new(Mutex::new(None)),
        };
        
        // Start order processing task
        engine.start_order_processor(order_receiver).await;
        
        // Load existing active trades
        engine.load_active_trades().await?;
        
        info!("Trading engine initialized for user: {}", user_id);
        Ok(engine)
    }
    
    /// Load active trades from database
    async fn load_active_trades(&self) -> Result<()> {
        let query = "
            SELECT id, user_id, symbol, exchange, order_id, trade_type, quantity, 
                   price, status, executed_at, strategy_id, created_at, updated_at
            FROM trades 
            WHERE user_id = ? AND status IN ('Pending', 'PartiallyFilled')
        ";
        
        let rows = sqlx::query(query)
            .bind(&self.user_id)
            .fetch_all(self.db_service.get_database().get_pool())
            .await?;
            
        let mut active_trades = self.active_trades.write().await;
        
        for row in rows {
            let trade_type_str: String = row.get("trade_type");
            let status_str: String = row.get("status");
            let price_f64: f64 = row.get("price");
            
            let trade_type = match trade_type_str.as_str() {
                "Buy" => TradeType::Buy,
                "Sell" => TradeType::Sell,
                _ => continue,
            };
            
            let status = match status_str.as_str() {
                "Pending" => TradeStatus::Pending,
                "PartiallyFilled" => TradeStatus::PartiallyFilled,
                _ => continue,
            };
            
            let mut trade = Trade {
                id: row.get("id"),
                user_id: row.get("user_id"),
                symbol: row.get("symbol"),
                exchange: row.get("exchange"),
                order_id: row.get("order_id"),
                trade_type,
                quantity: row.get("quantity"),
                price: Decimal::from_f64_retain(price_f64).unwrap_or(Decimal::ZERO),
                status,
                executed_at: row.get("executed_at"),
                strategy_id: row.get("strategy_id"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            };
            
            active_trades.insert(trade.id.clone(), trade);
        }
        
        info!("Loaded {} active trades", active_trades.len());
        Ok(())
    }
    
    /// Start the order processing task
    async fn start_order_processor(&self, mut order_receiver: mpsc::UnboundedReceiver<OrderRequest>) {
        let kite_service = Arc::clone(&self.kite_service);
        let db_service = Arc::clone(&self.db_service);
        let risk_manager = Arc::clone(&self.risk_manager);
        let active_trades = Arc::clone(&self.active_trades);
        let last_execution_time = Arc::clone(&self.last_execution_time);
        let user_id = self.user_id.clone();
        
        tokio::spawn(async move {
            while let Some(order_request) = order_receiver.recv().await {
                let start_time = Instant::now();
                
                // Process order with timeout for sub-100ms execution
                let result = timeout(
                    Duration::from_millis(50), // 50ms timeout for sub-100ms target
                    Self::process_order_internal(
                        &kite_service,
                        &db_service,
                        &risk_manager,
                        &active_trades,
                        order_request,
                        &user_id,
                    )
                ).await;
                
                let execution_time = start_time.elapsed();
                
                // Update last execution time
                {
                    let mut last_time = last_execution_time.lock().await;
                    *last_time = Some(start_time);
                }
                
                match result {
                    Ok(Ok(response)) => {
                        info!("Order processed successfully in {:?}: {}", 
                              execution_time, response.order_id);
                    },
                    Ok(Err(e)) => {
                        error!("Order processing failed in {:?}: {}", execution_time, e);
                    },
                    Err(_) => {
                        error!("Order processing timed out after {:?}", execution_time);
                    }
                }
                
                // Log execution time for performance monitoring
                if execution_time > Duration::from_millis(100) {
                    warn!("Order execution exceeded 100ms target: {:?}", execution_time);
                }
            }
        });
    }
    
    /// Internal order processing function
    async fn process_order_internal(
        kite_service: &Arc<KiteService>,
        db_service: &Arc<EnhancedDatabaseService>,
        risk_manager: &Arc<RiskManager>,
        active_trades: &Arc<RwLock<HashMap<String, Trade>>>,
        order_request: OrderRequest,
        user_id: &str,
    ) -> Result<OrderResponse> {
        // Validate order with risk manager
        if !risk_manager.validate_order(&order_request).await? {
            return Err(HedgeXError::TradingError("Order rejected by risk manager".to_string()));
        }
        
        // Create trade record
        let mut trade = Trade::new(
            &order_request.user_id,
            &order_request.symbol,
            &order_request.exchange,
            order_request.trade_type,
            order_request.quantity,
            order_request.price.unwrap_or(Decimal::ZERO),
            &order_request.strategy_id,
        );
        
        // Convert to Kite order request
        let kite_order = KiteOrderRequest {
            tradingsymbol: order_request.symbol.clone(),
            exchange: match order_request.exchange.as_str() {
                "NSE" => KiteExchange::NSE,
                "BSE" => KiteExchange::BSE,
                _ => KiteExchange::NSE,
            },
            transaction_type: match order_request.trade_type {
                TradeType::Buy => KiteTransactionType::Buy,
                TradeType::Sell => KiteTransactionType::Sell,
            },
            order_type: match order_request.order_type {
                OrderType::Market => KiteOrderType::Market,
                OrderType::Limit => KiteOrderType::Limit,
                OrderType::StopLoss => KiteOrderType::StopLoss,
                OrderType::StopLossMarket => KiteOrderType::StopLossMarket,
            },
            quantity: order_request.quantity as u32,
            price: order_request.price.map(|p| p.to_f64().unwrap_or(0.0)),
            product: KiteProduct::MIS, // Intraday for HFT
            validity: KiteValidity::Day,
            disclosed_quantity: None,
            trigger_price: None,
            squareoff: None,
            stoploss: None,
            trailing_stoploss: None,
            variety: KiteOrderVariety::Regular,
        };
        
        // Place order with Kite API
        let kite_response = kite_service.place_order(kite_order).await?;
        
        // Update trade with order ID
        trade.update_status(TradeStatus::Pending, Some(kite_response.order_id.clone()));
        
        // Store trade in database
        let query = "
            INSERT INTO trades (id, user_id, symbol, exchange, order_id, trade_type, 
                               quantity, price, status, executed_at, strategy_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ";
        
        sqlx::query(query)
            .bind(&trade.id)
            .bind(&trade.user_id)
            .bind(&trade.symbol)
            .bind(&trade.exchange)
            .bind(&trade.order_id)
            .bind(trade.trade_type.to_string())
            .bind(trade.quantity)
            .bind(trade.price.to_f64().unwrap_or(0.0))
            .bind(trade.status.to_string())
            .bind(trade.executed_at)
            .bind(&trade.strategy_id)
            .bind(trade.created_at)
            .bind(trade.updated_at)
            .execute(db_service.get_database().get_pool())
            .await?;
            
        // Add to active trades
        {
            let mut trades = active_trades.write().await;
            trades.insert(trade.id.clone(), trade);
        }
        
        // Update risk manager with new trade
        risk_manager.update_position(&trade).await?;
        
        Ok(OrderResponse {
            order_id: kite_response.order_id,
            status: "Pending".to_string(),
            message: Some("Order placed successfully".to_string()),
        })
    }
    
    /// Start the trading engine
    #[instrument(skip(self))]
    pub async fn start_trading(&self) -> Result<()> {
        let mut is_running = self.is_running.write().await;
        
        if *is_running {
            return Err(HedgeXError::TradingError("Trading engine is already running".to_string()));
        }
        
        // Check if emergency stop is active
        if self.risk_manager.is_emergency_stop_active().await {
            return Err(HedgeXError::TradingError("Cannot start trading: Emergency stop is active".to_string()));
        }
        
        *is_running = true;
        
        info!("Trading engine started for user: {}", self.user_id);
        
        // Start monitoring tasks
        self.start_position_monitoring().await;
        self.start_order_status_monitoring().await;
        
        Ok(())
    }
    
    /// Stop the trading engine
    #[instrument(skip(self))]
    pub async fn stop_trading(&self) -> Result<()> {
        let mut is_running = self.is_running.write().await;
        
        if !*is_running {
            return Ok(());
        }
        
        *is_running = false;
        
        info!("Trading engine stopped for user: {}", self.user_id);
        Ok(())
    }
    
    /// Emergency stop - halt all trading immediately
    #[instrument(skip(self))]
    pub async fn emergency_stop(&self) -> Result<()> {
        // Stop trading engine
        {
            let mut is_running = self.is_running.write().await;
            *is_running = false;
        }
        
        // Activate emergency stop in risk manager
        self.risk_manager.emergency_stop().await?;
        
        // Cancel all pending orders
        self.cancel_all_pending_orders().await?;
        
        error!("EMERGENCY STOP ACTIVATED - All trading halted for user: {}", self.user_id);
        Ok(())
    }
    
    /// Cancel all pending orders
    async fn cancel_all_pending_orders(&self) -> Result<()> {
        let active_trades = self.active_trades.read().await;
        
        for trade in active_trades.values() {
            if trade.status == TradeStatus::Pending {
                if let Some(order_id) = &trade.order_id {
                    match self.kite_service.cancel_order(order_id, KiteOrderVariety::Regular).await {
                        Ok(_) => {
                            info!("Cancelled order: {}", order_id);
                        },
                        Err(e) => {
                            warn!("Failed to cancel order {}: {}", order_id, e);
                        }
                    }
                }
            }
        }
        
        Ok(())
    }
    
    /// Process market data and generate trading signals
    #[instrument(skip(self, market_data))]
    pub async fn process_market_data(&self, market_data: MarketData) -> Result<()> {
        // Update market data cache
        {
            let mut cache = self.market_data_cache.write().await;
            cache.insert(market_data.symbol.clone(), market_data.clone());
        }
        
        // Update risk manager with current prices
        self.risk_manager.update_market_prices(&market_data.symbol, market_data.ltp).await?;
        
        // Check if trading is active
        if !*self.is_running.read().await {
            return Ok(());
        }
        
        // Generate signals for all enabled strategies
        let strategies = self.strategy_manager.get_enabled_strategies().await?;
        
        for strategy in strategies {
            if let Some(signal) = self.strategy_manager.generate_signal(&market_data, &strategy.id).await? {
                self.process_trading_signal(signal).await?;
            }
        }
        
        // Check stop loss and take profit conditions
        self.check_exit_conditions(&market_data.symbol).await?;
        
        Ok(())
    }
    
    /// Process a trading signal
    async fn process_trading_signal(&self, signal: TradingSignal) -> Result<()> {
        // Skip if signal strength is too low
        if signal.strength < 0.5 {
            debug!("Signal strength too low for {}: {:.2}", signal.symbol, signal.strength);
            return Ok(());
        }
        
        // Determine order parameters based on signal
        let (trade_type, quantity) = match signal.signal_type {
            SignalType::Buy => (TradeType::Buy, self.calculate_position_size(&signal).await?),
            SignalType::Sell => (TradeType::Sell, self.calculate_position_size(&signal).await?),
            SignalType::StopLoss | SignalType::TakeProfit => {
                // Handle exit signals
                return self.handle_exit_signal(&signal).await;
            },
            SignalType::Hold => return Ok(()),
        };
        
        if quantity <= 0 {
            debug!("Calculated quantity is zero for {}", signal.symbol);
            return Ok(());
        }
        
        // Create order request
        let order_request = OrderRequest {
            symbol: signal.symbol.clone(),
            exchange: "NSE".to_string(), // Default to NSE for NIFTY 50
            trade_type,
            quantity,
            price: Some(signal.price),
            order_type: OrderType::Limit,
            strategy_id: signal.strategy_id.clone(),
            user_id: self.user_id.clone(),
        };
        
        // Submit order to queue
        let order_queue = self.order_queue.lock().await;
        if let Err(e) = order_queue.send(order_request) {
            error!("Failed to queue order for {}: {}", signal.symbol, e);
        }
        
        Ok(())
    }
    
    /// Calculate position size based on signal and risk parameters
    async fn calculate_position_size(&self, signal: &TradingSignal) -> Result<i32> {
        let strategy = self.strategy_manager.get_strategy(&signal.strategy_id).await?
            .ok_or_else(|| HedgeXError::NotFoundError("Strategy not found".to_string()))?;
            
        // Simple position sizing based on risk percentage
        let account_value = Decimal::from(100000); // Assume 1 lakh account value
        let risk_amount = account_value * Decimal::from(strategy.risk_percentage / 100.0);
        
        let position_size = if signal.price > Decimal::ZERO {
            (risk_amount / signal.price).to_i32().unwrap_or(0)
        } else {
            0
        };
        
        // Ensure minimum and maximum position sizes
        let min_quantity = 1;
        let max_quantity = 1000; // Maximum 1000 shares per trade
        
        Ok(position_size.max(min_quantity).min(max_quantity))
    }
    
    /// Handle exit signals (stop loss, take profit)
    async fn handle_exit_signal(&self, signal: &TradingSignal) -> Result<()> {
        let positions = self.risk_manager.get_positions().await?;
        
        for position in positions {
            if position.symbol == signal.symbol {
                let exit_trade_type = match position.trade_type {
                    TradeType::Buy => TradeType::Sell,
                    TradeType::Sell => TradeType::Buy,
                };
                
                let order_request = OrderRequest {
                    symbol: signal.symbol.clone(),
                    exchange: position.exchange.clone(),
                    trade_type: exit_trade_type,
                    quantity: position.quantity,
                    price: Some(signal.price),
                    order_type: OrderType::Market, // Use market order for quick exit
                    strategy_id: signal.strategy_id.clone(),
                    user_id: self.user_id.clone(),
                };
                
                let order_queue = self.order_queue.lock().await;
                if let Err(e) = order_queue.send(order_request) {
                    error!("Failed to queue exit order for {}: {}", signal.symbol, e);
                }
                
                break;
            }
        }
        
        Ok(())
    }
    
    /// Check exit conditions for positions
    async fn check_exit_conditions(&self, symbol: &str) -> Result<()> {
        // Check stop loss
        if let Some(exit_type) = self.risk_manager.check_stop_loss(symbol).await? {
            let signal = TradingSignal {
                symbol: symbol.to_string(),
                signal_type: SignalType::StopLoss,
                strength: 1.0,
                price: self.get_current_price(symbol).await?,
                volume: 0,
                timestamp: Utc::now(),
                strategy_id: "risk_manager".to_string(),
            };
            
            self.handle_exit_signal(&signal).await?;
        }
        
        // Check take profit
        if let Some(exit_type) = self.risk_manager.check_take_profit(symbol).await? {
            let signal = TradingSignal {
                symbol: symbol.to_string(),
                signal_type: SignalType::TakeProfit,
                strength: 1.0,
                price: self.get_current_price(symbol).await?,
                volume: 0,
                timestamp: Utc::now(),
                strategy_id: "risk_manager".to_string(),
            };
            
            self.handle_exit_signal(&signal).await?;
        }
        
        Ok(())
    }
    
    /// Get current price from market data cache
    async fn get_current_price(&self, symbol: &str) -> Result<Decimal> {
        let cache = self.market_data_cache.read().await;
        
        match cache.get(symbol) {
            Some(data) => Ok(data.ltp),
            None => Err(HedgeXError::NotFoundError(format!("No market data for symbol: {}", symbol))),
        }
    }
    
    /// Start position monitoring task
    async fn start_position_monitoring(&self) {
        let risk_manager = Arc::clone(&self.risk_manager);
        let is_running = Arc::clone(&self.is_running);
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(1));
            
            loop {
                interval.tick().await;
                
                if !*is_running.read().await {
                    break;
                }
                
                // Monitor positions and update metrics
                if let Err(e) = risk_manager.get_daily_metrics().await {
                    error!("Failed to update daily metrics: {}", e);
                }
            }
        });
    }
    
    /// Start order status monitoring task
    async fn start_order_status_monitoring(&self) {
        let kite_service = Arc::clone(&self.kite_service);
        let active_trades = Arc::clone(&self.active_trades);
        let db_service = Arc::clone(&self.db_service);
        let is_running = Arc::clone(&self.is_running);
        
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(5));
            
            loop {
                interval.tick().await;
                
                if !*is_running.read().await {
                    break;
                }
                
                // Check order status updates
                if let Err(e) = Self::update_order_statuses(&kite_service, &active_trades, &db_service).await {
                    error!("Failed to update order statuses: {}", e);
                }
            }
        });
    }
    
    /// Update order statuses from Kite API
    async fn update_order_statuses(
        kite_service: &Arc<KiteService>,
        active_trades: &Arc<RwLock<HashMap<String, Trade>>>,
        db_service: &Arc<EnhancedDatabaseService>,
    ) -> Result<()> {
        let orders = kite_service.get_orders().await?;
        let mut trades_to_update = Vec::new();
        
        {
            let trades = active_trades.read().await;
            
            for trade in trades.values() {
                if let Some(order_id) = &trade.order_id {
                    if let Some(order) = orders.iter().find(|o| o.order_id == *order_id) {
                        let new_status = match order.status {
                            crate::models::kite::KiteOrderStatus::Complete => TradeStatus::Executed,
                            crate::models::kite::KiteOrderStatus::Cancelled => TradeStatus::Cancelled,
                            crate::models::kite::KiteOrderStatus::Rejected => TradeStatus::Failed,
                            _ => TradeStatus::Pending,
                        };
                        
                        if new_status != trade.status {
                            trades_to_update.push((trade.id.clone(), new_status));
                        }
                    }
                }
            }
        }
        
        // Update trades with new statuses
        for (trade_id, new_status) in trades_to_update {
            {
                let mut trades = active_trades.write().await;
                if let Some(trade) = trades.get_mut(&trade_id) {
                    trade.update_status(new_status, trade.order_id.clone());
                    
                    // Remove from active trades if completed
                    if new_status == TradeStatus::Executed || 
                       new_status == TradeStatus::Cancelled || 
                       new_status == TradeStatus::Failed {
                        trades.remove(&trade_id);
                    }
                }
            }
            
            // Update in database
            let query = "UPDATE trades SET status = ?, updated_at = ? WHERE id = ?";
            
            sqlx::query(query)
                .bind(new_status.to_string())
                .bind(Utc::now())
                .bind(&trade_id)
                .execute(db_service.get_database().get_pool())
                .await?;
        }
        
        Ok(())
    }
    
    /// Get current positions
    pub async fn get_positions(&self) -> Result<Vec<Position>> {
        self.risk_manager.get_positions().await
    }
    
    /// Get active trades
    pub async fn get_active_trades(&self) -> Result<Vec<Trade>> {
        let trades = self.active_trades.read().await;
        Ok(trades.values().cloned().collect())
    }
    
    /// Get performance metrics
    pub async fn get_performance_metrics(&self) -> Result<PerformanceMetrics> {
        self.risk_manager.get_daily_metrics().await
    }
    
    /// Check if trading is active
    pub async fn is_trading_active(&self) -> bool {
        *self.is_running.read().await
    }
    
    /// Get last execution time for latency monitoring
    pub async fn get_last_execution_time(&self) -> Option<Duration> {
        let last_time = self.last_execution_time.lock().await;
        last_time.map(|t| t.elapsed())
    }
    
    /// Clear emergency stop
    pub async fn clear_emergency_stop(&self) -> Result<()> {
        self.risk_manager.clear_emergency_stop().await
    }
    
    /// Check if emergency stop is active
    pub async fn is_emergency_stop_active(&self) -> bool {
        self.risk_manager.is_emergency_stop_active().await
    }
}
