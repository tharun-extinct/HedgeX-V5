use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Represents a user of the HedgeX application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
}

/// API credentials for Zerodha Kite API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiCredentials {
    pub user_id: String,
    pub api_key: String,
    pub api_secret: String, // This will be stored encrypted
    pub access_token: Option<String>,
    pub access_token_expiry: Option<DateTime<Utc>>,
}

/// Trading strategy parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyParams {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub description: Option<String>,
    pub enabled: bool,
    pub max_trades_per_day: i32,
    pub risk_percentage: f64,
    pub stop_loss_percentage: f64,
    pub take_profit_percentage: f64,
    pub volume_threshold: i64,
}

/// Stock selection for trading
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockSelection {
    pub id: String,
    pub user_id: String,
    pub symbol: String,
    pub exchange: String,
    pub is_active: bool,
    pub added_at: DateTime<Utc>,
}

/// Represents a trade executed by the system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: String,
    pub user_id: String,
    pub symbol: String,
    pub exchange: String,
    pub order_id: Option<String>,
    pub trade_type: TradeType,
    pub quantity: i32,
    pub price: f64,
    pub status: TradeStatus,
    pub executed_at: DateTime<Utc>,
    pub strategy_id: String,
}

/// Type of trade
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TradeType {
    Buy,
    Sell,
}

/// Status of a trade
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TradeStatus {
    Pending,
    Executed,
    Cancelled,
    Failed,
}

/// System logs for auditing and debugging
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemLog {
    pub id: String,
    pub user_id: Option<String>,
    pub log_level: LogLevel,
    pub message: String,
    pub created_at: DateTime<Utc>,
    pub context: Option<String>,
}

/// Log level for system logs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogLevel {
    Debug,
    Info,
    Warning,
    Error,
    Critical,
}
