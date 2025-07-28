use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::collections::HashMap;
use crate::models::trading::{TradeType, StrategyParams};

/// Timeframe enumeration for backtesting
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Timeframe {
    Minute1,
    Minute5,
    Minute15,
    Minute30,
    Hour1,
    Day1,
}

impl std::fmt::Display for Timeframe {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Timeframe::Minute1 => write!(f, "1m"),
            Timeframe::Minute5 => write!(f, "5m"),
            Timeframe::Minute15 => write!(f, "15m"),
            Timeframe::Minute30 => write!(f, "30m"),
            Timeframe::Hour1 => write!(f, "1h"),
            Timeframe::Day1 => write!(f, "1d"),
        }
    }
}

impl Timeframe {
    /// Get duration in minutes
    pub fn duration_minutes(&self) -> i64 {
        match self {
            Timeframe::Minute1 => 1,
            Timeframe::Minute5 => 5,
            Timeframe::Minute15 => 15,
            Timeframe::Minute30 => 30,
            Timeframe::Hour1 => 60,
            Timeframe::Day1 => 1440, // 24 * 60
        }
    }
}

impl std::str::FromStr for Timeframe {
    type Err = String;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "1m" => Ok(Timeframe::Minute1),
            "5m" => Ok(Timeframe::Minute5),
            "15m" => Ok(Timeframe::Minute15),
            "30m" => Ok(Timeframe::Minute30),
            "1h" => Ok(Timeframe::Hour1),
            "1d" => Ok(Timeframe::Day1),
            _ => Err(format!("Invalid Timeframe: {}", s)),
        }
    }
}

/// Data source enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DataSource {
    KiteAPI,
    CSVFile(String), // Path to uploaded CSV file
}

/// OHLCV data structure for historical data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OHLCV {
    pub timestamp: DateTime<Utc>,
    pub open: Decimal,
    pub high: Decimal,
    pub low: Decimal,
    pub close: Decimal,
    pub volume: i64,
}

impl OHLCV {
    /// Create new OHLCV data point
    pub fn new(
        timestamp: DateTime<Utc>,
        open: Decimal,
        high: Decimal,
        low: Decimal,
        close: Decimal,
        volume: i64,
    ) -> Self {
        Self {
            timestamp,
            open,
            high,
            low,
            close,
            volume,
        }
    }
    
    /// Get typical price (HLC/3)
    pub fn typical_price(&self) -> Decimal {
        (self.high + self.low + self.close) / Decimal::from(3)
    }
    
    /// Get price range (high - low)
    pub fn range(&self) -> Decimal {
        self.high - self.low
    }
    
    /// Check if this is a bullish candle
    pub fn is_bullish(&self) -> bool {
        self.close > self.open
    }
    
    /// Check if this is a bearish candle
    pub fn is_bearish(&self) -> bool {
        self.close < self.open
    }
}

/// Backtest parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacktestParams {
    pub id: String,
    pub user_id: String,
    pub strategy_id: String,
    pub symbol: String,
    pub exchange: String,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub timeframe: Timeframe,
    pub initial_capital: Decimal,
    pub data_source: DataSource,
    pub created_at: DateTime<Utc>,
}

impl BacktestParams {
    /// Create new backtest parameters
    pub fn new(
        user_id: &str,
        strategy_id: &str,
        symbol: &str,
        exchange: &str,
        start_date: DateTime<Utc>,
        end_date: DateTime<Utc>,
        timeframe: Timeframe,
        initial_capital: Decimal,
        data_source: DataSource,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            user_id: user_id.to_string(),
            strategy_id: strategy_id.to_string(),
            symbol: symbol.to_string(),
            exchange: exchange.to_string(),
            start_date,
            end_date,
            timeframe,
            initial_capital,
            data_source,
            created_at: Utc::now(),
        }
    }
}

/// Backtest trade result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacktestTrade {
    pub id: String,
    pub backtest_id: String,
    pub symbol: String,
    pub trade_type: TradeType,
    pub entry_time: DateTime<Utc>,
    pub entry_price: Decimal,
    pub quantity: i32,
    pub exit_time: Option<DateTime<Utc>>,
    pub exit_price: Option<Decimal>,
    pub pnl: Option<Decimal>,
    pub exit_reason: Option<String>,
}

impl BacktestTrade {
    /// Create new backtest trade
    pub fn new(
        backtest_id: &str,
        symbol: &str,
        trade_type: TradeType,
        entry_time: DateTime<Utc>,
        entry_price: Decimal,
        quantity: i32,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            backtest_id: backtest_id.to_string(),
            symbol: symbol.to_string(),
            trade_type,
            entry_time,
            entry_price,
            quantity,
            exit_time: None,
            exit_price: None,
            pnl: None,
            exit_reason: None,
        }
    }
    
    /// Close the trade
    pub fn close(&mut self, exit_time: DateTime<Utc>, exit_price: Decimal, exit_reason: &str) {
        self.exit_time = Some(exit_time);
        self.exit_price = Some(exit_price);
        self.exit_reason = Some(exit_reason.to_string());
        
        // Calculate P&L
        if let Some(exit_price) = self.exit_price {
            let price_diff = match self.trade_type {
                TradeType::Buy => exit_price - self.entry_price,
                TradeType::Sell => self.entry_price - exit_price,
            };
            self.pnl = Some(price_diff * Decimal::from(self.quantity));
        }
    }
    
    /// Check if trade is open
    pub fn is_open(&self) -> bool {
        self.exit_time.is_none()
    }
    
    /// Get trade duration in minutes
    pub fn duration_minutes(&self) -> Option<i64> {
        if let Some(exit_time) = self.exit_time {
            Some((exit_time - self.entry_time).num_minutes())
        } else {
            None
        }
    }
}

/// Equity curve point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EquityPoint {
    pub timestamp: DateTime<Utc>,
    pub equity: Decimal,
}

impl EquityPoint {
    /// Create new equity point
    pub fn new(timestamp: DateTime<Utc>, equity: Decimal) -> Self {
        Self { timestamp, equity }
    }
}

/// Complete backtest result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacktestResult {
    pub id: String,
    pub params: BacktestParams,
    pub total_trades: i32,
    pub winning_trades: i32,
    pub losing_trades: i32,
    pub final_pnl: Decimal,
    pub max_drawdown: Decimal,
    pub sharpe_ratio: f64,
    pub win_rate: f64,
    pub profit_factor: f64,
    pub trades: Vec<BacktestTrade>,
    pub equity_curve: Vec<EquityPoint>,
    pub created_at: DateTime<Utc>,
}

impl BacktestResult {
    /// Create new backtest result
    pub fn new(params: BacktestParams) -> Self {
        Self {
            id: params.id.clone(),
            params,
            total_trades: 0,
            winning_trades: 0,
            losing_trades: 0,
            final_pnl: Decimal::ZERO,
            max_drawdown: Decimal::ZERO,
            sharpe_ratio: 0.0,
            win_rate: 0.0,
            profit_factor: 0.0,
            trades: Vec::new(),
            equity_curve: Vec::new(),
            created_at: Utc::now(),
        }
    }
    
    /// Calculate performance metrics from trades
    pub fn calculate_metrics(&mut self) {
        if self.trades.is_empty() {
            return;
        }
        
        self.total_trades = self.trades.len() as i32;
        
        let mut total_profit = Decimal::ZERO;
        let mut total_loss = Decimal::ZERO;
        let mut winning_trades = 0;
        let mut losing_trades = 0;
        
        // Calculate basic metrics
        for trade in &self.trades {
            if let Some(pnl) = trade.pnl {
                if pnl > Decimal::ZERO {
                    total_profit += pnl;
                    winning_trades += 1;
                } else if pnl < Decimal::ZERO {
                    total_loss += pnl.abs();
                    losing_trades += 1;
                }
            }
        }
        
        self.winning_trades = winning_trades;
        self.losing_trades = losing_trades;
        self.final_pnl = total_profit - total_loss;
        
        // Calculate win rate
        if self.total_trades > 0 {
            self.win_rate = (self.winning_trades as f64 / self.total_trades as f64) * 100.0;
        }
        
        // Calculate profit factor
        if total_loss > Decimal::ZERO {
            self.profit_factor = (total_profit / total_loss).to_f64().unwrap_or(0.0);
        }
        
        // Calculate max drawdown from equity curve
        self.calculate_max_drawdown();
        
        // Calculate Sharpe ratio
        self.calculate_sharpe_ratio();
    }
    
    /// Calculate maximum drawdown from equity curve
    fn calculate_max_drawdown(&mut self) {
        if self.equity_curve.len() < 2 {
            return;
        }
        
        let mut peak = self.equity_curve[0].equity;
        let mut max_drawdown = Decimal::ZERO;
        
        for point in &self.equity_curve {
            if point.equity > peak {
                peak = point.equity;
            }
            
            let drawdown = peak - point.equity;
            if drawdown > max_drawdown {
                max_drawdown = drawdown;
            }
        }
        
        self.max_drawdown = max_drawdown;
    }
    
    /// Calculate Sharpe ratio (simplified version)
    fn calculate_sharpe_ratio(&mut self) {
        if self.equity_curve.len() < 2 {
            return;
        }
        
        // Calculate daily returns
        let mut returns = Vec::new();
        for i in 1..self.equity_curve.len() {
            let prev_equity = self.equity_curve[i - 1].equity;
            let curr_equity = self.equity_curve[i].equity;
            
            if prev_equity > Decimal::ZERO {
                let return_pct = ((curr_equity - prev_equity) / prev_equity).to_f64().unwrap_or(0.0);
                returns.push(return_pct);
            }
        }
        
        if returns.is_empty() {
            return;
        }
        
        // Calculate mean and standard deviation
        let mean_return = returns.iter().sum::<f64>() / returns.len() as f64;
        let variance = returns.iter()
            .map(|r| (r - mean_return).powi(2))
            .sum::<f64>() / returns.len() as f64;
        let std_dev = variance.sqrt();
        
        // Calculate Sharpe ratio (assuming risk-free rate of 0)
        if std_dev > 0.0 {
            self.sharpe_ratio = mean_return / std_dev * (252.0_f64).sqrt(); // Annualized
        }
    }
}

/// Backtest summary for listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacktestSummary {
    pub id: String,
    pub user_id: String,
    pub strategy_name: String,
    pub symbol: String,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
    pub total_trades: i32,
    pub final_pnl: Decimal,
    pub win_rate: f64,
    pub created_at: DateTime<Utc>,
}

/// Backtest comparison result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacktestComparison {
    pub backtests: Vec<BacktestSummary>,
    pub metrics_comparison: HashMap<String, Vec<f64>>,
}

/// Historical data parameters for Kite API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoricalDataParams {
    pub symbol: String,
    pub exchange: String,
    pub from_date: DateTime<Utc>,
    pub to_date: DateTime<Utc>,
    pub timeframe: Timeframe,
}

/// Historical data fetch parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoricalDataFetchParams {
    pub user_id: String,
    pub symbols: Vec<String>,
    pub exchange: String,
    pub from_date: DateTime<Utc>,
    pub to_date: DateTime<Utc>,
    pub timeframe: Timeframe,
}

/// CSV import validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvValidationResult {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub total_rows: usize,
    pub valid_rows: usize,
}

/// CSV import configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CsvImportConfig {
    pub symbol: String,
    pub exchange: String,
    pub timeframe: Timeframe,
    pub has_header: bool,
    pub date_format: String,
    pub timezone: String,
}

impl Default for CsvImportConfig {
    fn default() -> Self {
        Self {
            symbol: String::new(),
            exchange: "NSE".to_string(),
            timeframe: Timeframe::Day1,
            has_header: true,
            date_format: "%Y-%m-%d %H:%M:%S".to_string(),
            timezone: "Asia/Kolkata".to_string(),
        }
    }
}