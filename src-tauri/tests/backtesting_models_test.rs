use hedgex::models::backtesting::*;
use hedgex::models::trading::*;
use chrono::{DateTime, Utc, TimeZone};
use rust_decimal::Decimal;
use std::collections::HashMap;

#[test]
fn test_ohlcv_creation_and_validation() {
    let timestamp = Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap();
    let ohlcv = OHLCV::new(
        timestamp,
        Decimal::from(1000),
        Decimal::from(1005),
        Decimal::from(995),
        Decimal::from(1002),
        1500,
    );

    assert_eq!(ohlcv.open, Decimal::from(1000));
    assert_eq!(ohlcv.high, Decimal::from(1005));
    assert_eq!(ohlcv.low, Decimal::from(995));
    assert_eq!(ohlcv.close, Decimal::from(1002));
    assert_eq!(ohlcv.volume, 1500);
    assert_eq!(ohlcv.timestamp, timestamp);

    // Test helper methods
    let typical_price = (Decimal::from(1005) + Decimal::from(995) + Decimal::from(1002)) / Decimal::from(3);
    assert_eq!(ohlcv.typical_price(), typical_price);
    
    assert_eq!(ohlcv.range(), Decimal::from(10)); // 1005 - 995
    assert!(ohlcv.is_bullish()); // close > open
    assert!(!ohlcv.is_bearish());
}

#[test]
fn test_backtest_params_creation() {
    let params = BacktestParams::new(
        "test_user",
        "strategy_123",
        "RELIANCE",
        "NSE",
        Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap(),
        Utc.with_ymd_and_hms(2024, 1, 1, 15, 30, 0).unwrap(),
        Timeframe::Minute5,
        Decimal::from(100000),
        DataSource::KiteAPI,
    );

    assert_eq!(params.user_id, "test_user");
    assert_eq!(params.strategy_id, "strategy_123");
    assert_eq!(params.symbol, "RELIANCE");
    assert_eq!(params.exchange, "NSE");
    assert_eq!(params.timeframe, Timeframe::Minute5);
    assert_eq!(params.initial_capital, Decimal::from(100000));
    assert!(matches!(params.data_source, DataSource::KiteAPI));
}

#[test]
fn test_backtest_trade_lifecycle() {
    let entry_time = Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap();
    let mut trade = BacktestTrade::new(
        "backtest_123",
        "RELIANCE",
        TradeType::Buy,
        entry_time,
        Decimal::from(1000),
        100,
    );

    // Test initial state
    assert!(trade.is_open());
    assert_eq!(trade.pnl, None);
    assert_eq!(trade.exit_time, None);
    assert_eq!(trade.exit_price, None);
    assert_eq!(trade.duration_minutes(), None);

    // Close the trade
    let exit_time = entry_time + chrono::Duration::minutes(30);
    trade.close(exit_time, Decimal::from(1050), "Take profit");

    // Test closed state
    assert!(!trade.is_open());
    assert_eq!(trade.exit_time, Some(exit_time));
    assert_eq!(trade.exit_price, Some(Decimal::from(1050)));
    assert_eq!(trade.pnl, Some(Decimal::from(5000))); // (1050 - 1000) * 100
    assert_eq!(trade.exit_reason, Some("Take profit".to_string()));
    assert_eq!(trade.duration_minutes(), Some(30));
}

#[test]
fn test_backtest_trade_short_position() {
    let entry_time = Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap();
    let mut trade = BacktestTrade::new(
        "backtest_123",
        "RELIANCE",
        TradeType::Sell, // Short position
        entry_time,
        Decimal::from(1000),
        100,
    );

    // Close at lower price (profit for short)
    let exit_time = entry_time + chrono::Duration::minutes(15);
    trade.close(exit_time, Decimal::from(950), "Take profit");

    // For short position: profit = (entry_price - exit_price) * quantity
    assert_eq!(trade.pnl, Some(Decimal::from(5000))); // (1000 - 950) * 100
}

#[test]
fn test_backtest_result_creation_and_metrics() {
    let params = BacktestParams::new(
        "test_user",
        "strategy_123",
        "RELIANCE",
        "NSE",
        Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap(),
        Utc.with_ymd_and_hms(2024, 1, 1, 15, 30, 0).unwrap(),
        Timeframe::Minute5,
        Decimal::from(100000),
        DataSource::KiteAPI,
    );

    let mut result = BacktestResult::new(params);

    // Add some sample trades
    let mut trade1 = BacktestTrade::new(
        &result.id,
        "RELIANCE",
        TradeType::Buy,
        Utc.with_ymd_and_hms(2024, 1, 1, 9, 30, 0).unwrap(),
        Decimal::from(1000),
        100,
    );
    trade1.close(
        Utc.with_ymd_and_hms(2024, 1, 1, 10, 0, 0).unwrap(),
        Decimal::from(1050),
        "Take profit",
    );

    let mut trade2 = BacktestTrade::new(
        &result.id,
        "RELIANCE",
        TradeType::Buy,
        Utc.with_ymd_and_hms(2024, 1, 1, 11, 0, 0).unwrap(),
        Decimal::from(1100),
        50,
    );
    trade2.close(
        Utc.with_ymd_and_hms(2024, 1, 1, 11, 30, 0).unwrap(),
        Decimal::from(1080),
        "Stop loss",
    );

    result.trades = vec![trade1, trade2];

    // Add equity curve points
    result.equity_curve = vec![
        EquityPoint::new(
            Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap(),
            Decimal::from(100000),
        ),
        EquityPoint::new(
            Utc.with_ymd_and_hms(2024, 1, 1, 10, 0, 0).unwrap(),
            Decimal::from(105000),
        ),
        EquityPoint::new(
            Utc.with_ymd_and_hms(2024, 1, 1, 11, 30, 0).unwrap(),
            Decimal::from(104000),
        ),
    ];

    // Calculate metrics
    result.calculate_metrics();

    // Verify metrics
    assert_eq!(result.total_trades, 2);
    assert_eq!(result.winning_trades, 1);
    assert_eq!(result.losing_trades, 1);
    assert_eq!(result.final_pnl, Decimal::from(4000)); // 5000 - 1000
    assert_eq!(result.win_rate, 50.0); // 1/2 * 100
    assert_eq!(result.profit_factor, 5.0); // 5000 / 1000
}

#[test]
fn test_timeframe_display_and_duration() {
    assert_eq!(Timeframe::Minute1.to_string(), "1m");
    assert_eq!(Timeframe::Minute5.to_string(), "5m");
    assert_eq!(Timeframe::Minute15.to_string(), "15m");
    assert_eq!(Timeframe::Minute30.to_string(), "30m");
    assert_eq!(Timeframe::Hour1.to_string(), "1h");
    assert_eq!(Timeframe::Day1.to_string(), "1d");

    assert_eq!(Timeframe::Minute1.duration_minutes(), 1);
    assert_eq!(Timeframe::Minute5.duration_minutes(), 5);
    assert_eq!(Timeframe::Minute15.duration_minutes(), 15);
    assert_eq!(Timeframe::Minute30.duration_minutes(), 30);
    assert_eq!(Timeframe::Hour1.duration_minutes(), 60);
    assert_eq!(Timeframe::Day1.duration_minutes(), 1440);
}

#[test]
fn test_timeframe_from_str() {
    use std::str::FromStr;
    
    assert_eq!(Timeframe::from_str("1m").unwrap(), Timeframe::Minute1);
    assert_eq!(Timeframe::from_str("5m").unwrap(), Timeframe::Minute5);
    assert_eq!(Timeframe::from_str("15m").unwrap(), Timeframe::Minute15);
    assert_eq!(Timeframe::from_str("30m").unwrap(), Timeframe::Minute30);
    assert_eq!(Timeframe::from_str("1h").unwrap(), Timeframe::Hour1);
    assert_eq!(Timeframe::from_str("1d").unwrap(), Timeframe::Day1);
    
    assert!(Timeframe::from_str("invalid").is_err());
}

#[test]
fn test_trade_type_display_and_from_str() {
    use std::str::FromStr;
    
    assert_eq!(TradeType::Buy.to_string(), "Buy");
    assert_eq!(TradeType::Sell.to_string(), "Sell");
    
    assert_eq!(TradeType::from_str("Buy").unwrap(), TradeType::Buy);
    assert_eq!(TradeType::from_str("Sell").unwrap(), TradeType::Sell);
    
    assert!(TradeType::from_str("invalid").is_err());
}

#[test]
fn test_csv_import_config_default() {
    let config = CsvImportConfig::default();
    
    assert_eq!(config.exchange, "NSE");
    assert_eq!(config.timeframe, Timeframe::Day1);
    assert!(config.has_header);
    assert_eq!(config.date_format, "%Y-%m-%d %H:%M:%S");
    assert_eq!(config.timezone, "Asia/Kolkata");
}

#[test]
fn test_max_drawdown_calculation() {
    let params = BacktestParams::new(
        "test_user",
        "strategy_123",
        "RELIANCE",
        "NSE",
        Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap(),
        Utc.with_ymd_and_hms(2024, 1, 1, 15, 30, 0).unwrap(),
        Timeframe::Minute5,
        Decimal::from(100000),
        DataSource::KiteAPI,
    );

    let mut result = BacktestResult::new(params);

    // Create equity curve with drawdown
    result.equity_curve = vec![
        EquityPoint::new(
            Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap(),
            Decimal::from(100000), // Peak
        ),
        EquityPoint::new(
            Utc.with_ymd_and_hms(2024, 1, 1, 10, 0, 0).unwrap(),
            Decimal::from(95000), // Drawdown of 5000
        ),
        EquityPoint::new(
            Utc.with_ymd_and_hms(2024, 1, 1, 11, 0, 0).unwrap(),
            Decimal::from(90000), // Max drawdown of 10000
        ),
        EquityPoint::new(
            Utc.with_ymd_and_hms(2024, 1, 1, 12, 0, 0).unwrap(),
            Decimal::from(105000), // New peak
        ),
        EquityPoint::new(
            Utc.with_ymd_and_hms(2024, 1, 1, 13, 0, 0).unwrap(),
            Decimal::from(102000), // Small drawdown of 3000
        ),
    ];

    result.calculate_metrics();

    // Max drawdown should be 10000 (100000 - 90000)
    assert_eq!(result.max_drawdown, Decimal::from(10000));
}

#[test]
fn test_sharpe_ratio_calculation() {
    let params = BacktestParams::new(
        "test_user",
        "strategy_123",
        "RELIANCE",
        "NSE",
        Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap(),
        Utc.with_ymd_and_hms(2024, 1, 1, 15, 30, 0).unwrap(),
        Timeframe::Minute5,
        Decimal::from(100000),
        DataSource::KiteAPI,
    );

    let mut result = BacktestResult::new(params);

    // Create equity curve with consistent returns
    result.equity_curve = vec![
        EquityPoint::new(
            Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap(),
            Decimal::from(100000),
        ),
        EquityPoint::new(
            Utc.with_ymd_and_hms(2024, 1, 1, 10, 0, 0).unwrap(),
            Decimal::from(101000),
        ),
        EquityPoint::new(
            Utc.with_ymd_and_hms(2024, 1, 1, 11, 0, 0).unwrap(),
            Decimal::from(102000),
        ),
        EquityPoint::new(
            Utc.with_ymd_and_hms(2024, 1, 1, 12, 0, 0).unwrap(),
            Decimal::from(103000),
        ),
    ];

    result.calculate_metrics();

    // Sharpe ratio should be calculated (exact value depends on implementation)
    // We just verify it's not zero and is a reasonable number
    assert!(result.sharpe_ratio.is_finite());
    assert!(result.sharpe_ratio >= 0.0);
}