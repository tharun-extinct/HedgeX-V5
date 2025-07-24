#[cfg(test)]
mod minimal_tests {
    use super::*;
    use crate::services::enhanced_database_service::EnhancedDatabaseService;
    use tempfile::tempdir;
    use std::path::PathBuf;
    use tokio;
    use std::sync::Arc;
    
    async fn setup_minimal_test_db() -> Arc<EnhancedDatabaseService> {
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
        
        // Insert test user
        sqlx::query("INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)")
            .bind("test_user")
            .bind("testuser")
            .bind("hashed_password")
            .execute(pool)
            .await
            .unwrap();
        
        Arc::new(db_service)
    }
    
    #[tokio::test]
    async fn test_strategy_service_basic_functionality() {
        let db_service = setup_minimal_test_db().await;
        let service = StrategyService::new(db_service).await.unwrap();
        
        // Test 1: Create strategy
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
        assert!(!strategy.enabled); // Should be disabled by default
        
        // Test 2: Get strategies
        let strategies = service.get_strategies("test_user").await.unwrap();
        assert_eq!(strategies.len(), 1);
        assert_eq!(strategies[0].id, strategy.id);
        
        // Test 3: Enable/Disable strategy
        service.enable_strategy("test_user", &strategy.id).await.unwrap();
        let enabled_strategy = service.get_strategy("test_user", &strategy.id).await.unwrap().unwrap();
        assert!(enabled_strategy.enabled);
        
        service.disable_strategy("test_user", &strategy.id).await.unwrap();
        let disabled_strategy = service.get_strategy("test_user", &strategy.id).await.unwrap().unwrap();
        assert!(!disabled_strategy.enabled);
        
        // Test 4: Parameter validation
        assert!(service.validate_strategy_params(10, 2.0, 1.0, 3.0, 100000).is_ok());
        assert!(service.validate_strategy_params(0, 2.0, 1.0, 3.0, 100000).is_err()); // Invalid max trades
        assert!(service.validate_strategy_params(10, 2.0, 3.0, 1.0, 100000).is_err()); // Take profit < stop loss
        
        // Test 5: NIFTY 50 stocks
        let stocks = service.get_nifty_50_stocks();
        assert_eq!(stocks.len(), 50);
        assert!(stocks.iter().any(|(symbol, _)| symbol == "RELIANCE"));
        
        // Test 6: Stock selection
        let selection = service.add_stock_selection("test_user", "RELIANCE", "NSE").await.unwrap();
        assert_eq!(selection.symbol, "RELIANCE");
        assert!(selection.is_active);
        
        let selections = service.get_stock_selections("test_user").await.unwrap();
        assert_eq!(selections.len(), 1);
        
        // Test 7: Invalid stock symbol
        let invalid_result = service.add_stock_selection("test_user", "INVALID_STOCK", "NSE").await;
        assert!(invalid_result.is_err());
        
        println!("✅ All strategy service tests passed!");
    }
    
    #[tokio::test]
    async fn test_strategy_validation_comprehensive() {
        let db_service = setup_minimal_test_db().await;
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
        
        println!("✅ All validation tests passed!");
    }
    
    #[tokio::test]
    async fn test_bulk_stock_operations() {
        let db_service = setup_minimal_test_db().await;
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
        
        println!("✅ Bulk operations tests passed!");
    }
}