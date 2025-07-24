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
        let pool = db_service.get_database().get_pool();
        
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
            date: Utc::now().date_naive(),
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