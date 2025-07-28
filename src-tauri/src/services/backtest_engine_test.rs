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
    async fn test_csv_import_invalid_data() {
        let pool = Arc::new(create_test_db().await);
        let strategy_manager = Arc::new(StrategyManager::new(pool.clone()));
        let engine = BacktestEngine::new(pool, strategy_manager);

        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "timestamp,open,high,low,close,volume").unwrap();
        writeln!(temp_file, "2024-01-01 09:15:00,100.0,95.0,99.0,103.0,1000").unwrap(); // Invalid: high < open
        writeln!(temp_file, "invalid_date,100.0,105.0,99.0,103.0,1000").unwrap(); // Invalid date

        let file_path = temp_file.path().to_str().unwrap();
        let result = engine.import_csv_data(file_path, "RELIANCE").await.unwrap();
        
        assert!(!result.is_valid);
        assert!(!result.errors.is_empty());
    }

    #[tokio::test]
    async fn test_backtest_run_with_csv_data() {
        let pool = Arc::new(create_test_db().await);
        let strategy_manager = Arc::new(StrategyManager::new(pool.clone()));
        let engine = BacktestEngine::new(pool.clone(), strategy_manager);

        let strategy_id = create_test_strategy(&pool).await;
        let temp_file = create_test_csv_file();
        let file_path = temp_file.path().to_str().unwrap();

        // Import CSV data first
        let _validation_result = engine.import_csv_data(file_path, "RELIANCE").await.unwrap();

        let params = BacktestParams::new(
            "test_user",
            &strategy_id,
            "RELIANCE",
            "NSE",
            Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap(),
            Utc.with_ymd_and_hms(2024, 1, 1, 10, 0, 0).unwrap(),
            Timeframe::Minute1,
            Decimal::from(100000),
            DataSource::CSVFile(file_path.to_string()),
        );

        let result = engine.run_backtest(params).await.unwrap();

        // Verify backtest results
        assert_eq!(result.params.symbol, "RELIANCE");
        assert_eq!(result.params.initial_capital, Decimal::from(100000));
        assert!(!result.equity_curve.is_empty());
        
        // Should have at least initial equity point
        assert!(result.equity_curve.len() >= 1);
        assert_eq!(result.equity_curve[0].equity, Decimal::from(100000));
    }

    #[tokio::test]
    async fn test_backtest_performance_metrics_calculation() {
        let pool = Arc::new(create_test_db().await);
        let strategy_manager = Arc::new(StrategyManager::new(pool.clone()));
        let engine = BacktestEngine::new(pool.clone(), strategy_manager);

        let strategy_id = create_test_strategy(&pool).await;
        
        // Create a longer dataset for more meaningful results
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "timestamp,open,high,low,close,volume").unwrap();
        
        let base_time = Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap();
        
        // Create data with clear trend for signal generation
        for i in 0..200 {
            let timestamp = base_time + chrono::Duration::minutes(i);
            let base_price = 1000.0 + (i as f64) * 0.5; // Clear uptrend
            
            let open = base_price;
            let high = open + 3.0;
            let low = open - 1.0;
            let close = base_price + 0.3; // Slight positive close
            let volume = 2000; // Above threshold

            writeln!(
                temp_file,
                "{},{},{},{},{},{}",
                timestamp.format("%Y-%m-%d %H:%M:%S"),
                open, high, low, close, volume
            ).unwrap();
        }

        let file_path = temp_file.path().to_str().unwrap();
        let _validation_result = engine.import_csv_data(file_path, "RELIANCE").await.unwrap();

        let params = BacktestParams::new(
            "test_user",
            &strategy_id,
            "RELIANCE",
            "NSE",
            Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap(),
            Utc.with_ymd_and_hms(2024, 1, 1, 12, 30, 0).unwrap(),
            Timeframe::Minute1,
            Decimal::from(100000),
            DataSource::CSVFile(file_path.to_string()),
        );

        let result = engine.run_backtest(params).await.unwrap();

        // Verify metrics are calculated
        assert!(result.total_trades >= 0);
        assert!(result.win_rate >= 0.0 && result.win_rate <= 100.0);
        assert!(result.profit_factor >= 0.0);
        
        // Equity curve should show progression
        assert!(result.equity_curve.len() > 1);
        
        // Final equity should be different from initial (due to trades or lack thereof)
        let initial_equity = result.equity_curve.first().unwrap().equity;
        let final_equity = result.equity_curve.last().unwrap().equity;
        
        // Even if no trades, equity curve should be tracked
        assert_eq!(initial_equity, Decimal::from(100000));
    }

    #[tokio::test]
    async fn test_backtest_storage_and_retrieval() {
        let pool = Arc::new(create_test_db().await);
        let strategy_manager = Arc::new(StrategyManager::new(pool.clone()));
        let engine = BacktestEngine::new(pool.clone(), strategy_manager);

        let strategy_id = create_test_strategy(&pool).await;
        let temp_file = create_test_csv_file();
        let file_path = temp_file.path().to_str().unwrap();

        let _validation_result = engine.import_csv_data(file_path, "RELIANCE").await.unwrap();

        let params = BacktestParams::new(
            "test_user",
            &strategy_id,
            "RELIANCE",
            "NSE",
            Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap(),
            Utc.with_ymd_and_hms(2024, 1, 1, 10, 0, 0).unwrap(),
            Timeframe::Minute1,
            Decimal::from(100000),
            DataSource::CSVFile(file_path.to_string()),
        );

        let original_result = engine.run_backtest(params).await.unwrap();

        // Test retrieval of backtest results
        let summaries = engine.get_backtest_results("test_user").await.unwrap();
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].symbol, "RELIANCE");

        // Test detailed retrieval
        let detailed_result = engine.get_backtest_detail(&original_result.id).await.unwrap();
        assert_eq!(detailed_result.id, original_result.id);
        assert_eq!(detailed_result.params.symbol, original_result.params.symbol);
        assert_eq!(detailed_result.equity_curve.len(), original_result.equity_curve.len());
    }

    #[tokio::test]
    async fn test_backtest_comparison() {
        let pool = Arc::new(create_test_db().await);
        let strategy_manager = Arc::new(StrategyManager::new(pool.clone()));
        let engine = BacktestEngine::new(pool.clone(), strategy_manager);

        let strategy_id = create_test_strategy(&pool).await;
        let temp_file = create_test_csv_file();
        let file_path = temp_file.path().to_str().unwrap();

        let _validation_result = engine.import_csv_data(file_path, "RELIANCE").await.unwrap();

        // Run two backtests with different parameters
        let params1 = BacktestParams::new(
            "test_user",
            &strategy_id,
            "RELIANCE",
            "NSE",
            Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap(),
            Utc.with_ymd_and_hms(2024, 1, 1, 9, 45, 0).unwrap(),
            Timeframe::Minute1,
            Decimal::from(100000),
            DataSource::CSVFile(file_path.to_string()),
        );

        let params2 = BacktestParams::new(
            "test_user",
            &strategy_id,
            "RELIANCE",
            "NSE",
            Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap(),
            Utc.with_ymd_and_hms(2024, 1, 1, 10, 0, 0).unwrap(),
            Timeframe::Minute1,
            Decimal::from(50000),
            DataSource::CSVFile(file_path.to_string()),
        );

        let result1 = engine.run_backtest(params1).await.unwrap();
        let result2 = engine.run_backtest(params2).await.unwrap();

        // Test comparison
        let comparison = engine.compare_backtests(vec![&result1.id, &result2.id]).await.unwrap();
        
        assert_eq!(comparison.backtests.len(), 2);
        assert!(comparison.metrics_comparison.contains_key("final_pnl"));
        assert!(comparison.metrics_comparison.contains_key("win_rate"));
        assert!(comparison.metrics_comparison.contains_key("sharpe_ratio"));
        
        // Each metric should have 2 values (one for each backtest)
        assert_eq!(comparison.metrics_comparison["final_pnl"].len(), 2);
        assert_eq!(comparison.metrics_comparison["win_rate"].len(), 2);
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
    async fn test_ohlcv_validation() {
        let config = CsvImportConfig::default();
        let parser = CsvParser::new(config);

        // Test valid OHLCV data
        let result = parser.validate_ohlcv_data(
            Decimal::from(100),
            Decimal::from(105),
            Decimal::from(99),
            Decimal::from(103),
            1000
        );
        assert!(result.is_ok());

        // Test invalid OHLCV data (high < open)
        let result = parser.validate_ohlcv_data(
            Decimal::from(100),
            Decimal::from(95),
            Decimal::from(99),
            Decimal::from(103),
            1000
        );
        assert!(result.is_err());

        // Test invalid OHLCV data (negative volume)
        let result = parser.validate_ohlcv_data(
            Decimal::from(100),
            Decimal::from(105),
            Decimal::from(99),
            Decimal::from(103),
            -1000
        );
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_date_format_detection() {
        let sample_lines = vec![
            "2024-01-01 09:15:00,100.0,105.0,99.0,103.0,1000".to_string(),
            "2024-01-01 09:16:00,103.0,106.0,102.0,105.0,1500".to_string(),
        ];

        let detected_format = CsvParser::detect_date_format(&sample_lines);
        assert_eq!(detected_format, Some("%Y-%m-%d %H:%M:%S".to_string()));

        // Test different format
        let sample_lines_2 = vec![
            "01/01/2024 09:15:00,100.0,105.0,99.0,103.0,1000".to_string(),
            "01/01/2024 09:16:00,103.0,106.0,102.0,105.0,1500".to_string(),
        ];

        let detected_format_2 = CsvParser::detect_date_format(&sample_lines_2);
        assert_eq!(detected_format_2, Some("%d/%m/%Y %H:%M:%S".to_string()));
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

    #[tokio::test]
    async fn test_equity_curve_generation() {
        let pool = Arc::new(create_test_db().await);
        let strategy_manager = Arc::new(StrategyManager::new(pool.clone()));
        let engine = BacktestEngine::new(pool.clone(), strategy_manager);

        let strategy_id = create_test_strategy(&pool).await;
        let temp_file = create_test_csv_file();
        let file_path = temp_file.path().to_str().unwrap();

        let _validation_result = engine.import_csv_data(file_path, "RELIANCE").await.unwrap();

        let params = BacktestParams::new(
            "test_user",
            &strategy_id,
            "RELIANCE",
            "NSE",
            Utc.with_ymd_and_hms(2024, 1, 1, 9, 15, 0).unwrap(),
            Utc.with_ymd_and_hms(2024, 1, 1, 10, 0, 0).unwrap(),
            Timeframe::Minute1,
            Decimal::from(100000),
            DataSource::CSVFile(file_path.to_string()),
        );

        let result = engine.run_backtest(params).await.unwrap();

        // Verify equity curve properties
        assert!(!result.equity_curve.is_empty());
        
        // First point should be initial capital
        assert_eq!(result.equity_curve[0].equity, Decimal::from(100000));
        
        // Equity curve should be chronologically ordered
        for i in 1..result.equity_curve.len() {
            assert!(result.equity_curve[i].timestamp >= result.equity_curve[i-1].timestamp);
        }
        
        // All equity values should be positive (no negative portfolio values)
        for point in &result.equity_curve {
            assert!(point.equity >= Decimal::ZERO);
        }
    }
}