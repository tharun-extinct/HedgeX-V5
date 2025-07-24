use crate::error::{HedgeXError, Result};
use crate::models::trading::{
    Position, Trade, TradeType, OrderRequest, RiskLimits, PerformanceMetrics
};
use crate::services::enhanced_database_service::EnhancedDatabaseService;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
use chrono::{DateTime, Utc};
use sqlx::Row;

/// Risk manager for controlling trading risk
pub struct RiskManager {
    /// Database service for storing risk data
    db_service: Arc<EnhancedDatabaseService>,
    
    /// Current positions by symbol
    positions: Arc<RwLock<HashMap<String, Position>>>,
    
    /// Risk limits configuration
    risk_limits: Arc<RwLock<RiskLimits>>,
    
    /// Daily trade count by user
    daily_trade_count: Arc<RwLock<HashMap<String, i32>>>,
    
    /// Daily P&L by user
    daily_pnl: Arc<RwLock<HashMap<String, Decimal>>>,
    
    /// Emergency stop flag
    emergency_stop: Arc<RwLock<bool>>,
    
    /// User ID
    user_id: String,
}

impl RiskManager {
    /// Create a new risk manager
    pub async fn new(
        db_service: Arc<EnhancedDatabaseService>,
        user_id: &str,
    ) -> Result<Self> {
        let risk_manager = Self {
            db_service,
            positions: Arc::new(RwLock::new(HashMap::new())),
            risk_limits: Arc::new(RwLock::new(RiskLimits::default())),
            daily_trade_count: Arc::new(RwLock::new(HashMap::new())),
            daily_pnl: Arc::new(RwLock::new(HashMap::new())),
            emergency_stop: Arc::new(RwLock::new(false)),
            user_id: user_id.to_string(),
        };
        
        // Load existing positions and risk data
        risk_manager.load_positions().await?;
        risk_manager.load_daily_metrics().await?;
        
        Ok(risk_manager)
    }
    
    /// Load existing positions from database
    async fn load_positions(&self) -> Result<()> {
        // Query for current positions from trades table
        let query = "
            SELECT symbol, exchange, 
                   SUM(CASE WHEN trade_type = 'Buy' THEN quantity ELSE -quantity END) as net_quantity,
                   AVG(price) as avg_price,
                   MIN(executed_at) as entry_time
            FROM trades 
            WHERE user_id = ? AND status = 'Executed'
            GROUP BY symbol, exchange
            HAVING net_quantity != 0
        ";
        
        let rows = sqlx::query(query)
            .bind(&self.user_id)
            .fetch_all(self.db_service.get_database().get_pool())
            .await?;
            
        let mut positions = self.positions.write().await;
        
        for row in rows {
            let symbol: String = row.get("symbol");
            let exchange: String = row.get("exchange");
            let net_quantity: i32 = row.get("net_quantity");
            let avg_price: f64 = row.get("avg_price");
            let entry_time: DateTime<Utc> = row.get("entry_time");
            
            let trade_type = if net_quantity > 0 { TradeType::Buy } else { TradeType::Sell };
            let quantity = net_quantity.abs();
            
            let mut position = Position::new(
                &symbol,
                &exchange,
                quantity,
                Decimal::from_f64_retain(avg_price).unwrap_or(Decimal::ZERO),
                trade_type,
            );
            position.entry_time = entry_time;
            
            positions.insert(format!("{}:{}", exchange, symbol), position);
        }
        
        info!("Loaded {} existing positions", positions.len());
        Ok(())
    }
    
    /// Load daily metrics from database
    async fn load_daily_metrics(&self) -> Result<()> {
        let today = Utc::now().date_naive();
        
        // Load daily trade count
        let trade_count_query = "
            SELECT COUNT(*) as count 
            FROM trades 
            WHERE user_id = ? AND DATE(executed_at) = ?
        ";
        
        let count_row = sqlx::query(trade_count_query)
            .bind(&self.user_id)
            .bind(today)
            .fetch_one(self.db_service.get_database().get_pool())
            .await?;
            
        let trade_count: i64 = count_row.get("count");
        
        // Load daily P&L
        let pnl_query = "
            SELECT SUM(
                CASE 
                    WHEN trade_type = 'Buy' THEN -price * quantity
                    ELSE price * quantity
                END
            ) as daily_pnl
            FROM trades 
            WHERE user_id = ? AND DATE(executed_at) = ? AND status = 'Executed'
        ";
        
        let pnl_row = sqlx::query(pnl_query)
            .bind(&self.user_id)
            .bind(today)
            .fetch_optional(self.db_service.get_database().get_pool())
            .await?;
            
        let daily_pnl = match pnl_row {
            Some(row) => {
                let pnl: Option<f64> = row.get("daily_pnl");
                Decimal::from_f64_retain(pnl.unwrap_or(0.0)).unwrap_or(Decimal::ZERO)
            },
            None => Decimal::ZERO,
        };
        
        // Update in-memory counters
        {
            let mut trade_count_map = self.daily_trade_count.write().await;
            trade_count_map.insert(self.user_id.clone(), trade_count as i32);
        }
        
        {
            let mut pnl_map = self.daily_pnl.write().await;
            pnl_map.insert(self.user_id.clone(), daily_pnl);
        }
        
        debug!("Loaded daily metrics: {} trades, {} P&L", trade_count, daily_pnl);
        Ok(())
    }
    
    /// Check if order passes risk validation
    pub async fn validate_order(&self, order: &OrderRequest) -> Result<bool> {
        // Check emergency stop
        if *self.emergency_stop.read().await {
            warn!("Order rejected: Emergency stop is active");
            return Ok(false);
        }
        
        let risk_limits = self.risk_limits.read().await;
        
        // Check daily trade limit
        let daily_count = self.daily_trade_count.read().await;
        let current_count = daily_count.get(&self.user_id).unwrap_or(&0);
        
        if *current_count >= risk_limits.max_trades_per_day {
            warn!("Order rejected: Daily trade limit exceeded ({}/{})", 
                  current_count, risk_limits.max_trades_per_day);
            return Ok(false);
        }
        
        // Check daily loss limit
        let daily_pnl = self.daily_pnl.read().await;
        let current_pnl = daily_pnl.get(&self.user_id).unwrap_or(&Decimal::ZERO);
        
        if current_pnl <= -risk_limits.max_daily_loss {
            warn!("Order rejected: Daily loss limit exceeded ({} <= -{})", 
                  current_pnl, risk_limits.max_daily_loss);
            return Ok(false);
        }
        
        // Check position size limit
        let order_value = order.price.unwrap_or(Decimal::ZERO) * Decimal::from(order.quantity);
        if order_value > risk_limits.max_position_size {
            warn!("Order rejected: Position size limit exceeded ({} > {})", 
                  order_value, risk_limits.max_position_size);
            return Ok(false);
        }
        
        // Check symbol-specific trade limit
        let symbol_trades = self.get_symbol_trade_count(&order.symbol).await?;
        if symbol_trades >= risk_limits.max_trades_per_symbol {
            warn!("Order rejected: Symbol trade limit exceeded for {} ({}/{})", 
                  order.symbol, symbol_trades, risk_limits.max_trades_per_symbol);
            return Ok(false);
        }
        
        // Check position concentration
        if !self.check_position_concentration(order).await? {
            warn!("Order rejected: Position concentration limit exceeded");
            return Ok(false);
        }
        
        debug!("Order validation passed for {} {} {}", 
               order.trade_type, order.quantity, order.symbol);
        Ok(true)
    }
    
    /// Get trade count for a specific symbol today
    async fn get_symbol_trade_count(&self, symbol: &str) -> Result<i32> {
        let today = Utc::now().date_naive();
        
        let query = "
            SELECT COUNT(*) as count 
            FROM trades 
            WHERE user_id = ? AND symbol = ? AND DATE(executed_at) = ?
        ";
        
        let row = sqlx::query(query)
            .bind(&self.user_id)
            .bind(symbol)
            .bind(today)
            .fetch_one(self.db_service.get_database().get_pool())
            .await?;
            
        let count: i64 = row.get("count");
        Ok(count as i32)
    }
    
    /// Check position concentration limits
    async fn check_position_concentration(&self, order: &OrderRequest) -> Result<bool> {
        let risk_limits = self.risk_limits.read().await;
        let positions = self.positions.read().await;
        
        // Calculate total portfolio value
        let mut total_value = Decimal::ZERO;
        for position in positions.values() {
            total_value += position.current_price * Decimal::from(position.quantity);
        }
        
        // Calculate new position value
        let order_value = order.price.unwrap_or(Decimal::ZERO) * Decimal::from(order.quantity);
        
        // Check if this would exceed concentration limit
        if total_value > Decimal::ZERO {
            let concentration = (order_value / total_value).to_f64().unwrap_or(0.0) * 100.0;
            if concentration > risk_limits.position_concentration_limit {
                return Ok(false);
            }
        }
        
        Ok(true)
    }
    
    /// Update position after trade execution
    pub async fn update_position(&self, trade: &Trade) -> Result<()> {
        let position_key = format!("{}:{}", trade.exchange, trade.symbol);
        let mut positions = self.positions.write().await;
        
        match positions.get_mut(&position_key) {
            Some(position) => {
                // Update existing position
                match trade.trade_type {
                    TradeType::Buy => {
                        if position.trade_type == TradeType::Buy {
                            // Add to long position
                            position.add_quantity(trade.quantity, trade.price);
                        } else {
                            // Reduce short position
                            if !position.reduce_quantity(trade.quantity) {
                                // Position closed, remove it
                                positions.remove(&position_key);
                            }
                        }
                    },
                    TradeType::Sell => {
                        if position.trade_type == TradeType::Sell {
                            // Add to short position
                            position.add_quantity(trade.quantity, trade.price);
                        } else {
                            // Reduce long position
                            if !position.reduce_quantity(trade.quantity) {
                                // Position closed, remove it
                                positions.remove(&position_key);
                            }
                        }
                    }
                }
            },
            None => {
                // Create new position
                let position = Position::new(
                    &trade.symbol,
                    &trade.exchange,
                    trade.quantity,
                    trade.price,
                    trade.trade_type,
                );
                positions.insert(position_key, position);
            }
        }
        
        // Update daily counters
        self.update_daily_counters(trade).await?;
        
        debug!("Updated position for {}: {} {}", 
               trade.symbol, trade.trade_type, trade.quantity);
        Ok(())
    }
    
    /// Update daily counters after trade
    async fn update_daily_counters(&self, trade: &Trade) -> Result<()> {
        // Update trade count
        {
            let mut trade_count = self.daily_trade_count.write().await;
            let count = trade_count.entry(self.user_id.clone()).or_insert(0);
            *count += 1;
        }
        
        // Update P&L (simplified calculation)
        {
            let mut pnl = self.daily_pnl.write().await;
            let current_pnl = pnl.entry(self.user_id.clone()).or_insert(Decimal::ZERO);
            
            let trade_value = match trade.trade_type {
                TradeType::Buy => -trade.price * Decimal::from(trade.quantity),
                TradeType::Sell => trade.price * Decimal::from(trade.quantity),
            };
            
            *current_pnl += trade_value;
        }
        
        Ok(())
    }
    
    /// Update positions with current market prices
    pub async fn update_market_prices(&self, symbol: &str, price: Decimal) -> Result<()> {
        let mut positions = self.positions.write().await;
        
        // Update all positions for this symbol
        for (key, position) in positions.iter_mut() {
            if position.symbol == symbol {
                position.update_price(price);
            }
        }
        
        Ok(())
    }
    
    /// Check if stop loss should be triggered
    pub async fn check_stop_loss(&self, symbol: &str) -> Result<Option<TradeType>> {
        let positions = self.positions.read().await;
        let risk_limits = self.risk_limits.read().await;
        
        for position in positions.values() {
            if position.symbol == symbol {
                let loss_percentage = position.pnl_percentage.to_f64().unwrap_or(0.0);
                
                if loss_percentage <= -risk_limits.stop_loss_percentage {
                    warn!("Stop loss triggered for {}: {}% loss", symbol, loss_percentage);
                    
                    // Return opposite trade type to close position
                    return Ok(Some(match position.trade_type {
                        TradeType::Buy => TradeType::Sell,
                        TradeType::Sell => TradeType::Buy,
                    }));
                }
            }
        }
        
        Ok(None)
    }
    
    /// Check if take profit should be triggered
    pub async fn check_take_profit(&self, symbol: &str) -> Result<Option<TradeType>> {
        let positions = self.positions.read().await;
        let risk_limits = self.risk_limits.read().await;
        
        for position in positions.values() {
            if position.symbol == symbol {
                let profit_percentage = position.pnl_percentage.to_f64().unwrap_or(0.0);
                
                if profit_percentage >= risk_limits.take_profit_percentage {
                    info!("Take profit triggered for {}: {}% profit", symbol, profit_percentage);
                    
                    // Return opposite trade type to close position
                    return Ok(Some(match position.trade_type {
                        TradeType::Buy => TradeType::Sell,
                        TradeType::Sell => TradeType::Buy,
                    }));
                }
            }
        }
        
        Ok(None)
    }
    
    /// Get current positions
    pub async fn get_positions(&self) -> Result<Vec<Position>> {
        let positions = self.positions.read().await;
        Ok(positions.values().cloned().collect())
    }
    
    /// Get current risk limits
    pub async fn get_risk_limits(&self) -> Result<RiskLimits> {
        let limits = self.risk_limits.read().await;
        Ok(limits.clone())
    }
    
    /// Update risk limits
    pub async fn update_risk_limits(&self, new_limits: RiskLimits) -> Result<()> {
        let mut limits = self.risk_limits.write().await;
        *limits = new_limits;
        
        info!("Risk limits updated");
        Ok(())
    }
    
    /// Trigger emergency stop
    pub async fn emergency_stop(&self) -> Result<()> {
        let mut stop = self.emergency_stop.write().await;
        *stop = true;
        
        error!("EMERGENCY STOP ACTIVATED - All trading halted");
        
        // Log emergency stop to database
        let query = "
            INSERT INTO system_logs (id, user_id, log_level, message, context)
            VALUES (?, ?, ?, ?, ?)
        ";
        
        sqlx::query(query)
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(&self.user_id)
            .bind(1) // ERROR level
            .bind("EMERGENCY STOP ACTIVATED")
            .bind("risk_manager")
            .execute(self.db_service.get_database().get_pool())
            .await?;
        
        Ok(())
    }
    
    /// Clear emergency stop
    pub async fn clear_emergency_stop(&self) -> Result<()> {
        let mut stop = self.emergency_stop.write().await;
        *stop = false;
        
        info!("Emergency stop cleared - Trading resumed");
        Ok(())
    }
    
    /// Check if emergency stop is active
    pub async fn is_emergency_stop_active(&self) -> bool {
        *self.emergency_stop.read().await
    }
    
    /// Get daily performance metrics
    pub async fn get_daily_metrics(&self) -> Result<PerformanceMetrics> {
        let trade_count = self.daily_trade_count.read().await;
        let pnl = self.daily_pnl.read().await;
        
        let total_trades = *trade_count.get(&self.user_id).unwrap_or(&0);
        let total_pnl = *pnl.get(&self.user_id).unwrap_or(&Decimal::ZERO);
        
        // Calculate profitable trades from database
        let today = Utc::now().date_naive();
        let profitable_query = "
            SELECT COUNT(*) as count 
            FROM trades 
            WHERE user_id = ? AND DATE(executed_at) = ? AND 
                  ((trade_type = 'Buy' AND price < (SELECT AVG(price) FROM trades t2 WHERE t2.symbol = trades.symbol AND t2.trade_type = 'Sell' AND t2.executed_at > trades.executed_at LIMIT 1)) OR
                   (trade_type = 'Sell' AND price > (SELECT AVG(price) FROM trades t2 WHERE t2.symbol = trades.symbol AND t2.trade_type = 'Buy' AND t2.executed_at > trades.executed_at LIMIT 1)))
        ";
        
        let profitable_trades = match sqlx::query(profitable_query)
            .bind(&self.user_id)
            .bind(today)
            .fetch_optional(self.db_service.get_database().get_pool())
            .await? {
            Some(row) => {
                let count: i64 = row.get("count");
                count as i32
            },
            None => 0,
        };
        
        let mut metrics = PerformanceMetrics::new(&self.user_id);
        metrics.total_trades = total_trades;
        metrics.profitable_trades = profitable_trades;
        metrics.total_pnl = total_pnl;
        
        if total_trades > 0 {
            metrics.win_rate = (profitable_trades as f64 / total_trades as f64) * 100.0;
        }
        
        Ok(metrics)
    }
    
    /// Reset daily counters (called at start of new trading day)
    pub async fn reset_daily_counters(&self) -> Result<()> {
        {
            let mut trade_count = self.daily_trade_count.write().await;
            trade_count.insert(self.user_id.clone(), 0);
        }
        
        {
            let mut pnl = self.daily_pnl.write().await;
            pnl.insert(self.user_id.clone(), Decimal::ZERO);
        }
        
        info!("Daily counters reset for new trading day");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::enhanced_database_service::EnhancedDatabaseService;
    use tempfile::tempdir;
    use std::path::PathBuf;
    
    async fn setup_test_db() -> (Arc<EnhancedDatabaseService>, PathBuf) {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().to_path_buf();
        
        let db_service = EnhancedDatabaseService::new(&db_path, "test_password")
            .await
            .unwrap();
            
        // Create required tables
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS trades (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                exchange TEXT NOT NULL,
                order_id TEXT,
                trade_type TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                status TEXT NOT NULL,
                executed_at TIMESTAMP NOT NULL,
                strategy_id TEXT NOT NULL
            )"
        )
        .execute(db_service.get_database().get_pool())
        .await
        .unwrap();
        
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS system_logs (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                log_level INTEGER NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                context TEXT
            )"
        )
        .execute(db_service.get_database().get_pool())
        .await
        .unwrap();
        
        (Arc::new(db_service), db_path)
    }
    
    #[tokio::test]
    async fn test_risk_manager_creation() {
        let (db_service, _) = setup_test_db().await;
        
        let risk_manager = RiskManager::new(db_service, "test_user")
            .await
            .unwrap();
            
        assert_eq!(risk_manager.user_id, "test_user");
        assert!(!risk_manager.is_emergency_stop_active().await);
    }
    
    #[tokio::test]
    async fn test_order_validation() {
        let (db_service, _) = setup_test_db().await;
        
        let risk_manager = RiskManager::new(db_service, "test_user")
            .await
            .unwrap();
            
        let order = OrderRequest {
            symbol: "INFY".to_string(),
            exchange: "NSE".to_string(),
            trade_type: TradeType::Buy,
            quantity: 10,
            price: Some(Decimal::from(1500)),
            order_type: crate::models::trading::OrderType::Market,
            strategy_id: "test_strategy".to_string(),
            user_id: "test_user".to_string(),
        };
        
        let is_valid = risk_manager.validate_order(&order).await.unwrap();
        assert!(is_valid);
    }
    
    #[tokio::test]
    async fn test_emergency_stop() {
        let (db_service, _) = setup_test_db().await;
        
        let risk_manager = RiskManager::new(db_service, "test_user")
            .await
            .unwrap();
            
        // Activate emergency stop
        risk_manager.emergency_stop().await.unwrap();
        assert!(risk_manager.is_emergency_stop_active().await);
        
        // Test order rejection during emergency stop
        let order = OrderRequest {
            symbol: "INFY".to_string(),
            exchange: "NSE".to_string(),
            trade_type: TradeType::Buy,
            quantity: 10,
            price: Some(Decimal::from(1500)),
            order_type: crate::models::trading::OrderType::Market,
            strategy_id: "test_strategy".to_string(),
            user_id: "test_user".to_string(),
        };
        
        let is_valid = risk_manager.validate_order(&order).await.unwrap();
        assert!(!is_valid);
        
        // Clear emergency stop
        risk_manager.clear_emergency_stop().await.unwrap();
        assert!(!risk_manager.is_emergency_stop_active().await);
    }
    
    #[tokio::test]
    async fn test_position_update() {
        let (db_service, _) = setup_test_db().await;
        
        let risk_manager = RiskManager::new(db_service, "test_user")
            .await
            .unwrap();
            
        let trade = Trade::new(
            "test_user",
            "INFY",
            "NSE",
            TradeType::Buy,
            10,
            Decimal::from(1500),
            "test_strategy",
        );
        
        risk_manager.update_position(&trade).await.unwrap();
        
        let positions = risk_manager.get_positions().await.unwrap();
        assert_eq!(positions.len(), 1);
        assert_eq!(positions[0].symbol, "INFY");
        assert_eq!(positions[0].quantity, 10);
    }
}