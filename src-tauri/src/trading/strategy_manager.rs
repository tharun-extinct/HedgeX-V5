use crate::error::{HedgeXError, Result};
use crate::models::trading::{
    StrategyParams, StockSelection, MarketData, TradingSignal, SignalType, TradeType
};
use crate::services::enhanced_database_service::EnhancedDatabaseService;
use rust_decimal::{Decimal, prelude::FromStr};
use num_traits::ToPrimitive;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use sqlx::Row;

/// Strategy manager for loading and validating trading strategies
pub struct StrategyManager {
    /// Database service for storing strategy data
    db_service: Arc<EnhancedDatabaseService>,
    
    /// Active strategies by ID
    strategies: Arc<RwLock<HashMap<String, StrategyParams>>>,
    
    /// Active stock selections by user
    stock_selections: Arc<RwLock<HashMap<String, Vec<StockSelection>>>>,
    
    /// User ID
    user_id: String,
}

impl StrategyManager {
    /// Create a new strategy manager
    pub async fn new(
        db_service: Arc<EnhancedDatabaseService>,
        user_id: &str,
    ) -> Result<Self> {
        let manager = Self {
            db_service,
            strategies: Arc::new(RwLock::new(HashMap::new())),
            stock_selections: Arc::new(RwLock::new(HashMap::new())),
            user_id: user_id.to_string(),
        };
        
        // Load existing strategies and stock selections
        manager.load_strategies().await?;
        manager.load_stock_selections().await?;
        
        Ok(manager)
    }
    
    /// Load strategies from database
    async fn load_strategies(&self) -> Result<()> {
        let query = "
            SELECT id, user_id, name, description, enabled, max_trades_per_day,
                   risk_percentage, stop_loss_percentage, take_profit_percentage,
                   volume_threshold, created_at, updated_at
            FROM strategy_params 
            WHERE user_id = ?
        ";
        
        let rows = sqlx::query(query)
            .bind(&self.user_id)
            .fetch_all(self.db_service.get_database().get_pool())
            .await?;
            
        let mut strategies = self.strategies.write().await;
        
        for row in rows {
            let strategy = StrategyParams {
                id: row.get("id"),
                user_id: row.get("user_id"),
                name: row.get("name"),
                description: row.get("description"),
                enabled: row.get("enabled"),
                max_trades_per_day: row.get("max_trades_per_day"),
                risk_percentage: row.get("risk_percentage"),
                stop_loss_percentage: row.get("stop_loss_percentage"),
                take_profit_percentage: row.get("take_profit_percentage"),
                volume_threshold: row.get("volume_threshold"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            };
            
            strategies.insert(strategy.id.clone(), strategy);
        }
        
        info!("Loaded {} strategies", strategies.len());
        Ok(())
    }
    
    /// Load stock selections from database
    async fn load_stock_selections(&self) -> Result<()> {
        let query = "
            SELECT id, user_id, symbol, exchange, is_active, added_at
            FROM stock_selection 
            WHERE user_id = ? AND is_active = true
        ";
        
        let rows = sqlx::query(query)
            .bind(&self.user_id)
            .fetch_all(self.db_service.get_database().get_pool())
            .await?;
            
        let mut selections = self.stock_selections.write().await;
        let mut user_selections = Vec::new();
        
        for row in rows {
            let selection = StockSelection {
                id: row.get("id"),
                user_id: row.get("user_id"),
                symbol: row.get("symbol"),
                exchange: row.get("exchange"),
                is_active: row.get("is_active"),
                added_at: row.get("added_at"),
            };
            
            user_selections.push(selection);
        }
        
        selections.insert(self.user_id.clone(), user_selections);
        
        let count = selections.get(&self.user_id).map(|s| s.len()).unwrap_or(0);
        info!("Loaded {} active stock selections", count);
        Ok(())
    }
    
    /// Get all strategies for user
    pub async fn get_strategies(&self) -> Result<Vec<StrategyParams>> {
        let strategies = self.strategies.read().await;
        Ok(strategies.values().cloned().collect())
    }
    
    /// Get strategy by ID
    pub async fn get_strategy(&self, strategy_id: &str) -> Result<Option<StrategyParams>> {
        let strategies = self.strategies.read().await;
        Ok(strategies.get(strategy_id).cloned())
    }
    
    /// Get enabled strategies
    pub async fn get_enabled_strategies(&self) -> Result<Vec<StrategyParams>> {
        let strategies = self.strategies.read().await;
        Ok(strategies.values()
            .filter(|s| s.enabled)
            .cloned()
            .collect())
    }
    
    /// Create new strategy
    pub async fn create_strategy(
        &self,
        name: &str,
        description: Option<String>,
        max_trades_per_day: i32,
        risk_percentage: f64,
        stop_loss_percentage: f64,
        take_profit_percentage: f64,
        volume_threshold: i64,
    ) -> Result<StrategyParams> {
        let strategy = StrategyParams::new(
            &self.user_id,
            name,
            description,
            max_trades_per_day,
            risk_percentage,
            stop_loss_percentage,
            take_profit_percentage,
            volume_threshold,
        );
        
        // Insert into database
        let query = "
            INSERT INTO strategy_params 
            (id, user_id, name, description, enabled, max_trades_per_day,
             risk_percentage, stop_loss_percentage, take_profit_percentage,
             volume_threshold, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ";
        
        sqlx::query(query)
            .bind(&strategy.id)
            .bind(&strategy.user_id)
            .bind(&strategy.name)
            .bind(&strategy.description)
            .bind(strategy.enabled)
            .bind(strategy.max_trades_per_day)
            .bind(strategy.risk_percentage)
            .bind(strategy.stop_loss_percentage)
            .bind(strategy.take_profit_percentage)
            .bind(strategy.volume_threshold)
            .bind(strategy.created_at)
            .bind(strategy.updated_at)
            .execute(self.db_service.get_database().get_pool())
            .await?;
            
        // Add to in-memory cache
        {
            let mut strategies = self.strategies.write().await;
            strategies.insert(strategy.id.clone(), strategy.clone());
        }
        
        info!("Created new strategy: {} ({})", strategy.name, strategy.id);
        Ok(strategy)
    }
    
    /// Update strategy
    pub async fn update_strategy(
        &self,
        strategy_id: &str,
        name: Option<String>,
        description: Option<String>,
        max_trades_per_day: Option<i32>,
        risk_percentage: Option<f64>,
        stop_loss_percentage: Option<f64>,
        take_profit_percentage: Option<f64>,
        volume_threshold: Option<i64>,
    ) -> Result<StrategyParams> {
        let mut strategies = self.strategies.write().await;
        
        let strategy = strategies.get_mut(strategy_id)
            .ok_or_else(|| HedgeXError::NotFoundError(format!("Strategy not found: {}", strategy_id)))?;
            
        // Update strategy parameters
        strategy.update(
            name,
            description,
            max_trades_per_day,
            risk_percentage,
            stop_loss_percentage,
            take_profit_percentage,
            volume_threshold,
        );
        
        // Update in database
        let query = "
            UPDATE strategy_params 
            SET name = ?, description = ?, max_trades_per_day = ?,
                risk_percentage = ?, stop_loss_percentage = ?, 
                take_profit_percentage = ?, volume_threshold = ?, updated_at = ?
            WHERE id = ?
        ";
        
        sqlx::query(query)
            .bind(&strategy.name)
            .bind(&strategy.description)
            .bind(strategy.max_trades_per_day)
            .bind(strategy.risk_percentage)
            .bind(strategy.stop_loss_percentage)
            .bind(strategy.take_profit_percentage)
            .bind(strategy.volume_threshold)
            .bind(strategy.updated_at)
            .bind(strategy_id)
            .execute(self.db_service.get_database().get_pool())
            .await?;
            
        info!("Updated strategy: {} ({})", strategy.name, strategy.id);
        Ok(strategy.clone())
    }
    
    /// Enable strategy
    pub async fn enable_strategy(&self, strategy_id: &str) -> Result<()> {
        let mut strategies = self.strategies.write().await;
        
        let strategy = strategies.get_mut(strategy_id)
            .ok_or_else(|| HedgeXError::NotFoundError(format!("Strategy not found: {}", strategy_id)))?;
            
        strategy.enable();
        
        // Update in database
        let query = "UPDATE strategy_params SET enabled = true, updated_at = ? WHERE id = ?";
        
        sqlx::query(query)
            .bind(strategy.updated_at)
            .bind(strategy_id)
            .execute(self.db_service.get_database().get_pool())
            .await?;
            
        info!("Enabled strategy: {} ({})", strategy.name, strategy.id);
        Ok(())
    }
    
    /// Disable strategy
    pub async fn disable_strategy(&self, strategy_id: &str) -> Result<()> {
        let mut strategies = self.strategies.write().await;
        
        let strategy = strategies.get_mut(strategy_id)
            .ok_or_else(|| HedgeXError::NotFoundError(format!("Strategy not found: {}", strategy_id)))?;
            
        strategy.disable();
        
        // Update in database
        let query = "UPDATE strategy_params SET enabled = false, updated_at = ? WHERE id = ?";
        
        sqlx::query(query)
            .bind(strategy.updated_at)
            .bind(strategy_id)
            .execute(self.db_service.get_database().get_pool())
            .await?;
            
        info!("Disabled strategy: {} ({})", strategy.name, strategy.id);
        Ok(())
    }
    
    /// Delete strategy
    pub async fn delete_strategy(&self, strategy_id: &str) -> Result<()> {
        // Remove from database
        let query = "DELETE FROM strategy_params WHERE id = ?";
        
        let result = sqlx::query(query)
            .bind(strategy_id)
            .execute(self.db_service.get_database().get_pool())
            .await?;
            
        if result.rows_affected() == 0 {
            return Err(HedgeXError::NotFoundError(format!("Strategy not found: {}", strategy_id)));
        }
        
        // Remove from in-memory cache
        {
            let mut strategies = self.strategies.write().await;
            strategies.remove(strategy_id);
        }
        
        info!("Deleted strategy: {}", strategy_id);
        Ok(())
    }
    
    /// Get active stock selections
    pub async fn get_active_stocks(&self) -> Result<Vec<StockSelection>> {
        let selections = self.stock_selections.read().await;
        Ok(selections.get(&self.user_id).cloned().unwrap_or_default())
    }
    
    /// Add stock to selection
    pub async fn add_stock(&self, symbol: &str, exchange: &str) -> Result<StockSelection> {
        let stock = StockSelection::new(&self.user_id, symbol, exchange);
        
        // Insert into database
        let query = "
            INSERT INTO stock_selection (id, user_id, symbol, exchange, is_active, added_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, symbol) DO UPDATE SET is_active = true
        ";
        
        sqlx::query(query)
            .bind(&stock.id)
            .bind(&stock.user_id)
            .bind(&stock.symbol)
            .bind(&stock.exchange)
            .bind(stock.is_active)
            .bind(stock.added_at)
            .execute(self.db_service.get_database().get_pool())
            .await?;
            
        // Add to in-memory cache
        {
            let mut selections = self.stock_selections.write().await;
            let user_stocks = selections.entry(self.user_id.clone()).or_insert_with(Vec::new);
            
            // Remove existing entry if present
            user_stocks.retain(|s| s.symbol != symbol);
            user_stocks.push(stock.clone());
        }
        
        info!("Added stock to selection: {} ({})", symbol, exchange);
        Ok(stock)
    }
    
    /// Remove stock from selection
    pub async fn remove_stock(&self, symbol: &str) -> Result<()> {
        // Update in database
        let query = "UPDATE stock_selection SET is_active = false WHERE user_id = ? AND symbol = ?";
        
        let result = sqlx::query(query)
            .bind(&self.user_id)
            .bind(symbol)
            .execute(self.db_service.get_database().get_pool())
            .await?;
            
        if result.rows_affected() == 0 {
            return Err(HedgeXError::NotFoundError(format!("Stock not found in selection: {}", symbol)));
        }
        
        // Remove from in-memory cache
        {
            let mut selections = self.stock_selections.write().await;
            if let Some(user_stocks) = selections.get_mut(&self.user_id) {
                user_stocks.retain(|s| s.symbol != symbol);
            }
        }
        
        info!("Removed stock from selection: {}", symbol);
        Ok(())
    }
    
    /// Validate strategy parameters
    pub fn validate_strategy_params(
        &self,
        max_trades_per_day: i32,
        risk_percentage: f64,
        stop_loss_percentage: f64,
        take_profit_percentage: f64,
        volume_threshold: i64,
    ) -> Result<()> {
        // Validate max trades per day
        if max_trades_per_day <= 0 || max_trades_per_day > 1000 {
            return Err(HedgeXError::ValidationError(
                "Max trades per day must be between 1 and 1000".to_string()
            ));
        }
        
        // Validate risk percentage
        if risk_percentage <= 0.0 || risk_percentage > 100.0 {
            return Err(HedgeXError::ValidationError(
                "Risk percentage must be between 0.1 and 100.0".to_string()
            ));
        }
        
        // Validate stop loss percentage
        if stop_loss_percentage <= 0.0 || stop_loss_percentage > 50.0 {
            return Err(HedgeXError::ValidationError(
                "Stop loss percentage must be between 0.1 and 50.0".to_string()
            ));
        }
        
        // Validate take profit percentage
        if take_profit_percentage <= 0.0 || take_profit_percentage > 100.0 {
            return Err(HedgeXError::ValidationError(
                "Take profit percentage must be between 0.1 and 100.0".to_string()
            ));
        }
        
        // Validate volume threshold
        if volume_threshold <= 0 {
            return Err(HedgeXError::ValidationError(
                "Volume threshold must be greater than 0".to_string()
            ));
        }
        
        // Validate that take profit is greater than stop loss
        if take_profit_percentage <= stop_loss_percentage {
            return Err(HedgeXError::ValidationError(
                "Take profit percentage must be greater than stop loss percentage".to_string()
            ));
        }
        
        Ok(())
    }
    
    /// Generate trading signal based on market data and strategy
    pub async fn generate_signal(
        &self,
        market_data: &MarketData,
        strategy_id: &str,
    ) -> Result<Option<TradingSignal>> {
        let strategies = self.strategies.read().await;
        
        let strategy = match strategies.get(strategy_id) {
            Some(s) if s.enabled => s,
            Some(_) => return Ok(None), // Strategy disabled
            None => return Err(HedgeXError::NotFoundError(format!("Strategy not found: {}", strategy_id))),
        };
        
        // Check if symbol is in active stock selection
        let selections = self.stock_selections.read().await;
        let empty_vec = Vec::new();
        let user_stocks = selections.get(&self.user_id).unwrap_or(&empty_vec);
        
        let is_active_stock = user_stocks.iter()
            .any(|s| s.symbol == market_data.symbol && s.is_active);
            
        if !is_active_stock {
            return Ok(None);
        }
        
        // Check volume threshold
        if market_data.volume < strategy.volume_threshold {
            debug!("Volume below threshold for {}: {} < {}", 
                   market_data.symbol, market_data.volume, strategy.volume_threshold);
            return Ok(None);
        }
        
        // Simple momentum-based signal generation
        // This is a basic implementation - in practice, you'd implement more sophisticated strategies
        let signal_type = self.calculate_momentum_signal(market_data)?;
        
        if signal_type == SignalType::Hold {
            return Ok(None);
        }
        
        let signal = TradingSignal {
            symbol: market_data.symbol.clone(),
            signal_type,
            strength: self.calculate_signal_strength(market_data)?,
            price: market_data.ltp,
            volume: market_data.volume,
            timestamp: Utc::now(),
            strategy_id: strategy_id.to_string(),
        };
        
        debug!("Generated signal for {}: {:?} (strength: {:.2})", 
               market_data.symbol, signal_type, signal.strength);
        
        Ok(Some(signal))
    }
    
    /// Calculate momentum-based signal
    fn calculate_momentum_signal(&self, market_data: &MarketData) -> Result<SignalType> {
        // Simple momentum calculation based on bid-ask spread and price change
        let spread = market_data.ask - market_data.bid;
        let mid_price = (market_data.bid + market_data.ask) / Decimal::from(2);
        
        // If current price is significantly above mid price, consider selling
        // If current price is significantly below mid price, consider buying
        let price_deviation = (market_data.ltp - mid_price) / mid_price;
        
        if price_deviation > Decimal::from_str("0.002").unwrap() { // 0.2% above mid
            Ok(SignalType::Sell)
        } else if price_deviation < Decimal::from_str("-0.002").unwrap() { // 0.2% below mid
            Ok(SignalType::Buy)
        } else {
            Ok(SignalType::Hold)
        }
    }
    
    /// Calculate signal strength
    fn calculate_signal_strength(&self, market_data: &MarketData) -> Result<f64> {
        // Calculate strength based on volume and price volatility
        let volume_factor = (market_data.volume as f64).log10() / 10.0; // Normalize volume
        let spread = market_data.ask - market_data.bid;
        let spread_factor = if market_data.ltp > Decimal::ZERO {
            (spread / market_data.ltp).to_f64().unwrap_or(0.0)
        } else {
            0.0
        };
        
        // Combine factors (higher volume = stronger signal, lower spread = stronger signal)
        let strength = (volume_factor * 0.7) + ((1.0 - spread_factor) * 0.3);
        
        // Clamp between 0.0 and 1.0
        Ok(strength.max(0.0).min(1.0))
    }
    
    /// Check if symbol should be traded based on strategy
    pub async fn should_trade_symbol(&self, symbol: &str, strategy_id: &str) -> Result<bool> {
        let strategies = self.strategies.read().await;
        
        let strategy = match strategies.get(strategy_id) {
            Some(s) => s,
            None => return Ok(false),
        };
        
        if !strategy.enabled {
            return Ok(false);
        }
        
        // Check if symbol is in active stock selection
        let selections = self.stock_selections.read().await;
        let empty_vec = Vec::new();
        let user_stocks = selections.get(&self.user_id).unwrap_or(&empty_vec);
        
        Ok(user_stocks.iter().any(|s| s.symbol == symbol && s.is_active))
    }
    
    /// Get strategy statistics
    pub async fn get_strategy_stats(&self, strategy_id: &str) -> Result<HashMap<String, serde_json::Value>> {
        let today = Utc::now().date_naive();
        
        // Get trade count for strategy today
        let trade_count_query = "
            SELECT COUNT(*) as count 
            FROM trades 
            WHERE strategy_id = ? AND DATE(executed_at) = ?
        ";
        
        let trade_count: i64 = sqlx::query(trade_count_query)
            .bind(strategy_id)
            .bind(today)
            .fetch_one(self.db_service.get_database().get_pool())
            .await?
            .get("count");
            
        // Get P&L for strategy today
        let pnl_query = "
            SELECT SUM(
                CASE 
                    WHEN trade_type = 'Buy' THEN -price * quantity
                    ELSE price * quantity
                END
            ) as pnl
            FROM trades 
            WHERE strategy_id = ? AND DATE(executed_at) = ? AND status = 'Executed'
        ";
        
        let pnl: Option<f64> = sqlx::query(pnl_query)
            .bind(strategy_id)
            .bind(today)
            .fetch_optional(self.db_service.get_database().get_pool())
            .await?
            .and_then(|row| row.get("pnl"));
            
        let mut stats = HashMap::new();
        stats.insert("trades_today".to_string(), serde_json::Value::Number(trade_count.into()));
        stats.insert("pnl_today".to_string(), serde_json::Value::Number(
            serde_json::Number::from_f64(pnl.unwrap_or(0.0)).unwrap_or(serde_json::Number::from(0))
        ));
        
        Ok(stats)
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
            "CREATE TABLE IF NOT EXISTS strategy_params (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                enabled BOOLEAN NOT NULL DEFAULT false,
                max_trades_per_day INTEGER NOT NULL DEFAULT 10,
                risk_percentage REAL NOT NULL DEFAULT 1.0,
                stop_loss_percentage REAL NOT NULL DEFAULT 0.5,
                take_profit_percentage REAL NOT NULL DEFAULT 1.5,
                volume_threshold INTEGER NOT NULL DEFAULT 100000,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"
        )
        .execute(db_service.get_database().get_pool())
        .await
        .unwrap();
        
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS stock_selection (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                exchange TEXT NOT NULL DEFAULT 'NSE',
                is_active BOOLEAN NOT NULL DEFAULT true,
                added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, symbol)
            )"
        )
        .execute(db_service.get_database().get_pool())
        .await
        .unwrap();
        
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
        
        (Arc::new(db_service), db_path)
    }
    
    #[tokio::test]
    async fn test_strategy_manager_creation() {
        let (db_service, _) = setup_test_db().await;
        
        let manager = StrategyManager::new(db_service, "test_user")
            .await
            .unwrap();
            
        assert_eq!(manager.user_id, "test_user");
    }
    
    #[tokio::test]
    async fn test_create_strategy() {
        let (db_service, _) = setup_test_db().await;
        
        let manager = StrategyManager::new(db_service, "test_user")
            .await
            .unwrap();
            
        let strategy = manager.create_strategy(
            "Test Strategy",
            Some("Test description".to_string()),
            10,
            2.0,
            1.0,
            3.0,
            100000,
        ).await.unwrap();
        
        assert_eq!(strategy.name, "Test Strategy");
        assert_eq!(strategy.max_trades_per_day, 10);
        assert!(!strategy.enabled);
    }
    
    #[tokio::test]
    async fn test_add_stock_selection() {
        let (db_service, _) = setup_test_db().await;
        
        let manager = StrategyManager::new(db_service, "test_user")
            .await
            .unwrap();
            
        let stock = manager.add_stock("INFY", "NSE").await.unwrap();
        
        assert_eq!(stock.symbol, "INFY");
        assert_eq!(stock.exchange, "NSE");
        assert!(stock.is_active);
        
        let active_stocks = manager.get_active_stocks().await.unwrap();
        assert_eq!(active_stocks.len(), 1);
        assert_eq!(active_stocks[0].symbol, "INFY");
    }
    
    #[tokio::test]
    async fn test_strategy_validation() {
        let (db_service, _) = setup_test_db().await;
        
        let manager = StrategyManager::new(db_service, "test_user")
            .await
            .unwrap();
            
        // Valid parameters
        assert!(manager.validate_strategy_params(10, 2.0, 1.0, 3.0, 100000).is_ok());
        
        // Invalid parameters
        assert!(manager.validate_strategy_params(0, 2.0, 1.0, 3.0, 100000).is_err()); // Invalid max trades
        assert!(manager.validate_strategy_params(10, 0.0, 1.0, 3.0, 100000).is_err()); // Invalid risk
        assert!(manager.validate_strategy_params(10, 2.0, 0.0, 3.0, 100000).is_err()); // Invalid stop loss
        assert!(manager.validate_strategy_params(10, 2.0, 3.0, 1.0, 100000).is_err()); // Take profit < stop loss
    }
}