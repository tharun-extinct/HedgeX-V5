use crate::error::Result;
use crate::models::kite::KiteApiCredentials;
use crate::services::{EnhancedDatabaseService, WebSocketManager};
use std::sync::Arc;
use tokio::sync::broadcast;
use tokio::time::timeout;
use std::time::Duration;
use mockall::predicate::*;
use mockall::mock;
use std::path::PathBuf;
use tempfile::tempdir;

// Mock the EnhancedDatabaseService for testing
mock! {
    pub EnhancedDatabaseService {
        pub fn get_pool(&self) -> &sqlx::SqlitePool;
    }
}

#[tokio::test]
async fn test_websocket_manager_creation() {
    // Create a mock database service
    let mock_db_service = Arc::new(MockEnhancedDatabaseService::new());
    
    // Create WebSocketManager
    let ws_manager = WebSocketManager::new(mock_db_service);
    
    // Verify initial state
    let status = ws_manager.get_status().await;
    assert_eq!(status, crate::services::websocket_manager::ConnectionStatus::Disconnected);
}

#[tokio::test]
async fn test_set_credentials() {
    // Create a mock database service
    let mock_db_service = Arc::new(MockEnhancedDatabaseService::new());
    
    // Create WebSocketManager
    let ws_manager = WebSocketManager::new(mock_db_service);
    
    // Set credentials
    let credentials = KiteApiCredentials {
        api_key: "test_api_key".to_string(),
        api_secret: "test_api_secret".to_string(),
        access_token: Some("test_access_token".to_string()),
        access_token_expiry: Some(chrono::Utc::now() + chrono::Duration::hours(1)),
    };
    
    let result = ws_manager.set_credentials(credentials).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_subscribe_to_instruments() {
    // Create a mock database service
    let mock_db_service = Arc::new(MockEnhancedDatabaseService::new());
    
    // Create WebSocketManager
    let ws_manager = WebSocketManager::new(mock_db_service);
    
    // Subscribe to instruments
    let tokens = vec![12345, 67890];
    let mode = crate::services::websocket_manager::SubscriptionMode::Full;
    
    let result = ws_manager.subscribe_to_instruments(tokens, mode).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_unsubscribe_from_instruments() {
    // Create a mock database service
    let mock_db_service = Arc::new(MockEnhancedDatabaseService::new());
    
    // Create WebSocketManager
    let ws_manager = WebSocketManager::new(mock_db_service);
    
    // First subscribe to instruments
    let tokens = vec![12345, 67890];
    let mode = crate::services::websocket_manager::SubscriptionMode::Full;
    let _ = ws_manager.subscribe_to_instruments(tokens.clone(), mode).await;
    
    // Then unsubscribe
    let result = ws_manager.unsubscribe_from_instruments(tokens).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_market_data_validation() {
    use crate::services::websocket_manager::MarketData;
    use rust_decimal::Decimal;
    
    // Create valid market data
    let valid_data = MarketData {
        symbol: "TEST".to_string(),
        instrument_token: 12345,
        ltp: Decimal::new(10000, 2), // 100.00
        volume: 1000,
        bid: Decimal::new(9950, 2),  // 99.50
        ask: Decimal::new(10050, 2), // 100.50
        ohlc: None,
        timestamp: chrono::Utc::now(),
        change: None,
        change_percent: None,
    };
    
    // Test valid data
    assert!(valid_data.validate().is_ok());
    
    // Test invalid LTP
    let mut invalid_ltp = valid_data.clone();
    invalid_ltp.ltp = Decimal::new(0, 1); // 0.0
    assert!(invalid_ltp.validate().is_err());
    
    // Test invalid bid/ask (negative)
    let mut invalid_bid = valid_data.clone();
    invalid_bid.bid = Decimal::new(-100, 2); // -1.00
    assert!(invalid_bid.validate().is_err());
    
    // Test invalid bid/ask relationship (bid > ask)
    let mut invalid_spread = valid_data.clone();
    invalid_spread.bid = Decimal::new(11000, 2); // 110.00
    invalid_spread.ask = Decimal::new(10000, 2); // 100.00
    assert!(invalid_spread.validate().is_err());
}

#[tokio::test]
async fn test_market_data_broadcast() {
    // Create a mock database service
    let mock_db_service = Arc::new(MockEnhancedDatabaseService::new());
    
    // Create WebSocketManager
    let ws_manager = WebSocketManager::new(mock_db_service);
    
    // Subscribe to market data
    let mut receiver = ws_manager.subscribe_to_market_data();
    
    // Create market data
    use crate::services::websocket_manager::MarketData;
    use rust_decimal::Decimal;
    
    let market_data = MarketData {
        symbol: "TEST".to_string(),
        instrument_token: 12345,
        ltp: Decimal::new(10000, 2), // 100.00
        volume: 1000,
        bid: Decimal::new(9950, 2),  // 99.50
        ask: Decimal::new(10050, 2), // 100.50
        ohlc: None,
        timestamp: chrono::Utc::now(),
        change: None,
        change_percent: None,
    };
    
    // Broadcast market data
    let tx = ws_manager.get_market_data_sender();
    tx.send(market_data.clone()).expect("Failed to send market data");
    
    // Receive market data with timeout
    let received = timeout(Duration::from_secs(1), receiver.recv()).await;
    assert!(received.is_ok());
    
    let received_data = received.unwrap().expect("Failed to receive market data");
    assert_eq!(received_data.symbol, "TEST");
    assert_eq!(received_data.instrument_token, 12345);
}

// Integration test for database caching
#[tokio::test]
async fn test_market_data_caching() -> Result<()> {
    // Create a temporary directory for the database
    let temp_dir = tempdir().expect("Failed to create temp dir");
    let db_path = temp_dir.path().to_path_buf();
    
    // Create a real database service for this test
    let db_service = EnhancedDatabaseService::new(&db_path, "test_password").await?;
    
    // Run migrations to create the market_data_cache table
    db_service.run_migrations().await?;
    
    // Create WebSocketManager with real database
    let ws_manager = WebSocketManager::new(Arc::new(db_service));
    
    // Create market data
    use crate::services::websocket_manager::MarketData;
    use rust_decimal::Decimal;
    
    let market_data = MarketData {
        symbol: "TEST".to_string(),
        instrument_token: 12345,
        ltp: Decimal::new(10000, 2), // 100.00
        volume: 1000,
        bid: Decimal::new(9950, 2),  // 99.50
        ask: Decimal::new(10050, 2), // 100.50
        ohlc: None,
        timestamp: chrono::Utc::now(),
        change: None,
        change_percent: None,
    };
    
    // Cache market data
    WebSocketManager::cache_market_data_in_db(&ws_manager.get_db_service(), &market_data).await?;
    
    // Verify data was cached by querying the database
    let pool = ws_manager.get_db_service().get_pool();
    let cached_data = sqlx::query!(
        "SELECT symbol, ltp, volume FROM market_data_cache WHERE symbol = ?",
        market_data.symbol
    )
    .fetch_one(pool)
    .await?;
    
    assert_eq!(cached_data.symbol, "TEST");
    assert_eq!(cached_data.ltp, "100.00");
    assert_eq!(cached_data.volume, 1000);
    
    Ok(())
}