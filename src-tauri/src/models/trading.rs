use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::collections::HashMap;

/// Trade type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TradeType {
    Buy,
    Sell,
}

impl std::fmt::Display for TradeType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TradeType::Buy => write!(f, "Buy"),
            TradeType::Sell => write!(f, "Sell"),
        }
    }
}

impl std::str::FromStr for TradeType {
    type Err = String;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "Buy" => Ok(TradeType::Buy),
            "Sell" => Ok(TradeType::Sell),
            _ => Err(format!("Invalid TradeType: {}", s)),
        }
    }
}

/// Trade status enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TradeStatus {
    Pending,
    Executed,
    Cancelled,
    Failed,
    PartiallyFilled,
}

impl std::fmt::Display for TradeStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TradeStatus::Pending => write!(f, "Pending"),
            TradeStatus::Executed => write!(f, "Executed"),
            TradeStatus::Cancelled => write!(f, "Cancelled"),
            TradeStatus::Failed => write!(f, "Failed"),
            TradeStatus::PartiallyFilled => write!(f, "PartiallyFilled"),
        }
    }
}

/// Trade model representing a single trade
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: String,
    pub user_id: String,
    pub symbol: String,
    pub exchange: String,
    pub order_id: Option<String>,
    pub trade_type: TradeType,
    pub quantity: i32,
    pub price: Decimal,
    pub status: TradeStatus,
    pub executed_at: DateTime<Utc>,
    pub strategy_id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Trade {
    /// Create a new trade
    pub fn new(
        user_id: &str,
        symbol: &str,
        exchange: &str,
        trade_type: TradeType,
        quantity: i32,
        price: Decimal,
        strategy_id: &str,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            user_id: user_id.to_string(),
            symbol: symbol.to_string(),
            exchange: exchange.to_string(),
            order_id: None,
            trade_type,
            quantity,
            price,
            status: TradeStatus::Pending,
            executed_at: now,
            strategy_id: strategy_id.to_string(),
            created_at: now,
            updated_at: now,
        }
    }
    
    /// Update trade status
    pub fn update_status(&mut self, status: TradeStatus, order_id: Option<String>) {
        self.status = status;
        self.order_id = order_id;
        self.updated_at = Utc::now();
        if status == TradeStatus::Executed {
            self.executed_at = Utc::now();
        }
    }
}

/// Position model representing an open position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub symbol: String,
    pub exchange: String,
    pub quantity: i32,
    pub average_price: Decimal,
    pub current_price: Decimal,
    pub pnl: Decimal,
    pub pnl_percentage: Decimal,
    pub trade_type: TradeType,
    pub entry_time: DateTime<Utc>,
    pub last_updated: DateTime<Utc>,
}

impl Position {
    /// Create a new position
    pub fn new(
        symbol: &str,
        exchange: &str,
        quantity: i32,
        entry_price: Decimal,
        trade_type: TradeType,
    ) -> Self {
        let now = Utc::now();
        Self {
            symbol: symbol.to_string(),
            exchange: exchange.to_string(),
            quantity,
            average_price: entry_price,
            current_price: entry_price,
            pnl: Decimal::ZERO,
            pnl_percentage: Decimal::ZERO,
            trade_type,
            entry_time: now,
            last_updated: now,
        }
    }
    
    /// Update position with new price
    pub fn update_price(&mut self, new_price: Decimal) {
        self.current_price = new_price;
        self.calculate_pnl();
        self.last_updated = Utc::now();
    }
    
    /// Calculate P&L based on current price
    fn calculate_pnl(&mut self) {
        let price_diff = match self.trade_type {
            TradeType::Buy => self.current_price - self.average_price,
            TradeType::Sell => self.average_price - self.current_price,
        };
        
        self.pnl = price_diff * Decimal::from(self.quantity);
        
        if self.average_price != Decimal::ZERO {
            self.pnl_percentage = (price_diff / self.average_price) * Decimal::from(100);
        }
    }
    
    /// Add to position (for averaging)
    pub fn add_quantity(&mut self, quantity: i32, price: Decimal) {
        let total_value = self.average_price * Decimal::from(self.quantity) + price * Decimal::from(quantity);
        self.quantity += quantity;
        self.average_price = total_value / Decimal::from(self.quantity);
        self.calculate_pnl();
        self.last_updated = Utc::now();
    }
    
    /// Reduce position quantity
    pub fn reduce_quantity(&mut self, quantity: i32) -> bool {
        if quantity >= self.quantity {
            return false; // Cannot reduce more than available
        }
        self.quantity -= quantity;
        self.calculate_pnl();
        self.last_updated = Utc::now();
        true
    }
}

/// Strategy parameters model
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
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl StrategyParams {
    /// Create new strategy parameters
    pub fn new(
        user_id: &str,
        name: &str,
        description: Option<String>,
        max_trades_per_day: i32,
        risk_percentage: f64,
        stop_loss_percentage: f64,
        take_profit_percentage: f64,
        volume_threshold: i64,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            user_id: user_id.to_string(),
            name: name.to_string(),
            description,
            enabled: false,
            max_trades_per_day,
            risk_percentage,
            stop_loss_percentage,
            take_profit_percentage,
            volume_threshold,
            created_at: now,
            updated_at: now,
        }
    }
    
    /// Update strategy parameters
    pub fn update(&mut self, 
        name: Option<String>,
        description: Option<String>,
        max_trades_per_day: Option<i32>,
        risk_percentage: Option<f64>,
        stop_loss_percentage: Option<f64>,
        take_profit_percentage: Option<f64>,
        volume_threshold: Option<i64>,
    ) {
        if let Some(name) = name {
            self.name = name;
        }
        if let Some(description) = description {
            self.description = Some(description);
        }
        if let Some(max_trades) = max_trades_per_day {
            self.max_trades_per_day = max_trades;
        }
        if let Some(risk) = risk_percentage {
            self.risk_percentage = risk;
        }
        if let Some(stop_loss) = stop_loss_percentage {
            self.stop_loss_percentage = stop_loss;
        }
        if let Some(take_profit) = take_profit_percentage {
            self.take_profit_percentage = take_profit;
        }
        if let Some(volume) = volume_threshold {
            self.volume_threshold = volume;
        }
        self.updated_at = Utc::now();
    }
    
    /// Enable strategy
    pub fn enable(&mut self) {
        self.enabled = true;
        self.updated_at = Utc::now();
    }
    
    /// Disable strategy
    pub fn disable(&mut self) {
        self.enabled = false;
        self.updated_at = Utc::now();
    }
}

/// Stock selection model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockSelection {
    pub id: String,
    pub user_id: String,
    pub symbol: String,
    pub exchange: String,
    pub is_active: bool,
    pub added_at: DateTime<Utc>,
}

impl StockSelection {
    /// Create new stock selection
    pub fn new(user_id: &str, symbol: &str, exchange: &str) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            user_id: user_id.to_string(),
            symbol: symbol.to_string(),
            exchange: exchange.to_string(),
            is_active: true,
            added_at: Utc::now(),
        }
    }
    
    /// Activate stock
    pub fn activate(&mut self) {
        self.is_active = true;
    }
    
    /// Deactivate stock
    pub fn deactivate(&mut self) {
        self.is_active = false;
    }
}

/// Market data model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketData {
    pub symbol: String,
    pub instrument_token: u64,
    pub ltp: Decimal,
    pub volume: i64,
    pub bid: Decimal,
    pub ask: Decimal,
    pub open_price: Option<Decimal>,
    pub high_price: Option<Decimal>,
    pub low_price: Option<Decimal>,
    pub close_price: Option<Decimal>,
    pub change_value: Option<Decimal>,
    pub change_percent: Option<Decimal>,
    pub timestamp: DateTime<Utc>,
}

impl MarketData {
    /// Create new market data
    pub fn new(
        symbol: &str,
        instrument_token: u64,
        ltp: Decimal,
        volume: i64,
        bid: Decimal,
        ask: Decimal,
    ) -> Self {
        Self {
            symbol: symbol.to_string(),
            instrument_token,
            ltp,
            volume,
            bid,
            ask,
            open_price: None,
            high_price: None,
            low_price: None,
            close_price: None,
            change_value: None,
            change_percent: None,
            timestamp: Utc::now(),
        }
    }
    
    /// Update with OHLC data
    pub fn with_ohlc(mut self, open: Decimal, high: Decimal, low: Decimal, close: Decimal) -> Self {
        self.open_price = Some(open);
        self.high_price = Some(high);
        self.low_price = Some(low);
        self.close_price = Some(close);
        
        // Calculate change
        if close != Decimal::ZERO {
            self.change_value = Some(self.ltp - close);
            self.change_percent = Some((self.change_value.unwrap() / close) * Decimal::from(100));
        }
        
        self
    }
}

/// Order request model for internal use
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderRequest {
    pub symbol: String,
    pub exchange: String,
    pub trade_type: TradeType,
    pub quantity: i32,
    pub price: Option<Decimal>,
    pub order_type: OrderType,
    pub strategy_id: String,
    pub user_id: String,
}

/// Order type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum OrderType {
    Market,
    Limit,
    StopLoss,
    StopLossMarket,
}

impl std::fmt::Display for OrderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OrderType::Market => write!(f, "Market"),
            OrderType::Limit => write!(f, "Limit"),
            OrderType::StopLoss => write!(f, "StopLoss"),
            OrderType::StopLossMarket => write!(f, "StopLossMarket"),
        }
    }
}

/// Order response model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderResponse {
    pub order_id: String,
    pub status: String,
    pub message: Option<String>,
}

/// Risk limits model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskLimits {
    pub max_position_size: Decimal,
    pub max_daily_loss: Decimal,
    pub max_trades_per_day: i32,
    pub max_trades_per_symbol: i32,
    pub position_concentration_limit: f64, // Percentage of portfolio
    pub stop_loss_percentage: f64,
    pub take_profit_percentage: f64,
}

impl Default for RiskLimits {
    fn default() -> Self {
        Self {
            max_position_size: Decimal::from(100000), // 1 lakh per position
            max_daily_loss: Decimal::from(50000), // 50k daily loss limit
            max_trades_per_day: 50,
            max_trades_per_symbol: 5,
            position_concentration_limit: 10.0, // 10% of portfolio per position
            stop_loss_percentage: 2.0, // 2% stop loss
            take_profit_percentage: 4.0, // 4% take profit
        }
    }
}

/// Trading signal model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradingSignal {
    pub symbol: String,
    pub signal_type: SignalType,
    pub strength: f64, // 0.0 to 1.0
    pub price: Decimal,
    pub volume: i64,
    pub timestamp: DateTime<Utc>,
    pub strategy_id: String,
}

/// Signal type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SignalType {
    Buy,
    Sell,
    Hold,
    StopLoss,
    TakeProfit,
}

impl std::fmt::Display for SignalType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SignalType::Buy => write!(f, "Buy"),
            SignalType::Sell => write!(f, "Sell"),
            SignalType::Hold => write!(f, "Hold"),
            SignalType::StopLoss => write!(f, "StopLoss"),
            SignalType::TakeProfit => write!(f, "TakeProfit"),
        }
    }
}

/// Performance metrics model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub user_id: String,
    pub date: DateTime<Utc>,
    pub total_trades: i32,
    pub profitable_trades: i32,
    pub total_pnl: Decimal,
    pub max_drawdown: Decimal,
    pub win_rate: f64,
    pub profit_factor: f64,
    pub sharpe_ratio: f64,
    pub average_trade_duration: i64, // in minutes
}

impl PerformanceMetrics {
    /// Create new performance metrics
    pub fn new(user_id: &str) -> Self {
        Self {
            user_id: user_id.to_string(),
            date: Utc::now(),
            total_trades: 0,
            profitable_trades: 0,
            total_pnl: Decimal::ZERO,
            max_drawdown: Decimal::ZERO,
            win_rate: 0.0,
            profit_factor: 0.0,
            sharpe_ratio: 0.0,
            average_trade_duration: 0,
        }
    }
    
    /// Update metrics with new trade
    pub fn update_with_trade(&mut self, trade_pnl: Decimal, duration_minutes: i64) {
        self.total_trades += 1;
        if trade_pnl > Decimal::ZERO {
            self.profitable_trades += 1;
        }
        self.total_pnl += trade_pnl;
        
        // Update win rate
        self.win_rate = (self.profitable_trades as f64 / self.total_trades as f64) * 100.0;
        
        // Update average duration
        self.average_trade_duration = (self.average_trade_duration * (self.total_trades - 1) as i64 + duration_minutes) / self.total_trades as i64;
    }
}