use std::sync::Arc;
use sqlx::{Pool, Sqlite, Row};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use std::collections::HashMap;
use tracing::{info, warn, error, debug};

use crate::models::backtesting::{
    BacktestParams, BacktestResult, BacktestTrade, BacktestSummary, BacktestComparison,
    OHLCV, EquityPoint, HistoricalDataParams, HistoricalDataFetchParams,
    CsvImportConfig, CsvValidationResult, Timeframe, DataSource
};
use crate::models::trading::{StrategyParams, TradeType, SignalType, TradingSignal};
use crate::error::{HedgeXError, Result};
use crate::utils::csv_parser::CsvParser;
use crate::api::kite_historical::KiteHistoricalClient;
use crate::trading::strategy_manager::StrategyManager;

/// Backtesting engine for strategy simulation
pub struct BacktestEngine {
    db: Arc<Pool<Sqlite>>,
    strategy_manager: Arc<StrategyManager>,
    kite_client: Option<KiteHistoricalClient>,
}

/// Backtesting context for strategy execution
#[derive(Debug, Clone)]
struct BacktestContext {
    current_time: DateTime<Utc>,
    current_price: Decimal,
    current_volume: i64,
    portfolio_value: Decimal,
    cash_balance: Decimal,
    open_positions: HashMap<String, BacktestPosition>,
    historical_data: Vec<OHLCV>,
    data_index: usize,
}

/// Position tracking for backtesting
#[derive(Debug, Clone)]
struct BacktestPosition {
    symbol: String,
    trade_type: TradeType,
    quantity: i32,
    entry_price: Decimal,
    entry_time: DateTime<Utc>,
    current_price: Decimal,
    unrealized_pnl: Decimal,
}

impl BacktestEngine {
    /// Create new backtest engine
    pub fn new(db: Arc<Pool<Sqlite>>, strategy_manager: Arc<StrategyManager>) -> Self {
        Self {
            db,
            strategy_manager,
            kite_client: None,
        }
    }
    
    /// Set Kite API client for historical data fetching
    pub fn set_kite_client(&mut self, kite_client: KiteHistoricalClient) {
        self.kite_client = Some(kite_client);
    }
    
    /// Run backtest with given parameters
    pub async fn run_backtest(&self, params: BacktestParams) -> Result<BacktestResult> {
        info!("Starting backtest for strategy {} on symbol {}", params.strategy_id, params.symbol);
        
        // Get strategy parameters
        let strategy = self.get_strategy_params(&params.strategy_id).await?;
        
        // Load historical data
        let historical_data = self.load_historical_data(&params).await?;
        
        if historical_data.is_empty() {
            return Err(HedgeXError::ConfigError("No historical data available for backtesting".to_string()));
        }
        
        info!("Loaded {} historical data points for backtesting", historical_data.len());
        
        // Initialize backtest context
        let mut context = BacktestContext {
            current_time: params.start_date,
            current_price: historical_data[0].close,
            current_volume: historical_data[0].volume,
            portfolio_value: params.initial_capital,
            cash_balance: params.initial_capital,
            open_positions: HashMap::new(),
            historical_data: historical_data.clone(),
            data_index: 0,
        };
        
        let mut result = BacktestResult::new(params.clone());
        let mut trades = Vec::new();
        let mut equity_curve = Vec::new();
        
        // Add initial equity point
        equity_curve.push(EquityPoint::new(context.current_time, context.portfolio_value));
        
        // Run simulation through historical data
        while context.data_index < context.historical_data.len() {
            let current_candle = &context.historical_data[context.data_index];
            
            // Update context with current candle data
            context.current_time = current_candle.timestamp;
            context.current_price = current_candle.close;
            context.current_volume = current_candle.volume;
            
            // Update open positions with current price
            self.update_positions(&mut context, current_candle);
            
            // Generate trading signals using strategy
            let signals = self.generate_signals(&strategy, &context, current_candle, &params).await?;
            
            // Execute trades based on signals
            for signal in signals {
                if let Some(trade) = self.execute_signal(&mut context, &signal, current_candle, &strategy) {
                    trades.push(trade);
                }
            }
            
            // Check for position exits (stop loss, take profit, etc.)
            let exit_trades = self.check_position_exits(&mut context, &strategy, current_candle);
            trades.extend(exit_trades);
            
            // Update portfolio value
            context.portfolio_value = self.calculate_portfolio_value(&context);
            
            // Add equity point
            equity_curve.push(EquityPoint::new(context.current_time, context.portfolio_value));
            
            context.data_index += 1;
        }
        
        // Close any remaining open positions
        let final_trades = self.close_remaining_positions(&mut context);
        trades.extend(final_trades);
        
        // Update result with trades and equity curve
        result.trades = trades;
        result.equity_curve = equity_curve;
        
        // Calculate performance metrics
        result.calculate_metrics();
        
        // Store backtest result in database
        self.store_backtest_result(&result).await?;
        
        info!("Backtest completed: {} trades, final P&L: {}", result.total_trades, result.final_pnl);
        Ok(result)
    }
    
    /// Load historical data based on data source
    async fn load_historical_data(&self, params: &BacktestParams) -> Result<Vec<OHLCV>> {
        match &params.data_source {
            DataSource::CSVFile(file_path) => {
                info!("Loading historical data from CSV file: {}", file_path);
                let config = CsvImportConfig {
                    symbol: params.symbol.clone(),
                    exchange: params.exchange.clone(),
                    timeframe: params.timeframe,
                    has_header: true,
                    date_format: "%Y-%m-%d %H:%M:%S".to_string(),
                    timezone: "Asia/Kolkata".to_string(),
                };
                
                let parser = CsvParser::new(config);
                let mut data = parser.parse_csv(file_path)?;
                
                // Filter data by date range
                data.retain(|candle| {
                    candle.timestamp >= params.start_date && candle.timestamp <= params.end_date
                });
                
                Ok(data)
            }
            DataSource::KiteAPI => {
                info!("Loading historical data from Kite API");
                let kite_client = self.kite_client.as_ref()
                    .ok_or_else(|| HedgeXError::ConfigError("Kite client not configured".to_string()))?;
                
                let hist_params = HistoricalDataParams {
                    symbol: params.symbol.clone(),
                    exchange: params.exchange.clone(),
                    from_date: params.start_date,
                    to_date: params.end_date,
                    timeframe: params.timeframe,
                };
                
                kite_client.fetch_historical_data(&hist_params).await
            }
        }
    }
    
    /// Get strategy parameters from database
    async fn get_strategy_params(&self, strategy_id: &str) -> Result<StrategyParams> {
        let row = sqlx::query!(
            "SELECT * FROM strategy_params WHERE id = ?",
            strategy_id
        )
        .fetch_one(&*self.db)
        .await
        .map_err(|e| HedgeXError::DatabaseError(e))?;
        
        Ok(StrategyParams {
            id: row.id,
            user_id: row.user_id,
            name: row.name,
            description: row.description,
            enabled: row.enabled,
            max_trades_per_day: row.max_trades_per_day,
            risk_percentage: row.risk_percentage,
            stop_loss_percentage: row.stop_loss_percentage,
            take_profit_percentage: row.take_profit_percentage,
            volume_threshold: row.volume_threshold,
        })
    }
    
    /// Update open positions with current market data
    fn update_positions(&self, context: &mut BacktestContext, candle: &OHLCV) {
        for position in context.open_positions.values_mut() {
            position.current_price = candle.close;
            
            // Calculate unrealized P&L
            let price_diff = match position.trade_type {
                TradeType::Buy => candle.close - position.entry_price,
                TradeType::Sell => position.entry_price - candle.close,
            };
            position.unrealized_pnl = price_diff * Decimal::from(position.quantity);
        }
    }
    
    /// Generate trading signals using strategy
    async fn generate_signals(&self, strategy: &StrategyParams, context: &BacktestContext, candle: &OHLCV, params: &BacktestParams) -> Result<Vec<TradingSignal>> {
        // This is a simplified signal generation - in a real implementation,
        // you would use the strategy manager to generate signals based on
        // technical indicators, market conditions, etc.
        
        let mut signals = Vec::new();
        
        // Simple moving average crossover strategy example
        if context.data_index >= 20 {
            let sma_short = self.calculate_sma(&context.historical_data, context.data_index, 5);
            let sma_long = self.calculate_sma(&context.historical_data, context.data_index, 20);
            let prev_sma_short = self.calculate_sma(&context.historical_data, context.data_index - 1, 5);
            let prev_sma_long = self.calculate_sma(&context.historical_data, context.data_index - 1, 20);
            
            // Buy signal: short MA crosses above long MA
            if sma_short > sma_long && prev_sma_short <= prev_sma_long {
                if context.open_positions.is_empty() && candle.volume > strategy.volume_threshold {
                    signals.push(TradingSignal {
                        symbol: params.symbol.clone(),
                        signal_type: SignalType::Buy,
                        strength: 0.8,
                        price: candle.close,
                        volume: candle.volume,
                        timestamp: candle.timestamp,
                        strategy_id: strategy.id.clone(),
                    });
                }
            }
            
            // Sell signal: short MA crosses below long MA
            if sma_short < sma_long && prev_sma_short >= prev_sma_long {
                if !context.open_positions.is_empty() {
                    signals.push(TradingSignal {
                        symbol: params.symbol.clone(),
                        signal_type: SignalType::Sell,
                        strength: 0.8,
                        price: candle.close,
                        volume: candle.volume,
                        timestamp: candle.timestamp,
                        strategy_id: strategy.id.clone(),
                    });
                }
            }
        }
        
        Ok(signals)
    }
    
    /// Calculate simple moving average
    fn calculate_sma(&self, data: &[OHLCV], current_index: usize, period: usize) -> Decimal {
        if current_index < period - 1 {
            return Decimal::ZERO;
        }
        
        let start_index = current_index + 1 - period;
        let sum: Decimal = data[start_index..=current_index]
            .iter()
            .map(|candle| candle.close)
            .sum();
        
        sum / Decimal::from(period)
    }
    
    /// Calculate position size based on risk management
    fn calculate_position_size(&self, strategy: &StrategyParams, context: &BacktestContext, price: Decimal) -> i32 {
        let risk_amount = context.cash_balance * Decimal::from(strategy.risk_percentage) / Decimal::from(100);
        let position_value = risk_amount / Decimal::from(strategy.stop_loss_percentage) * Decimal::from(100);
        let quantity = position_value / price;
        
        // Ensure we don't exceed available cash
        let max_quantity = context.cash_balance / price;
        
        std::cmp::min(quantity.to_i32().unwrap_or(0), max_quantity.to_i32().unwrap_or(0))
    }
    
    /// Execute trading signal
    fn execute_signal(&self, context: &mut BacktestContext, signal: &TradingSignal, candle: &OHLCV, strategy: &StrategyParams) -> Option<BacktestTrade> {
        match signal.signal_type {
            SignalType::Buy => {
                let quantity = self.calculate_position_size(strategy, context, signal.price);
                let trade_value = signal.price * Decimal::from(quantity);
                
                if context.cash_balance >= trade_value && quantity > 0 {
                    // Create new position
                    let position = BacktestPosition {
                        symbol: signal.symbol.clone(),
                        trade_type: TradeType::Buy,
                        quantity,
                        entry_price: signal.price,
                        entry_time: signal.timestamp,
                        current_price: signal.price,
                        unrealized_pnl: Decimal::ZERO,
                    };
                    
                    context.open_positions.insert(signal.symbol.clone(), position);
                    context.cash_balance -= trade_value;
                    
                    Some(BacktestTrade::new(
                        "",  // Will be set when storing
                        &signal.symbol,
                        TradeType::Buy,
                        signal.timestamp,
                        signal.price,
                        quantity,
                    ))
                } else {
                    None
                }
            }
            SignalType::Sell => {
                if let Some(position) = context.open_positions.remove(&signal.symbol) {
                    let exit_value = signal.price * Decimal::from(position.quantity);
                    context.cash_balance += exit_value;
                    
                    let mut trade = BacktestTrade::new(
                        "",  // Will be set when storing
                        &signal.symbol,
                        position.trade_type,
                        position.entry_time,
                        position.entry_price,
                        position.quantity,
                    );
                    
                    trade.close(signal.timestamp, signal.price, "Signal exit");
                    Some(trade)
                } else {
                    None
                }
            }
            _ => None, // Handle other signal types if needed
        }
    }
    
    /// Check for position exits based on stop loss/take profit
    fn check_position_exits(&self, context: &mut BacktestContext, strategy: &StrategyParams, candle: &OHLCV) -> Vec<BacktestTrade> {
        let mut exit_trades = Vec::new();
        let mut positions_to_close = Vec::new();
        
        for (symbol, position) in &context.open_positions {
            let mut should_exit = false;
            let mut exit_reason = String::new();
            
            match position.trade_type {
                TradeType::Buy => {
                    // Check stop loss
                    let stop_loss_price = position.entry_price * (Decimal::from(100) - Decimal::from(strategy.stop_loss_percentage)) / Decimal::from(100);
                    if candle.low <= stop_loss_price {
                        should_exit = true;
                        exit_reason = "Stop loss".to_string();
                    }
                    
                    // Check take profit
                    let take_profit_price = position.entry_price * (Decimal::from(100) + Decimal::from(strategy.take_profit_percentage)) / Decimal::from(100);
                    if candle.high >= take_profit_price {
                        should_exit = true;
                        exit_reason = "Take profit".to_string();
                    }
                }
                TradeType::Sell => {
                    // Check stop loss for short position
                    let stop_loss_price = position.entry_price * (Decimal::from(100) + Decimal::from(strategy.stop_loss_percentage)) / Decimal::from(100);
                    if candle.high >= stop_loss_price {
                        should_exit = true;
                        exit_reason = "Stop loss".to_string();
                    }
                    
                    // Check take profit for short position
                    let take_profit_price = position.entry_price * (Decimal::from(100) - Decimal::from(strategy.take_profit_percentage)) / Decimal::from(100);
                    if candle.low <= take_profit_price {
                        should_exit = true;
                        exit_reason = "Take profit".to_string();
                    }
                }
            }
            
            if should_exit {
                positions_to_close.push(symbol.clone());
                
                let exit_price = match exit_reason.as_str() {
                    "Stop loss" => match position.trade_type {
                        TradeType::Buy => candle.low,
                        TradeType::Sell => candle.high,
                    },
                    "Take profit" => match position.trade_type {
                        TradeType::Buy => candle.high,
                        TradeType::Sell => candle.low,
                    },
                    _ => candle.close,
                };
                
                let mut trade = BacktestTrade::new(
                    "",  // Will be set when storing
                    symbol,
                    position.trade_type,
                    position.entry_time,
                    position.entry_price,
                    position.quantity,
                );
                
                trade.close(candle.timestamp, exit_price, &exit_reason);
                exit_trades.push(trade);
                
                // Update cash balance
                let exit_value = exit_price * Decimal::from(position.quantity);
                context.cash_balance += exit_value;
            }
        }
        
        // Remove closed positions
        for symbol in positions_to_close {
            context.open_positions.remove(&symbol);
        }
        
        exit_trades
    }
    
    /// Close remaining open positions at the end of backtest
    fn close_remaining_positions(&self, context: &mut BacktestContext) -> Vec<BacktestTrade> {
        let mut final_trades = Vec::new();
        
        for (symbol, position) in context.open_positions.drain() {
            let final_price = context.current_price;
            let exit_value = final_price * Decimal::from(position.quantity);
            context.cash_balance += exit_value;
            
            let mut trade = BacktestTrade::new(
                "",  // Will be set when storing
                &symbol,
                position.trade_type,
                position.entry_time,
                position.entry_price,
                position.quantity,
            );
            
            trade.close(context.current_time, final_price, "End of backtest");
            final_trades.push(trade);
        }
        
        final_trades
    }
    
    /// Calculate total portfolio value
    fn calculate_portfolio_value(&self, context: &BacktestContext) -> Decimal {
        let mut total_value = context.cash_balance;
        
        for position in context.open_positions.values() {
            let position_value = position.current_price * Decimal::from(position.quantity);
            total_value += position_value;
        }
        
        total_value
    }
    
    /// Store backtest result in database
    async fn store_backtest_result(&self, result: &BacktestResult) -> Result<()> {
        let mut tx = self.db.begin().await.map_err(HedgeXError::DatabaseError)?;
        
        // Insert backtest run
        sqlx::query!(
            r#"
            INSERT INTO backtest_runs (
                id, user_id, strategy_id, symbol, exchange, start_date, end_date,
                timeframe, initial_capital, total_trades, winning_trades, losing_trades,
                final_pnl, max_drawdown, sharpe_ratio, win_rate, profit_factor, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
            result.id,
            result.params.user_id,
            result.params.strategy_id,
            result.params.symbol,
            result.params.exchange,
            result.params.start_date,
            result.params.end_date,
            result.params.timeframe.to_string(),
            result.params.initial_capital,
            result.total_trades,
            result.winning_trades,
            result.losing_trades,
            result.final_pnl,
            result.max_drawdown,
            result.sharpe_ratio,
            result.win_rate,
            result.profit_factor,
            result.created_at
        )
        .execute(&mut *tx)
        .await
        .map_err(HedgeXError::DatabaseError)?;
        
        // Insert backtest trades
        for trade in &result.trades {
            sqlx::query!(
                r#"
                INSERT INTO backtest_trades (
                    id, backtest_id, symbol, trade_type, entry_time, entry_price,
                    quantity, exit_time, exit_price, pnl, exit_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#,
                trade.id,
                result.id,
                trade.symbol,
                trade.trade_type.to_string(),
                trade.entry_time,
                trade.entry_price,
                trade.quantity,
                trade.exit_time,
                trade.exit_price,
                trade.pnl,
                trade.exit_reason
            )
            .execute(&mut *tx)
            .await
            .map_err(HedgeXError::DatabaseError)?;
        }
        
        // Insert equity curve
        for point in &result.equity_curve {
            sqlx::query!(
                r#"
                INSERT INTO backtest_equity_curve (backtest_id, timestamp, equity)
                VALUES (?, ?, ?)
                "#,
                result.id,
                point.timestamp,
                point.equity
            )
            .execute(&mut *tx)
            .await
            .map_err(HedgeXError::DatabaseError)?;
        }
        
        tx.commit().await.map_err(HedgeXError::DatabaseError)?;
        
        info!("Stored backtest result {} in database", result.id);
        Ok(())
    }
    
    /// Import CSV data for backtesting
    pub async fn import_csv_data(&self, file_path: &str, symbol: &str) -> Result<CsvValidationResult> {
        info!("Importing CSV data from: {}", file_path);
        
        let config = CsvImportConfig {
            symbol: symbol.to_string(),
            exchange: "NSE".to_string(),
            timeframe: Timeframe::Day1,
            has_header: true,
            date_format: "%Y-%m-%d %H:%M:%S".to_string(),
            timezone: "Asia/Kolkata".to_string(),
        };
        
        let parser = CsvParser::new(config);
        
        // Validate CSV first
        let validation_result = parser.validate_csv(file_path)?;
        
        if validation_result.is_valid {
            // Parse and store data
            let ohlcv_data = parser.parse_csv(file_path)?;
            self.store_historical_data(symbol, "NSE", &ohlcv_data, Timeframe::Day1).await?;
            
            info!("Successfully imported {} records for {}", ohlcv_data.len(), symbol);
        }
        
        Ok(validation_result)
    }
    
    /// Store historical data in database
    async fn store_historical_data(&self, symbol: &str, exchange: &str, data: &[OHLCV], timeframe: Timeframe) -> Result<()> {
        let mut tx = self.db.begin().await.map_err(HedgeXError::DatabaseError)?;
        
        for candle in data {
            sqlx::query!(
                r#"
                INSERT OR REPLACE INTO historical_data 
                (symbol, exchange, timestamp, open, high, low, close, volume, timeframe)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#,
                symbol,
                exchange,
                candle.timestamp,
                candle.open,
                candle.high,
                candle.low,
                candle.close,
                candle.volume,
                timeframe.to_string()
            )
            .execute(&mut *tx)
            .await
            .map_err(HedgeXError::DatabaseError)?;
        }
        
        tx.commit().await.map_err(HedgeXError::DatabaseError)?;
        
        info!("Stored {} historical data points for {}:{}", data.len(), exchange, symbol);
        Ok(())
    }
    
    /// Fetch historical data from Kite API and store in database
    pub async fn fetch_historical_data(&self, params: HistoricalDataFetchParams) -> Result<()> {
        let kite_client = self.kite_client.as_ref()
            .ok_or_else(|| HedgeXError::ConfigError("Kite client not configured".to_string()))?;
        
        for symbol in &params.symbols {
            info!("Fetching historical data for {}", symbol);
            
            let hist_params = HistoricalDataParams {
                symbol: symbol.clone(),
                exchange: params.exchange.clone(),
                from_date: params.from_date,
                to_date: params.to_date,
                timeframe: params.timeframe,
            };
            
            match kite_client.fetch_historical_data(&hist_params).await {
                Ok(data) => {
                    self.store_historical_data(symbol, &params.exchange, &data, params.timeframe).await?;
                    info!("Successfully fetched and stored {} data points for {}", data.len(), symbol);
                }
                Err(e) => {
                    error!("Failed to fetch historical data for {}: {}", symbol, e);
                    // Continue with other symbols
                }
            }
            
            // Add delay to respect API rate limits
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        }
        
        Ok(())
    }
    
    /// Get backtest results for a user
    pub async fn get_backtest_results(&self, user_id: &str) -> Result<Vec<BacktestSummary>> {
        let rows = sqlx::query!(
            r#"
            SELECT br.id, br.user_id, sp.name as strategy_name, br.symbol,
                   br.start_date, br.end_date, br.total_trades, br.final_pnl,
                   br.win_rate, br.created_at
            FROM backtest_runs br
            JOIN strategy_params sp ON br.strategy_id = sp.id
            WHERE br.user_id = ?
            ORDER BY br.created_at DESC
            "#,
            user_id
        )
        .fetch_all(&*self.db)
        .await
        .map_err(HedgeXError::DatabaseError)?;
        
        let mut results = Vec::new();
        for row in rows {
            results.push(BacktestSummary {
                id: row.id,
                user_id: row.user_id,
                strategy_name: row.strategy_name,
                symbol: row.symbol,
                start_date: row.start_date,
                end_date: row.end_date,
                total_trades: row.total_trades,
                final_pnl: row.final_pnl,
                win_rate: row.win_rate,
                created_at: row.created_at,
            });
        }
        
        Ok(results)
    }
    
    /// Get detailed backtest result
    pub async fn get_backtest_detail(&self, backtest_id: &str) -> Result<BacktestResult> {
        // Get backtest run details
        let run_row = sqlx::query!(
            "SELECT * FROM backtest_runs WHERE id = ?",
            backtest_id
        )
        .fetch_one(&*self.db)
        .await
        .map_err(HedgeXError::DatabaseError)?;
        
        // Get backtest trades
        let trade_rows = sqlx::query!(
            "SELECT * FROM backtest_trades WHERE backtest_id = ? ORDER BY entry_time",
            backtest_id
        )
        .fetch_all(&*self.db)
        .await
        .map_err(HedgeXError::DatabaseError)?;
        
        let mut trades = Vec::new();
        for row in trade_rows {
            let mut trade = BacktestTrade::new(
                backtest_id,
                &row.symbol,
                TradeType::from_str(&row.trade_type).unwrap_or(TradeType::Buy),
                row.entry_time,
                row.entry_price,
                row.quantity,
            );
            
            if let (Some(exit_time), Some(exit_price), exit_reason) = (row.exit_time, row.exit_price, row.exit_reason) {
                trade.close(exit_time, exit_price, &exit_reason.unwrap_or_default());
            }
            
            trades.push(trade);
        }
        
        // Get equity curve
        let equity_rows = sqlx::query!(
            "SELECT * FROM backtest_equity_curve WHERE backtest_id = ? ORDER BY timestamp",
            backtest_id
        )
        .fetch_all(&*self.db)
        .await
        .map_err(HedgeXError::DatabaseError)?;
        
        let equity_curve = equity_rows.into_iter()
            .map(|row| EquityPoint::new(row.timestamp, row.equity))
            .collect();
        
        // Reconstruct backtest parameters
        let params = BacktestParams {
            id: run_row.id.clone(),
            user_id: run_row.user_id,
            strategy_id: run_row.strategy_id,
            symbol: run_row.symbol,
            exchange: run_row.exchange,
            start_date: run_row.start_date,
            end_date: run_row.end_date,
            timeframe: Timeframe::from_str(&run_row.timeframe).unwrap_or(Timeframe::Day1),
            initial_capital: run_row.initial_capital,
            data_source: DataSource::KiteAPI, // Default, could be stored in DB
            created_at: run_row.created_at,
        };
        
        let result = BacktestResult {
            id: run_row.id,
            params,
            total_trades: run_row.total_trades,
            winning_trades: run_row.winning_trades,
            losing_trades: run_row.losing_trades,
            final_pnl: run_row.final_pnl,
            max_drawdown: run_row.max_drawdown,
            sharpe_ratio: run_row.sharpe_ratio,
            win_rate: run_row.win_rate,
            profit_factor: run_row.profit_factor,
            trades,
            equity_curve,
            created_at: run_row.created_at,
        };
        
        Ok(result)
    }
    
    /// Compare multiple backtest results
    pub async fn compare_backtests(&self, backtest_ids: Vec<&str>) -> Result<BacktestComparison> {
        let mut backtests = Vec::new();
        let mut metrics_comparison = HashMap::new();
        
        for backtest_id in &backtest_ids {
            let summary_row = sqlx::query!(
                r#"
                SELECT br.id, br.user_id, sp.name as strategy_name, br.symbol,
                       br.start_date, br.end_date, br.total_trades, br.final_pnl,
                       br.win_rate, br.created_at, br.max_drawdown, br.sharpe_ratio,
                       br.profit_factor
                FROM backtest_runs br
                JOIN strategy_params sp ON br.strategy_id = sp.id
                WHERE br.id = ?
                "#,
                backtest_id
            )
            .fetch_one(&*self.db)
            .await
            .map_err(HedgeXError::DatabaseError)?;
            
            backtests.push(BacktestSummary {
                id: summary_row.id,
                user_id: summary_row.user_id,
                strategy_name: summary_row.strategy_name,
                symbol: summary_row.symbol,
                start_date: summary_row.start_date,
                end_date: summary_row.end_date,
                total_trades: summary_row.total_trades,
                final_pnl: summary_row.final_pnl,
                win_rate: summary_row.win_rate,
                created_at: summary_row.created_at,
            });
            
            // Collect metrics for comparison
            if !metrics_comparison.contains_key("final_pnl") {
                metrics_comparison.insert("final_pnl".to_string(), Vec::new());
                metrics_comparison.insert("win_rate".to_string(), Vec::new());
                metrics_comparison.insert("max_drawdown".to_string(), Vec::new());
                metrics_comparison.insert("sharpe_ratio".to_string(), Vec::new());
                metrics_comparison.insert("profit_factor".to_string(), Vec::new());
            }
            
            metrics_comparison.get_mut("final_pnl").unwrap().push(summary_row.final_pnl.to_f64().unwrap_or(0.0));
            metrics_comparison.get_mut("win_rate").unwrap().push(summary_row.win_rate);
            metrics_comparison.get_mut("max_drawdown").unwrap().push(summary_row.max_drawdown.to_f64().unwrap_or(0.0));
            metrics_comparison.get_mut("sharpe_ratio").unwrap().push(summary_row.sharpe_ratio);
            metrics_comparison.get_mut("profit_factor").unwrap().push(summary_row.profit_factor);
        }
        
        Ok(BacktestComparison {
            backtests,
            metrics_comparison,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::backtesting::*;
    use crate::models::trading::*;
    use crate::trading::strategy_manager::StrategyManager;
    use chrono::{DateTime, Utc, TimeZone};
    use rust_decimal::Decimal;
    use sqlx::{Pool, Sqlite, SqlitePool};
    use std::sync::Arc;
    use tempfile::NamedTempFile;
    use std::io::Write;

    async fn create_test_db() -> Pool<Sqlite> {
        let pool = SqlitePool::connect(":memory:").await.unwrap();
        
        // Create necessary tables for testing
        sqlx::query(r#"
            CREATE TABLE strategy_params (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                enabled BOOLEAN NOT NULL DEFAULT 0,
                max_trades_per_day INTEGER NOT NULL DEFAULT 10,
                risk_percentage REAL NOT NULL DEFAULT 2.0,
                stop_loss_percentage REAL NOT NULL DEFAULT 2.0,
                take_profit_percentage REAL NOT NULL DEFAULT 4.0,
                volume_threshold INTEGER NOT NULL DEFAULT 1000,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        "#).execute(&pool).await.unwrap();

        sqlx::query(r#"
            CREATE TABLE backtest_runs (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                strategy_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                exchange TEXT NOT NULL,
                start_date TIMESTAMP NOT NULL,
                end_date TIMESTAMP NOT NULL,
                timeframe TEXT NOT NULL,
                initial_capital REAL NOT NULL,
                total_trades INTEGER NOT NULL,
                winning_trades INTEGER NOT NULL,
                losing_trades INTEGER NOT NULL,
                final_pnl REAL NOT NULL,
                max_drawdown REAL NOT NULL,
                sharpe_ratio REAL NOT NULL,
                win_rate REAL NOT NULL,
                profit_factor REAL NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        "#).execute(&pool).await.unwrap();

        sqlx::query(r#"
            CREATE TABLE backtest_trades (
                id TEXT PRIMARY KEY,
                backtest_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                trade_type TEXT NOT NULL,
                entry_time TIMESTAMP NOT NULL,
                entry_price REAL NOT NULL,
                quantity INTEGER NOT NULL,
                exit_time TIMESTAMP,
                exit_price REAL,
                pnl REAL,
                exit_reason TEXT
            )
        "#).execute(&pool).await.unwrap();

        sqlx::query(r#"
            CREATE TABLE backtest_equity_curve (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                backtest_id TEXT NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                equity REAL NOT NULL
            )
        "#).execute(&pool).await.unwrap();

        sqlx::query(r#"
            CREATE TABLE historical_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                exchange TEXT NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                open REAL NOT NULL,
                high REAL NOT NULL,
                low REAL NOT NULL,
                close REAL NOT NULL,
                volume INTEGER NOT NULL,
                timeframe TEXT NOT NULL,
                UNIQUE(symbol, exchange, timestamp, timeframe)
            )
        "#).execute(&pool).await.unwrap();

        pool
    }

    async fn create_test_strategy(pool: &Pool<Sqlite>) -> String {
        let strategy_id = uuid::Uuid::new_v4().to_string();
        
        sqlx::query!(
            r#"
            INSERT INTO strategy_params (
                id, user_id, name, description, enabled, max_trades_per_day,
                risk_percentage, stop_loss_percentage, take_profit_percentage, volume_threshold
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
            strategy_id,
            "test_user",
            "Test Strategy",
            "A test strategy for backtesting",
            true,
            10,
            2.0,
            2.0,
            4.0,
            1000
        ).execute(pool).await.unwrap();

        strategy_id
    }

    fn create_test_historical_data() -> Vec<OHLCV> {
        let mut data = Vec::new();
        let base_time = Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap();
        
        // Create 100 data points with some trend
        for i in 0..100 {
            let timestamp = base_time + chrono::Duration::minutes(i);
            let base_price = Decimal::from(1000) + Decimal::from(i) / Decimal::from(10); // Slight uptrend
            
            // Add some volatility
            let volatility = Decimal::from(5) * Decimal::from((i % 10) as f64 - 5.0) / Decimal::from(10);
            
            let open = base_price + volatility;
            let high = open + Decimal::from(2);
            let low = open - Decimal::from(2);
            let close = open + volatility / Decimal::from(2);
            let volume = 1000 + (i % 500) as i64;

            data.push(OHLCV::new(timestamp, open, high, low, close, volume));
        }

        data
    }

    fn create_test_csv_file() -> NamedTempFile {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "timestamp,open,high,low,close,volume").unwrap();
        
        let base_time = Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap();
        
        for i in 0..50 {
            let timestamp = base_time + chrono::Duration::minutes(i);
            let base_price = 1000.0 + (i as f64) / 10.0;
            let volatility = 5.0 * ((i % 10) as f64 - 5.0) / 10.0;
            
            let open = base_price + volatility;
            let high = open + 2.0;
            let low = open - 2.0;
            let close = open + volatility / 2.0;
            let volume = 1000 + (i % 500);

            writeln!(
                temp_file,
                "{},{},{},{},{},{}",
                timestamp.format("%Y-%m-%d %H:%M:%S"),
                open, high, low, close, volume
            ).unwrap();
        }

        temp_file
    }

    #[tokio::test]
    async fn test_backtest_engine_creation() {
        let pool = Arc::new(create_test_db().await);
        let strategy_manager = Arc::new(StrategyManager::new(pool.clone()));
        
        let engine = BacktestEngine::new(pool, strategy_manager);
        
        // Test that engine is created successfully
        assert!(engine.kite_client.is_none());
    }

    #[tokio::test]
    async fn test_csv_import_validation() {
        let pool = Arc::new(create_test_db().await);
        let strategy_manager = Arc::new(StrategyManager::new(pool.clone()));
        let engine = BacktestEngine::new(pool, strategy_manager);

        let temp_file = create_test_csv_file();
        let file_path = temp_file.path().to_str().unwrap();

        let result = engine.import_csv_data(file_path, "RELIANCE").await.unwrap();
        
        assert!(result.is_valid);
        assert_eq!(result.valid_rows, 50);
        assert_eq!(result.total_rows, 50);
        assert!(result.errors.is_empty());
    }

    #[tokio::test]
    async fn test_position_size_calculation() {
        let pool = Arc::new(create_test_db().await);
        let strategy_manager = Arc::new(StrategyManager::new(pool.clone()));
        let engine = BacktestEngine::new(pool, strategy_manager);

        let strategy = StrategyParams {
            id: "test_strategy".to_string(),
            user_id: "test_user".to_string(),
            name: "Test Strategy".to_string(),
            description: None,
            enabled: true,
            max_trades_per_day: 10,
            risk_percentage: 2.0, // 2% risk
            stop_loss_percentage: 1.0, // 1% stop loss
            take_profit_percentage: 2.0,
            volume_threshold: 1000,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let context = BacktestContext {
            current_time: Utc::now(),
            current_price: Decimal::from(1000),
            current_volume: 2000,
            portfolio_value: Decimal::from(100000),
            cash_balance: Decimal::from(100000),
            open_positions: HashMap::new(),
            historical_data: Vec::new(),
            data_index: 0,
        };

        let price = Decimal::from(1000);
        let position_size = engine.calculate_position_size(&strategy, &context, price);

        // With 2% risk and 1% stop loss, position should be 2% of portfolio
        // Risk amount = 100000 * 0.02 = 2000
        // Position value = 2000 / 0.01 * 100 = 200000 (but limited by cash)
        // Quantity = min(200000 / 1000, 100000 / 1000) = min(200, 100) = 100
        assert_eq!(position_size, 100);
    }

    #[tokio::test]
    async fn test_sma_calculation() {
        let pool = Arc::new(create_test_db().await);
        let strategy_manager = Arc::new(StrategyManager::new(pool.clone()));
        let engine = BacktestEngine::new(pool, strategy_manager);

        let data = create_test_historical_data();
        
        // Test SMA calculation
        let sma_5 = engine.calculate_sma(&data, 10, 5);
        let sma_20 = engine.calculate_sma(&data, 25, 20);

        // SMA should be calculated correctly
        assert!(sma_5 > Decimal::ZERO);
        assert!(sma_20 > Decimal::ZERO);
        
        // For insufficient data, should return zero
        let sma_insufficient = engine.calculate_sma(&data, 5, 20);
        assert_eq!(sma_insufficient, Decimal::ZERO);
    }

    #[tokio::test]
    async fn test_backtest_trade_lifecycle() {
        let mut trade = BacktestTrade::new(
            "backtest_123",
            "RELIANCE",
            TradeType::Buy,
            Utc::now(),
            Decimal::from(1000),
            100,
        );

        assert!(trade.is_open());
        assert_eq!(trade.pnl, None);

        // Close the trade
        let exit_time = Utc::now() + chrono::Duration::minutes(30);
        trade.close(exit_time, Decimal::from(1050), "Take profit");

        assert!(!trade.is_open());
        assert_eq!(trade.exit_price, Some(Decimal::from(1050)));
        assert_eq!(trade.pnl, Some(Decimal::from(5000))); // (1050 - 1000) * 100
        assert_eq!(trade.exit_reason, Some("Take profit".to_string()));
        assert_eq!(trade.duration_minutes(), Some(30));
    }
}