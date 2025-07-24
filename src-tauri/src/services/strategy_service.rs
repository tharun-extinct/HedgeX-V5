use crate::error::{HedgeXError, Result};
use crate::models::trading::{StrategyParams, StockSelection, PerformanceMetrics};
use crate::services::enhanced_database_service::EnhancedDatabaseService;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::sync::Arc;
use std::str::FromStr;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
use chrono::{DateTime, Utc, NaiveDate};
use uuid::Uuid;
use sqlx::Row;
use serde::{Deserialize, Serialize};

/// Request model for creating a strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateStrategyRequest {
    pub name: String,
    pub description: Option<String>,
    pub max_trades_per_day: i32,
    pub risk_percentage: f64,
    pub stop_loss_percentage: f64,
    pub take_profit_percentage: f64,
    pub volume_threshold: i64,
}

/// Request model for updating a strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStrategyRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub max_trades_per_day: Option<i32>,
    pub risk_percentage: Option<f64>,
    pub stop_loss_percentage: Option<f64>,
    pub take_profit_percentage: Option<f64>,
    pub volume_threshold: Option<i64>,
}

/// Strategy performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyPerformance {
    pub id: String,
    pub user_id: String,
    pub strategy_id: String,
    pub date: NaiveDate,
    pub total_trades: i32,
    pub profitable_trades: i32,
    pub total_pnl: f64,
    pub max_drawdown: f64,
    pub win_rate: f64,
    pub profit_factor: f64,
    pub sharpe_ratio: f64,
    pub average_trade_duration: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// NIFTY 50 stock list
const NIFTY_50_STOCKS: &[(&str, &str)] = &[
    ("RELIANCE", "Reliance Industries Ltd"),
    ("TCS", "Tata Consultancy Services Ltd"),
    ("HDFCBANK", "HDFC Bank Ltd"),
    ("INFY", "Infosys Ltd"),
    ("HINDUNILVR", "Hindustan Unilever Ltd"),
    ("ICICIBANK", "ICICI Bank Ltd"),
    ("KOTAKBANK", "Kotak Mahindra Bank Ltd"),
    ("HDFC", "Housing Development Finance Corporation Ltd"),
    ("BHARTIARTL", "Bharti Airtel Ltd"),
    ("ITC", "ITC Ltd"),
    ("SBIN", "State Bank of India"),
    ("BAJFINANCE", "Bajaj Finance Ltd"),
    ("LICI", "Life Insurance Corporation of India"),
    ("ASIANPAINT", "Asian Paints Ltd"),
    ("MARUTI", "Maruti Suzuki India Ltd"),
    ("SUNPHARMA", "Sun Pharmaceutical Industries Ltd"),
    ("TITAN", "Titan Company Ltd"),
    ("ULTRACEMCO", "UltraTech Cement Ltd"),
    ("ONGC", "Oil & Natural Gas Corporation Ltd"),
    ("AXISBANK", "Axis Bank Ltd"),
    ("NESTLEIND", "Nestle India Ltd"),
    ("NTPC", "NTPC Ltd"),
    ("POWERGRID", "Power Grid Corporation of India Ltd"),
    ("LTIM", "LTIMindtree Ltd"),
    ("BAJAJFINSV", "Bajaj Finserv Ltd"),
    ("WIPRO", "Wipro Ltd"),
    ("ADANIENT", "Adani Enterprises Ltd"),
    ("COALINDIA", "Coal India Ltd"),
    ("HCLTECH", "HCL Technologies Ltd"),
    ("JSWSTEEL", "JSW Steel Ltd"),
    ("GRASIM", "Grasim Industries Ltd"),
    ("BRITANNIA", "Britannia Industries Ltd"),
    ("CIPLA", "Cipla Ltd"),
    ("TECHM", "Tech Mahindra Ltd"),
    ("BPCL", "Bharat Petroleum Corporation Ltd"),
    ("EICHERMOT", "Eicher Motors Ltd"),
    ("APOLLOHOSP", "Apollo Hospitals Enterprise Ltd"),
    ("HINDALCO", "Hindalco Industries Ltd"),
    ("INDUSINDBK", "IndusInd Bank Ltd"),
    ("DRREDDY", "Dr. Reddy's Laboratories Ltd"),
    ("ADANIPORTS", "Adani Ports and Special Economic Zone Ltd"),
    ("DIVISLAB", "Divi's Laboratories Ltd"),
    ("TATACONSUM", "Tata Consumer Products Ltd"),
    ("HEROMOTOCO", "Hero MotoCorp Ltd"),
    ("BAJAJ-AUTO", "Bajaj Auto Ltd"),
    ("TATAMOTORS", "Tata Motors Ltd"),
    ("SBILIFE", "SBI Life Insurance Company Ltd"),
    ("HDFCLIFE", "HDFC Life Insurance Company Ltd"),
    ("TATASTEEL", "Tata Steel Ltd"),
    ("SHRIRAMFIN", "Shriram Finance Ltd"),
];

/// Strategy service for managing trading strategies and stock selections
pub struct StrategyService {
    db_service: Arc<EnhancedDatabaseService>,
    strategies_cache: Arc<RwLock<HashMap<String, HashMap<String, StrategyParams>>>>, // user_id -> strategy_id -> strategy
    stock_selections_cache: Arc<RwLock<HashMap<String, Vec<StockSelection>>>>, // user_id -> selections
}

impl StrategyService {
    /// Create a new strategy service
    pub async fn new(db_service: Arc<EnhancedDatabaseService>) -> Result<Self> {
        let service = Self {
            db_service,
            strategies_cache: Arc::new(RwLock::new(HashMap::new())),
            stock_selections_cache: Arc::new(RwLock::new(HashMap::new())),
        };
        
        info!("StrategyService initialized successfully");
        Ok(service)
    }
    
    /// Load strategies for a user from database
    async fn load_user_strategies(&self, user_id: &str) -> Result<()> {
        let query = "
            SELECT id, user_id, name, description, enabled, max_trades_per_day,
                   risk_percentage, stop_loss_percentage, take_profit_percentage,
                   volume_threshold, created_at, updated_at
            FROM strategy_params 
            WHERE user_id = ?
        ";
        
        let rows = sqlx::query(query)
            .bind(user_id)
            .fetch_all(self.db_service.get_database().get_pool())
            .await?;
            
        let mut strategies_cache = self.strategies_cache.write().await;
        let user_strategies = strategies_cache.entry(user_id.to_string()).or_insert_with(HashMap::new);
        
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
            
            user_strategies.insert(strategy.id.clone(), strategy);
        }
        
        info!("Loaded {} strategies for user {}", user_strategies.len(), user_id);
        Ok(())
    }
    
    /// Load stock selections for a user from database
    async fn load_user_stock_selections(&self, user_id: &str) -> Result<()> {
        let query = "
            SELECT id, user_id, symbol, exchange, is_active, added_at
            FROM stock_selection 
            WHERE user_id = ?
        ";
        
        let rows = sqlx::query(query)
            .bind(user_id)
            .fetch_all(self.db_service.get_database().get_pool())
            .await?;
            
        let mut selections_cache = self.stock_selections_cache.write().await;
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
        
        selections_cache.insert(user_id.to_string(), user_selections);
        
        let count = selections_cache.get(user_id).map(|s| s.len()).unwrap_or(0);
        info!("Loaded {} stock selections for user {}", count, user_id);
        Ok(())
    }
    
    /// Get all strategies for a user
    pub async fn get_strategies(&self, user_id: &str) -> Result<Vec<StrategyParams>> {
        // Load from database if not in cache
        {
            let cache = self.strategies_cache.read().await;
            if !cache.contains_key(user_id) {
                drop(cache);
                self.load_user_strategies(user_id).await?;
            }
        }
        
        let cache = self.strategies_cache.read().await;
        let strategies = cache.get(user_id)
            .map(|user_strategies| user_strategies.values().cloned().collect())
            .unwrap_or_default();
            
        Ok(strategies)
    }
    
    /// Get a specific strategy by ID
    pub async fn get_strategy(&self, user_id: &str, strategy_id: &str) -> Result<Option<StrategyParams>> {
        // Load from database if not in cache
        {
            let cache = self.strategies_cache.read().await;
            if !cache.contains_key(user_id) {
                drop(cache);
                self.load_user_strategies(user_id).await?;
            }
        }
        
        let cache = self.strategies_cache.read().await;
        let strategy = cache.get(user_id)
            .and_then(|user_strategies| user_strategies.get(strategy_id))
            .cloned();
            
        Ok(strategy)
    }
    
    /// Create a new strategy
    pub async fn create_strategy(&self, user_id: &str, request: CreateStrategyRequest) -> Result<StrategyParams> {
        // Validate parameters
        self.validate_strategy_params(
            request.max_trades_per_day,
            request.risk_percentage,
            request.stop_loss_percentage,
            request.take_profit_percentage,
            request.volume_threshold,
        )?;
        
        let strategy = StrategyParams::new(
            user_id,
            &request.name,
            request.description,
            request.max_trades_per_day,
            request.risk_percentage,
            request.stop_loss_percentage,
            request.take_profit_percentage,
            request.volume_threshold,
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
            
        // Update cache
        {
            let mut cache = self.strategies_cache.write().await;
            let user_strategies = cache.entry(user_id.to_string()).or_insert_with(HashMap::new);
            user_strategies.insert(strategy.id.clone(), strategy.clone());
        }
        
        info!("Created new strategy: {} ({}) for user {}", strategy.name, strategy.id, user_id);
        Ok(strategy)
    }
    
    /// Update an existing strategy
    pub async fn update_strategy(&self, user_id: &str, strategy_id: &str, request: UpdateStrategyRequest) -> Result<StrategyParams> {
        // Validate parameters if provided
        if let (Some(max_trades), Some(risk), Some(stop_loss), Some(take_profit), Some(volume)) = (
            request.max_trades_per_day,
            request.risk_percentage,
            request.stop_loss_percentage,
            request.take_profit_percentage,
            request.volume_threshold,
        ) {
            self.validate_strategy_params(max_trades, risk, stop_loss, take_profit, volume)?;
        }
        
        // Load from database if not in cache
        {
            let cache = self.strategies_cache.read().await;
            if !cache.contains_key(user_id) {
                drop(cache);
                self.load_user_strategies(user_id).await?;
            }
        }
        
        let mut strategy = {
            let cache = self.strategies_cache.read().await;
            cache.get(user_id)
                .and_then(|user_strategies| user_strategies.get(strategy_id))
                .cloned()
                .ok_or_else(|| HedgeXError::NotFoundError(format!("Strategy not found: {}", strategy_id)))?
        };
        
        // Update strategy parameters
        strategy.update(
            request.name,
            request.description,
            request.max_trades_per_day,
            request.risk_percentage,
            request.stop_loss_percentage,
            request.take_profit_percentage,
            request.volume_threshold,
        );
        
        // Update in database
        let query = "
            UPDATE strategy_params 
            SET name = ?, description = ?, max_trades_per_day = ?,
                risk_percentage = ?, stop_loss_percentage = ?, 
                take_profit_percentage = ?, volume_threshold = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
        ";
        
        let result = sqlx::query(query)
            .bind(&strategy.name)
            .bind(&strategy.description)
            .bind(strategy.max_trades_per_day)
            .bind(strategy.risk_percentage)
            .bind(strategy.stop_loss_percentage)
            .bind(strategy.take_profit_percentage)
            .bind(strategy.volume_threshold)
            .bind(strategy.updated_at)
            .bind(strategy_id)
            .bind(user_id)
            .execute(self.db_service.get_database().get_pool())
            .await?;
            
        if result.rows_affected() == 0 {
            return Err(HedgeXError::NotFoundError(format!("Strategy not found: {}", strategy_id)));
        }
        
        // Update cache
        {
            let mut cache = self.strategies_cache.write().await;
            if let Some(user_strategies) = cache.get_mut(user_id) {
                user_strategies.insert(strategy_id.to_string(), strategy.clone());
            }
        }
        
        info!("Updated strategy: {} ({}) for user {}", strategy.name, strategy.id, user_id);
        Ok(strategy)
    }
    
    /// Enable a strategy
    pub async fn enable_strategy(&self, user_id: &str, strategy_id: &str) -> Result<()> {
        // Update in database
        let query = "UPDATE strategy_params SET enabled = true, updated_at = ? WHERE id = ? AND user_id = ?";
        
        let result = sqlx::query(query)
            .bind(Utc::now())
            .bind(strategy_id)
            .bind(user_id)
            .execute(self.db_service.get_database().get_pool())
            .await?;
            
        if result.rows_affected() == 0 {
            return Err(HedgeXError::NotFoundError(format!("Strategy not found: {}", strategy_id)));
        }
        
        // Update cache
        {
            let mut cache = self.strategies_cache.write().await;
            if let Some(user_strategies) = cache.get_mut(user_id) {
                if let Some(strategy) = user_strategies.get_mut(strategy_id) {
                    strategy.enable();
                }
            }
        }
        
        info!("Enabled strategy {} for user {}", strategy_id, user_id);
        Ok(())
    }
    
    /// Disable a strategy
    pub async fn disable_strategy(&self, user_id: &str, strategy_id: &str) -> Result<()> {
        // Update in database
        let query = "UPDATE strategy_params SET enabled = false, updated_at = ? WHERE id = ? AND user_id = ?";
        
        let result = sqlx::query(query)
            .bind(Utc::now())
            .bind(strategy_id)
            .bind(user_id)
            .execute(self.db_service.get_database().get_pool())
            .await?;
            
        if result.rows_affected() == 0 {
            return Err(HedgeXError::NotFoundError(format!("Strategy not found: {}", strategy_id)));
        }
        
        // Update cache
        {
            let mut cache = self.strategies_cache.write().await;
            if let Some(user_strategies) = cache.get_mut(user_id) {
                if let Some(strategy) = user_strategies.get_mut(strategy_id) {
                    strategy.disable();
                }
            }
        }
        
        info!("Disabled strategy {} for user {}", strategy_id, user_id);
        Ok(())
    }
    
    /// Delete a strategy
    pub async fn delete_strategy(&self, user_id: &str, strategy_id: &str) -> Result<()> {
        // Remove from database
        let query = "DELETE FROM strategy_params WHERE id = ? AND user_id = ?";
        
        let result = sqlx::query(query)
            .bind(strategy_id)
            .bind(user_id)
            .execute(self.db_service.get_database().get_pool())
            .await?;
            
        if result.rows_affected() == 0 {
            return Err(HedgeXError::NotFoundError(format!("Strategy not found: {}", strategy_id)));
        }
        
        // Remove from cache
        {
            let mut cache = self.strategies_cache.write().await;
            if let Some(user_strategies) = cache.get_mut(user_id) {
                user_strategies.remove(strategy_id);
            }
        }
        
        info!("Deleted strategy {} for user {}", strategy_id, user_id);
        Ok(())
    }
    
    /// Get NIFTY 50 stock list
    pub fn get_nifty_50_stocks(&self) -> Vec<(String, String)> {
        NIFTY_50_STOCKS.iter()
            .map(|(symbol, name)| (symbol.to_string(), name.to_string()))
            .collect()
    }
    
    /// Get stock selections for a user
    pub async fn get_stock_selections(&self, user_id: &str) -> Result<Vec<StockSelection>> {
        // Load from database if not in cache
        {
            let cache = self.stock_selections_cache.read().await;
            if !cache.contains_key(user_id) {
                drop(cache);
                self.load_user_stock_selections(user_id).await?;
            }
        }
        
        let cache = self.stock_selections_cache.read().await;
        let selections = cache.get(user_id).cloned().unwrap_or_default();
        
        Ok(selections)
    }
    
    /// Get active stock selections for a user
    pub async fn get_active_stock_selections(&self, user_id: &str) -> Result<Vec<StockSelection>> {
        let selections = self.get_stock_selections(user_id).await?;
        Ok(selections.into_iter().filter(|s| s.is_active).collect())
    }
    
    /// Add stock to selection
    pub async fn add_stock_selection(&self, user_id: &str, symbol: &str, exchange: &str) -> Result<StockSelection> {
        // Validate that the symbol is in NIFTY 50
        let is_valid_symbol = NIFTY_50_STOCKS.iter().any(|(s, _)| s == &symbol);
        if !is_valid_symbol {
            return Err(HedgeXError::ValidationError(format!("Symbol {} is not in NIFTY 50", symbol)));
        }
        
        let stock = StockSelection::new(user_id, symbol, exchange);
        
        // Insert into database (with conflict resolution)
        let query = "
            INSERT INTO stock_selection (id, user_id, symbol, exchange, is_active, added_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, symbol) DO UPDATE SET 
                is_active = true,
                exchange = excluded.exchange,
                added_at = excluded.added_at
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
            
        // Update cache
        {
            let mut cache = self.stock_selections_cache.write().await;
            let user_selections = cache.entry(user_id.to_string()).or_insert_with(Vec::new);
            
            // Remove existing entry if present
            user_selections.retain(|s| s.symbol != symbol);
            user_selections.push(stock.clone());
        }
        
        info!("Added stock selection: {} ({}) for user {}", symbol, exchange, user_id);
        Ok(stock)
    }
    
    /// Remove stock from selection
    pub async fn remove_stock_selection(&self, user_id: &str, symbol: &str) -> Result<()> {
        // Update in database
        let query = "UPDATE stock_selection SET is_active = false WHERE user_id = ? AND symbol = ?";
        
        let result = sqlx::query(query)
            .bind(user_id)
            .bind(symbol)
            .execute(self.db_service.get_database().get_pool())
            .await?;
            
        if result.rows_affected() == 0 {
            return Err(HedgeXError::NotFoundError(format!("Stock selection not found: {}", symbol)));
        }
        
        // Update cache
        {
            let mut cache = self.stock_selections_cache.write().await;
            if let Some(user_selections) = cache.get_mut(user_id) {
                if let Some(selection) = user_selections.iter_mut().find(|s| s.symbol == symbol) {
                    selection.deactivate();
                }
            }
        }
        
        info!("Removed stock selection: {} for user {}", symbol, user_id);
        Ok(())
    }
    
    /// Bulk add stock selections
    pub async fn bulk_add_stock_selections(&self, user_id: &str, symbols: Vec<String>, exchange: &str) -> Result<Vec<StockSelection>> {
        let mut results = Vec::new();
        
        for symbol in symbols {
            match self.add_stock_selection(user_id, &symbol, exchange).await {
                Ok(selection) => results.push(selection),
                Err(e) => {
                    warn!("Failed to add stock selection {}: {}", symbol, e);
                    // Continue with other symbols
                }
            }
        }
        
        info!("Bulk added {} stock selections for user {}", results.len(), user_id);
        Ok(results)
    }
    
    /// Bulk remove stock selections
    pub async fn bulk_remove_stock_selections(&self, user_id: &str, symbols: Vec<String>) -> Result<()> {
        let mut errors = Vec::new();
        
        for symbol in symbols {
            if let Err(e) = self.remove_stock_selection(user_id, &symbol).await {
                warn!("Failed to remove stock selection {}: {}", symbol, e);
                errors.push((symbol, e));
            }
        }
        
        if !errors.is_empty() {
            return Err(HedgeXError::ValidationError(format!("Failed to remove {} stock selections", errors.len())));
        }
        
        info!("Bulk removed stock selections for user {}", user_id);
        Ok(())
    }
    
    /// Get strategy performance metrics
    pub async fn get_strategy_performance(&self, user_id: &str, strategy_id: &str, days: Option<i32>) -> Result<Vec<StrategyPerformance>> {
        let days = days.unwrap_or(30); // Default to 30 days
        
        let query = "
            SELECT id, user_id, strategy_id, date, total_trades, profitable_trades,
                   total_pnl, max_drawdown, win_rate, profit_factor, sharpe_ratio,
                   average_trade_duration, created_at, updated_at
            FROM strategy_performance 
            WHERE user_id = ? AND strategy_id = ? AND date >= date('now', '-' || ? || ' days')
            ORDER BY date DESC
        ";
        
        let rows = sqlx::query(query)
            .bind(user_id)
            .bind(strategy_id)
            .bind(days)
            .fetch_all(self.db_service.get_database().get_pool())
            .await?;
            
        let mut performance = Vec::new();
        
        for row in rows {
            let perf = StrategyPerformance {
                id: row.get("id"),
                user_id: row.get("user_id"),
                strategy_id: row.get("strategy_id"),
                date: row.get("date"),
                total_trades: row.get("total_trades"),
                profitable_trades: row.get("profitable_trades"),
                total_pnl: row.get("total_pnl"),
                max_drawdown: row.get("max_drawdown"),
                win_rate: row.get("win_rate"),
                profit_factor: row.get("profit_factor"),
                sharpe_ratio: row.get("sharpe_ratio"),
                average_trade_duration: row.get("average_trade_duration"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            };
            
            performance.push(perf);
        }
        
        Ok(performance)
    }
    
    /// Update strategy performance metrics
    pub async fn update_strategy_performance(&self, user_id: &str, strategy_id: &str, metrics: PerformanceMetrics) -> Result<()> {
        let query = "
            INSERT INTO strategy_performance 
            (id, user_id, strategy_id, date, total_trades, profitable_trades,
             total_pnl, max_drawdown, win_rate, profit_factor, sharpe_ratio,
             average_trade_duration, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, strategy_id, date) DO UPDATE SET
                total_trades = excluded.total_trades,
                profitable_trades = excluded.profitable_trades,
                total_pnl = excluded.total_pnl,
                max_drawdown = excluded.max_drawdown,
                win_rate = excluded.win_rate,
                profit_factor = excluded.profit_factor,
                sharpe_ratio = excluded.sharpe_ratio,
                average_trade_duration = excluded.average_trade_duration,
                updated_at = excluded.updated_at
        ";
        
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        
        sqlx::query(query)
            .bind(&id)
            .bind(user_id)
            .bind(strategy_id)
            .bind(metrics.date)
            .bind(metrics.total_trades)
            .bind(metrics.profitable_trades)
            .bind(metrics.total_pnl.to_f64().unwrap_or(0.0))
            .bind(metrics.max_drawdown.to_f64().unwrap_or(0.0))
            .bind(metrics.win_rate)
            .bind(metrics.profit_factor)
            .bind(metrics.sharpe_ratio)
            .bind(metrics.average_trade_duration)
            .bind(now)
            .bind(now)
            .execute(self.db_service.get_database().get_pool())
            .await?;
            
        debug!("Updated strategy performance for strategy {} on {}", strategy_id, metrics.date);
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
    
    /// Get strategy statistics
    pub async fn get_strategy_stats(&self, user_id: &str, strategy_id: &str) -> Result<HashMap<String, serde_json::Value>> {
        let today = Utc::now().date_naive();
        
        // Get trade count for strategy today
        let trade_count_query = "
            SELECT COUNT(*) as count 
            FROM trades 
            WHERE user_id = ? AND strategy_id = ? AND DATE(executed_at) = ?
        ";
        
        let trade_count: i64 = sqlx::query(trade_count_query)
            .bind(user_id)
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
            WHERE user_id = ? AND strategy_id = ? AND DATE(executed_at) = ? AND status = 'Executed'
        ";
        
        let pnl: Option<f64> = sqlx::query(pnl_query)
            .bind(user_id)
            .bind(strategy_id)
            .bind(today)
            .fetch_optional(self.db_service.get_database().get_pool())
            .await?
            .and_then(|row| row.get("pnl"));
            
        // Get total trades for strategy (all time)
        let total_trades_query = "
            SELECT COUNT(*) as count 
            FROM trades 
            WHERE user_id = ? AND strategy_id = ?
        ";
        
        let total_trades: i64 = sqlx::query(total_trades_query)
            .bind(user_id)
            .bind(strategy_id)
            .fetch_one(self.db_service.get_database().get_pool())
            .await?
            .get("count");
        
        let mut stats = HashMap::new();
        stats.insert("trades_today".to_string(), serde_json::Value::Number(trade_count.into()));
        stats.insert("pnl_today".to_string(), serde_json::Value::Number(
            serde_json::Number::from_f64(pnl.unwrap_or(0.0)).unwrap_or(serde_json::Number::from(0))
        ));
        stats.insert("total_trades".to_string(), serde_json::Value::Number(total_trades.into()));
        
        Ok(stats)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::enhanced_database_service::EnhancedDatabaseService;
    use tempfile::tempdir;
    use std::path::PathBuf;
    use tokio;
    
    async fn setup_test_db() -> (Arc<EnhancedDatabaseService>, PathBuf) {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().to_path_buf();
        
        let db_service = EnhancedDatabaseService::new(&db_path, "test_password")
            .await
            .unwrap();
            
        // Create required tables
        let database = db_service.get_database();
        let pool = database.get_pool();
        
        // Users table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )"
        )
        .execute(pool)
        .await
        .unwrap();
        
        // Strategy params table
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
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )"
        )
        .execute(pool)
        .await
        .unwrap();
        
        // Stock selection table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS stock_selection (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                exchange TEXT NOT NULL DEFAULT 'NSE',
                is_active BOOLEAN NOT NULL DEFAULT true,
                added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, symbol)
            )"
        )
        .execute(pool)
        .await
        .unwrap();
        
        // Trades table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS trades (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                exchange TEXT NOT NULL,
                order_id TEXT,
                trade_type TEXT NOT NULL CHECK(trade_type IN ('Buy', 'Sell')),
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('Pending', 'Executed', 'Cancelled', 'Failed')),
                executed_at TIMESTAMP NOT NULL,
                strategy_id TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (strategy_id) REFERENCES strategy_params(id) ON DELETE CASCADE
            )"
        )
        .execute(pool)
        .await
        .unwrap();
        
        // Strategy performance table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS strategy_performance (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                strategy_id TEXT NOT NULL,
                date DATE NOT NULL,
                total_trades INTEGER NOT NULL DEFAULT 0,
                profitable_trades INTEGER NOT NULL DEFAULT 0,
                total_pnl REAL NOT NULL DEFAULT 0.0,
                max_drawdown REAL NOT NULL DEFAULT 0.0,
                win_rate REAL NOT NULL DEFAULT 0.0,
                profit_factor REAL NOT NULL DEFAULT 0.0,
                sharpe_ratio REAL NOT NULL DEFAULT 0.0,
                average_trade_duration INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (strategy_id) REFERENCES strategy_params(id) ON DELETE CASCADE,
                UNIQUE(user_id, strategy_id, date)
            )"
        )
        .execute(pool)
        .await
        .unwrap();
        
        // Insert test user
        sqlx::query("INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)")
            .bind("test_user")
            .bind("testuser")
            .bind("hashed_password")
            .execute(pool)
            .await
            .unwrap();
        
        (Arc::new(db_service), db_path)
    }
    
    #[tokio::test]
    async fn test_strategy_service_creation() {
        let (db_service, _) = setup_test_db().await;
        
        let service = StrategyService::new(db_service).await.unwrap();
        
        // Service should be created successfully
        assert!(true);
    }
    
    #[tokio::test]
    async fn test_create_strategy() {
        let (db_service, _) = setup_test_db().await;
        let service = StrategyService::new(db_service).await.unwrap();
        
        let request = CreateStrategyRequest {
            name: "Test Strategy".to_string(),
            description: Some("Test description".to_string()),
            max_trades_per_day: 10,
            risk_percentage: 2.0,
            stop_loss_percentage: 1.0,
            take_profit_percentage: 3.0,
            volume_threshold: 100000,
        };
        
        let strategy = service.create_strategy("test_user", request).await.unwrap();
        
        assert_eq!(strategy.name, "Test Strategy");
        assert_eq!(strategy.user_id, "test_user");
        assert_eq!(strategy.max_trades_per_day, 10);
        assert_eq!(strategy.risk_percentage, 2.0);
        assert!(!strategy.enabled); // Should be disabled by default
    }
    
    #[tokio::test]
    async fn test_get_strategies() {
        let (db_service, _) = setup_test_db().await;
        let service = StrategyService::new(db_service).await.unwrap();
        
        // Create a test strategy
        let request = CreateStrategyRequest {
            name: "Test Strategy".to_string(),
            description: None,
            max_trades_per_day: 5,
            risk_percentage: 1.5,
            stop_loss_percentage: 0.8,
            take_profit_percentage: 2.0,
            volume_threshold: 50000,
        };
        
        let created_strategy = service.create_strategy("test_user", request).await.unwrap();
        
        // Get all strategies
        let strategies = service.get_strategies("test_user").await.unwrap();
        
        assert_eq!(strategies.len(), 1);
        assert_eq!(strategies[0].id, created_strategy.id);
        assert_eq!(strategies[0].name, "Test Strategy");
    }
    
    #[tokio::test]
    async fn test_update_strategy() {
        let (db_service, _) = setup_test_db().await;
        let service = StrategyService::new(db_service).await.unwrap();
        
        // Create a test strategy
        let create_request = CreateStrategyRequest {
            name: "Original Strategy".to_string(),
            description: None,
            max_trades_per_day: 5,
            risk_percentage: 1.5,
            stop_loss_percentage: 0.8,
            take_profit_percentage: 2.0,
            volume_threshold: 50000,
        };
        
        let strategy = service.create_strategy("test_user", create_request).await.unwrap();
        
        // Update the strategy
        let update_request = UpdateStrategyRequest {
            name: Some("Updated Strategy".to_string()),
            description: Some("Updated description".to_string()),
            max_trades_per_day: Some(15),
            risk_percentage: Some(2.5),
            stop_loss_percentage: None,
            take_profit_percentage: None,
            volume_threshold: None,
        };
        
        let updated_strategy = service.update_strategy("test_user", &strategy.id, update_request).await.unwrap();
        
        assert_eq!(updated_strategy.name, "Updated Strategy");
        assert_eq!(updated_strategy.description, Some("Updated description".to_string()));
        assert_eq!(updated_strategy.max_trades_per_day, 15);
        assert_eq!(updated_strategy.risk_percentage, 2.5);
        // Unchanged values should remain the same
        assert_eq!(updated_strategy.stop_loss_percentage, 0.8);
        assert_eq!(updated_strategy.take_profit_percentage, 2.0);
        assert_eq!(updated_strategy.volume_threshold, 50000);
    }
    
    #[tokio::test]
    async fn test_enable_disable_strategy() {
        let (db_service, _) = setup_test_db().await;
        let service = StrategyService::new(db_service).await.unwrap();
        
        // Create a test strategy
        let request = CreateStrategyRequest {
            name: "Test Strategy".to_string(),
            description: None,
            max_trades_per_day: 5,
            risk_percentage: 1.5,
            stop_loss_percentage: 0.8,
            take_profit_percentage: 2.0,
            volume_threshold: 50000,
        };
        
        let strategy = service.create_strategy("test_user", request).await.unwrap();
        assert!(!strategy.enabled);
        
        // Enable the strategy
        service.enable_strategy("test_user", &strategy.id).await.unwrap();
        
        let enabled_strategy = service.get_strategy("test_user", &strategy.id).await.unwrap().unwrap();
        assert!(enabled_strategy.enabled);
        
        // Disable the strategy
        service.disable_strategy("test_user", &strategy.id).await.unwrap();
        
        let disabled_strategy = service.get_strategy("test_user", &strategy.id).await.unwrap().unwrap();
        assert!(!disabled_strategy.enabled);
    }
    
    #[tokio::test]
    async fn test_delete_strategy() {
        let (db_service, _) = setup_test_db().await;
        let service = StrategyService::new(db_service).await.unwrap();
        
        // Create a test strategy
        let request = CreateStrategyRequest {
            name: "Test Strategy".to_string(),
            description: None,
            max_trades_per_day: 5,
            risk_percentage: 1.5,
            stop_loss_percentage: 0.8,
            take_profit_percentage: 2.0,
            volume_threshold: 50000,
        };
        
        let strategy = service.create_strategy("test_user", request).await.unwrap();
        
        // Verify strategy exists
        let found_strategy = service.get_strategy("test_user", &strategy.id).await.unwrap();
        assert!(found_strategy.is_some());
        
        // Delete the strategy
        service.delete_strategy("test_user", &strategy.id).await.unwrap();
        
        // Verify strategy is deleted
        let deleted_strategy = service.get_strategy("test_user", &strategy.id).await.unwrap();
        assert!(deleted_strategy.is_none());
    }
    
    #[tokio::test]
    async fn test_nifty_50_stocks() {
        let (db_service, _) = setup_test_db().await;
        let service = StrategyService::new(db_service).await.unwrap();
        
        let stocks = service.get_nifty_50_stocks();
        
        assert_eq!(stocks.len(), 50);
        assert!(stocks.iter().any(|(symbol, _)| symbol == "RELIANCE"));
        assert!(stocks.iter().any(|(symbol, _)| symbol == "TCS"));
        assert!(stocks.iter().any(|(symbol, _)| symbol == "INFY"));
    }
    
    #[tokio::test]
    async fn test_stock_selection_operations() {
        let (db_service, _) = setup_test_db().await;
        let service = StrategyService::new(db_service).await.unwrap();
        
        // Add stock selection
        let selection = service.add_stock_selection("test_user", "RELIANCE", "NSE").await.unwrap();
        
        assert_eq!(selection.symbol, "RELIANCE");
        assert_eq!(selection.exchange, "NSE");
        assert!(selection.is_active);
        
        // Get stock selections
        let selections = service.get_stock_selections("test_user").await.unwrap();
        assert_eq!(selections.len(), 1);
        assert_eq!(selections[0].symbol, "RELIANCE");
        
        // Get active stock selections
        let active_selections = service.get_active_stock_selections("test_user").await.unwrap();
        assert_eq!(active_selections.len(), 1);
        
        // Remove stock selection
        service.remove_stock_selection("test_user", "RELIANCE").await.unwrap();
        
        let active_after_removal = service.get_active_stock_selections("test_user").await.unwrap();
        assert_eq!(active_after_removal.len(), 0);
    }
    
    #[tokio::test]
    async fn test_bulk_stock_operations() {
        let (db_service, _) = setup_test_db().await;
        let service = StrategyService::new(db_service).await.unwrap();
        
        let symbols = vec!["RELIANCE".to_string(), "TCS".to_string(), "INFY".to_string()];
        
        // Bulk add
        let selections = service.bulk_add_stock_selections("test_user", symbols.clone(), "NSE").await.unwrap();
        assert_eq!(selections.len(), 3);
        
        let active_selections = service.get_active_stock_selections("test_user").await.unwrap();
        assert_eq!(active_selections.len(), 3);
        
        // Bulk remove
        service.bulk_remove_stock_selections("test_user", symbols).await.unwrap();
        
        let active_after_removal = service.get_active_stock_selections("test_user").await.unwrap();
        assert_eq!(active_after_removal.len(), 0);
    }
    
    #[tokio::test]
    async fn test_strategy_validation() {
        let (db_service, _) = setup_test_db().await;
        let service = StrategyService::new(db_service).await.unwrap();
        
        // Valid parameters
        assert!(service.validate_strategy_params(10, 2.0, 1.0, 3.0, 100000).is_ok());
        
        // Invalid max trades per day
        assert!(service.validate_strategy_params(0, 2.0, 1.0, 3.0, 100000).is_err());
        assert!(service.validate_strategy_params(1001, 2.0, 1.0, 3.0, 100000).is_err());
        
        // Invalid risk percentage
        assert!(service.validate_strategy_params(10, 0.0, 1.0, 3.0, 100000).is_err());
        assert!(service.validate_strategy_params(10, 101.0, 1.0, 3.0, 100000).is_err());
        
        // Invalid stop loss percentage
        assert!(service.validate_strategy_params(10, 2.0, 0.0, 3.0, 100000).is_err());
        assert!(service.validate_strategy_params(10, 2.0, 51.0, 3.0, 100000).is_err());
        
        // Invalid take profit percentage
        assert!(service.validate_strategy_params(10, 2.0, 1.0, 0.0, 100000).is_err());
        assert!(service.validate_strategy_params(10, 2.0, 1.0, 101.0, 100000).is_err());
        
        // Take profit must be greater than stop loss
        assert!(service.validate_strategy_params(10, 2.0, 3.0, 1.0, 100000).is_err());
        assert!(service.validate_strategy_params(10, 2.0, 2.0, 2.0, 100000).is_err());
        
        // Invalid volume threshold
        assert!(service.validate_strategy_params(10, 2.0, 1.0, 3.0, 0).is_err());
        assert!(service.validate_strategy_params(10, 2.0, 1.0, 3.0, -1000).is_err());
    }
    
    #[tokio::test]
    async fn test_invalid_stock_symbol() {
        let (db_service, _) = setup_test_db().await;
        let service = StrategyService::new(db_service).await.unwrap();
        
        // Try to add a stock that's not in NIFTY 50
        let result = service.add_stock_selection("test_user", "INVALID_STOCK", "NSE").await;
        assert!(result.is_err());
        
        match result {
            Err(HedgeXError::ValidationError(msg)) => {
                assert!(msg.contains("not in NIFTY 50"));
            }
            _ => panic!("Expected ValidationError"),
        }
    }
    
    #[tokio::test]
    async fn test_strategy_stats() {
        let (db_service, _) = setup_test_db().await;
        let service = StrategyService::new(db_service).await.unwrap();
        
        // Create a test strategy
        let request = CreateStrategyRequest {
            name: "Test Strategy".to_string(),
            description: None,
            max_trades_per_day: 5,
            risk_percentage: 1.5,
            stop_loss_percentage: 0.8,
            take_profit_percentage: 2.0,
            volume_threshold: 50000,
        };
        
        let strategy = service.create_strategy("test_user", request).await.unwrap();
        
        // Get stats (should be empty initially)
        let stats = service.get_strategy_stats("test_user", &strategy.id).await.unwrap();
        
        assert_eq!(stats.get("trades_today").unwrap().as_i64().unwrap(), 0);
        assert_eq!(stats.get("pnl_today").unwrap().as_f64().unwrap(), 0.0);
        assert_eq!(stats.get("total_trades").unwrap().as_i64().unwrap(), 0);
    }
    
    #[tokio::test]
    async fn test_strategy_performance_metrics() {
        let (db_service, _) = setup_test_db().await;
        let service = StrategyService::new(db_service).await.unwrap();
        
        // Create a test strategy
        let request = CreateStrategyRequest {
            name: "Test Strategy".to_string(),
            description: None,
            max_trades_per_day: 5,
            risk_percentage: 1.5,
            stop_loss_percentage: 0.8,
            take_profit_percentage: 2.0,
            volume_threshold: 50000,
        };
        
        let strategy = service.create_strategy("test_user", request).await.unwrap();
        
        // Create test performance metrics
        let metrics = PerformanceMetrics {
            user_id: "test_user".to_string(),
            date: Utc::now(),
            total_trades: 10,
            profitable_trades: 6,
            total_pnl: Decimal::from_str("1500.50").unwrap(),
            max_drawdown: Decimal::from_str("200.00").unwrap(),
            win_rate: 60.0,
            profit_factor: 1.5,
            sharpe_ratio: 1.2,
            average_trade_duration: 45,
        };
        
        // Update performance metrics
        service.update_strategy_performance("test_user", &strategy.id, metrics).await.unwrap();
        
        // Get performance metrics
        let performance = service.get_strategy_performance("test_user", &strategy.id, Some(30)).await.unwrap();
        
        assert_eq!(performance.len(), 1);
        assert_eq!(performance[0].total_trades, 10);
        assert_eq!(performance[0].profitable_trades, 6);
        assert_eq!(performance[0].win_rate, 60.0);
    }
}