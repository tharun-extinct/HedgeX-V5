use crate::api::kite_client::{KiteApiClient, KiteClient};
use crate::error::{HedgeXError, Result, ResultExt};
use crate::models::kite::{
    KiteApiCredentials, KiteOrderRequest, KiteOrderResponse, KitePosition, 
    KiteOrder, KiteHolding, KiteMarginResponse, KiteProfile, KiteQuote,
    KiteHistoricalDataParams, KiteOHLCV, KiteInstrument, KiteExchange,
    KiteOrderVariety,
};
use crate::services::enhanced_database_service::EnhancedDatabaseService;
use sqlx::{Row, sqlite::SqliteRow};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, RwLock};
use tokio::time::sleep;
use tracing::{debug, error, info, warn, instrument, Span, span, Level};
use chrono::{DateTime, Utc};
use std::fmt;

/// Service for managing Kite API operations
pub struct KiteService {
    /// Database service for storing credentials
    db_service: Arc<EnhancedDatabaseService>,
    
    /// Kite API client
    client: RwLock<Option<Arc<dyn KiteApiClient + Send + Sync>>>,
    
    /// Last credential refresh time
    last_refresh: Mutex<Instant>,
    
    /// Credential refresh interval
    refresh_interval: Duration,
    
    /// User ID for the current session
    user_id: String,
}

impl KiteService {
    /// Create a new Kite service
    pub async fn new(
        db_service: Arc<EnhancedDatabaseService>,
        user_id: &str,
    ) -> Result<Self> {
        let service = Self {
            db_service,
            client: RwLock::new(None),
            last_refresh: Mutex::new(Instant::now()),
            refresh_interval: Duration::from_secs(3600), // 1 hour
            user_id: user_id.to_string(),
        };
        
        // Initialize client with stored credentials
        service.initialize_client().await?;
        
        Ok(service)
    }
    
    /// Initialize Kite client with stored credentials
    async fn initialize_client(&self) -> Result<()> {
        // Get credentials from database
        let credentials = self.get_stored_credentials().await?;
        
        // Create client with API key
        let client = KiteClient::new(&credentials.api_key)?;
        
        // Set access token if available
        if let Some(token) = credentials.access_token {
            client.set_access_token(token).await;
        }
        
        // Store client
        let mut client_guard = self.client.write().await;
        *client_guard = Some(Arc::new(client));
        
        Ok(())
    }
    
    /// Get stored API credentials from database
    async fn get_stored_credentials(&self) -> Result<KiteApiCredentials> {
        let query = "SELECT api_key, api_secret, access_token, access_token_expiry FROM kite_credentials WHERE user_id = ?";
        
        let row = sqlx::query(query)
            .bind(&self.user_id)
            .fetch_optional(self.db_service.get_database().get_pool())
            .await?;
            
        match row {
            Some(row) => {
                let api_key = row.get::<String, _>("api_key");
                let encrypted_secret = row.get::<String, _>("api_secret");
                let encrypted_token = row.get::<Option<String>, _>("access_token");
                let expiry = row.get::<Option<DateTime<Utc>>, _>("access_token_expiry");
                
                // Decrypt API secret
                let api_secret = self.db_service.decrypt_sensitive("kite_api_secret", &encrypted_secret).await?;
                
                // Decrypt access token if available
                let access_token = match encrypted_token {
                    Some(token) => {
                        let decrypted = self.db_service.decrypt_sensitive("kite_access_token", &token).await?;
                        Some(decrypted)
                    },
                    None => None,
                };
                
                Ok(KiteApiCredentials {
                    api_key,
                    api_secret,
                    access_token,
                    access_token_expiry: expiry,
                })
            },
            None => Err(HedgeXError::NotFoundError(format!("No Kite API credentials found for user {}", self.user_id))),
        }
    }
    
    /// Store API credentials in database
    async fn store_credentials(&self, credentials: &KiteApiCredentials) -> Result<()> {
        // Encrypt sensitive data
        let encrypted_secret = self.db_service.encrypt_sensitive("kite_api_secret", &credentials.api_secret).await?;
        
        let encrypted_token = match &credentials.access_token {
            Some(token) => {
                let encrypted = self.db_service.encrypt_sensitive("kite_access_token", token).await?;
                Some(encrypted)
            },
            None => None,
        };
        
        // Check if credentials already exist
        let exists = sqlx::query("SELECT 1 FROM kite_credentials WHERE user_id = ?")
            .bind(&self.user_id)
            .fetch_optional(self.db_service.get_database().get_pool())
            .await?
            .is_some();
            
        if exists {
            // Update existing credentials
            sqlx::query(
                "UPDATE kite_credentials SET api_key = ?, api_secret = ?, access_token = ?, access_token_expiry = ? WHERE user_id = ?"
            )
            .bind(&credentials.api_key)
            .bind(&encrypted_secret)
            .bind(&encrypted_token)
            .bind(&credentials.access_token_expiry)
            .bind(&self.user_id)
            .execute(self.db_service.get_database().get_pool())
            .await?;
        } else {
            // Insert new credentials
            sqlx::query(
                "INSERT INTO kite_credentials (user_id, api_key, api_secret, access_token, access_token_expiry) VALUES (?, ?, ?, ?, ?)"
            )
            .bind(&self.user_id)
            .bind(&credentials.api_key)
            .bind(&encrypted_secret)
            .bind(&encrypted_token)
            .bind(&credentials.access_token_expiry)
            .execute(self.db_service.get_database().get_pool())
            .await?;
        }
        
        Ok(())
    }
    
    /// Update access token in database
    async fn update_access_token(&self, token: &str, expiry: DateTime<Utc>) -> Result<()> {
        // Encrypt token
        let encrypted_token = self.db_service.encrypt_sensitive("kite_access_token", token).await?;
        
        // Update in database
        sqlx::query(
            "UPDATE kite_credentials SET access_token = ?, access_token_expiry = ? WHERE user_id = ?"
        )
        .bind(&encrypted_token)
        .bind(&expiry)
        .bind(&self.user_id)
        .execute(self.db_service.get_database().get_pool())
        .await?;
        
        Ok(())
    }
    
    /// Get Kite client
    async fn get_client(&self) -> Result<Arc<dyn KiteApiClient + Send + Sync>> {
        let client_guard = self.client.read().await;
        
        match &*client_guard {
            Some(client) => Ok(Arc::clone(client)),
            None => Err(HedgeXError::ConfigError("Kite client not initialized".to_string())),
        }
    }
    
    /// Check if access token needs refresh
    async fn check_token_refresh(&self) -> Result<bool> {
        // Get credentials
        let credentials = self.get_stored_credentials().await?;
        
        // Check if token exists and is about to expire
        match (credentials.access_token, credentials.access_token_expiry) {
            (Some(_), Some(expiry)) => {
                // Refresh if token expires in less than 1 hour
                let now = Utc::now();
                let refresh_threshold = chrono::Duration::hours(1);
                
                if expiry - now < refresh_threshold {
                    debug!("Access token expiring soon, needs refresh");
                    Ok(true)
                } else {
                    Ok(false)
                }
            },
            _ => {
                debug!("No access token or expiry, needs refresh");
                Ok(true)
            },
        }
    }
    
    /// Generate session URL for login
    pub fn generate_session_url(&self, api_key: &str) -> String {
        format!("https://kite.zerodha.com/connect/login?api_key={}", api_key)
    }
    
    /// Generate session token from request token
    pub async fn generate_session(&self, request_token: &str) -> Result<String> {
        // Get credentials
        let credentials = self.get_stored_credentials().await?;
        
        // Get client
        let client = self.get_client().await?;
        
        // Generate session
        let access_token = client.generate_session(request_token, &credentials.api_secret).await?;
        
        // Calculate expiry (typically 1 day for Kite)
        let expiry = Utc::now() + chrono::Duration::days(1);
        
        // Update access token in database
        self.update_access_token(&access_token, expiry).await?;
        
        // Update credentials
        let mut updated_credentials = credentials;
        updated_credentials.access_token = Some(access_token.clone());
        updated_credentials.access_token_expiry = Some(expiry);
        
        // Store updated credentials
        self.store_credentials(&updated_credentials).await?;
        
        Ok(access_token)
    }
    
    /// Set API credentials
    pub async fn set_credentials(&self, api_key: &str, api_secret: &str) -> Result<()> {
        // Create credentials object
        let credentials = KiteApiCredentials {
            api_key: api_key.to_string(),
            api_secret: api_secret.to_string(),
            access_token: None,
            access_token_expiry: None,
        };
        
        // Store credentials
        self.store_credentials(&credentials).await?;
        
        // Reinitialize client
        self.initialize_client().await?;
        
        Ok(())
    }
    
    /// Invalidate session
    pub async fn invalidate_session(&self) -> Result<()> {
        // Get client
        let client = self.get_client().await?;
        
        // Invalidate session
        client.invalidate_session().await?;
        
        // Update database
        sqlx::query(
            "UPDATE kite_credentials SET access_token = NULL, access_token_expiry = NULL WHERE user_id = ?"
        )
        .bind(&self.user_id)
        .execute(self.db_service.get_database().get_pool())
        .await?;
        
        Ok(())
    }
    
    /// Get user profile
    pub async fn get_profile(&self) -> Result<KiteProfile> {
        // Check if token needs refresh
        if self.check_token_refresh().await? {
            return Err(HedgeXError::SessionError);
        }
        
        // Get client
        let client = self.get_client().await?;
        
        // Get profile
        client.get_profile().await
    }
    
    /// Get account margins
    pub async fn get_margins(&self) -> Result<KiteMarginResponse> {
        // Check if token needs refresh
        if self.check_token_refresh().await? {
            return Err(HedgeXError::SessionError);
        }
        
        // Get client
        let client = self.get_client().await?;
        
        // Get margins
        client.get_margins().await
    }
    
    /// Get order book
    pub async fn get_orders(&self) -> Result<Vec<KiteOrder>> {
        // Check if token needs refresh
        if self.check_token_refresh().await? {
            return Err(HedgeXError::SessionError);
        }
        
        // Get client
        let client = self.get_client().await?;
        
        // Get orders
        client.get_orders().await
    }
    
    /// Get order history
    pub async fn get_order_history(&self, order_id: &str) -> Result<Vec<KiteOrder>> {
        // Check if token needs refresh
        if self.check_token_refresh().await? {
            return Err(HedgeXError::SessionError);
        }
        
        // Get client
        let client = self.get_client().await?;
        
        // Get order history
        client.get_order_history(order_id).await
    }
    
    /// Get trades
    pub async fn get_trades(&self) -> Result<Vec<KiteOrder>> {
        // Check if token needs refresh
        if self.check_token_refresh().await? {
            return Err(HedgeXError::SessionError);
        }
        
        // Get client
        let client = self.get_client().await?;
        
        // Get trades
        client.get_trades().await
    }
    
    /// Get positions
    pub async fn get_positions(&self) -> Result<KitePosition> {
        // Check if token needs refresh
        if self.check_token_refresh().await? {
            return Err(HedgeXError::SessionError);
        }
        
        // Get client
        let client = self.get_client().await?;
        
        // Get positions
        client.get_positions().await
    }
    
    /// Get holdings
    pub async fn get_holdings(&self) -> Result<Vec<KiteHolding>> {
        // Check if token needs refresh
        if self.check_token_refresh().await? {
            return Err(HedgeXError::SessionError);
        }
        
        // Get client
        let client = self.get_client().await?;
        
        // Get holdings
        client.get_holdings().await
    }
    
    /// Get instruments
    pub async fn get_instruments(&self, exchange: Option<KiteExchange>) -> Result<Vec<KiteInstrument>> {
        // Check if token needs refresh
        if self.check_token_refresh().await? {
            return Err(HedgeXError::SessionError);
        }
        
        // Get client
        let client = self.get_client().await?;
        
        // Get instruments
        client.get_instruments(exchange).await
    }
    
    /// Get quotes
    pub async fn get_quote(&self, instruments: &[String]) -> Result<HashMap<String, KiteQuote>> {
        // Check if token needs refresh
        if self.check_token_refresh().await? {
            return Err(HedgeXError::SessionError);
        }
        
        // Get client
        let client = self.get_client().await?;
        
        // Get quotes
        client.get_quote(instruments).await
    }
    
    /// Get historical data
    pub async fn get_historical_data(&self, params: KiteHistoricalDataParams) -> Result<Vec<KiteOHLCV>> {
        // Check if token needs refresh
        if self.check_token_refresh().await? {
            return Err(HedgeXError::SessionError);
        }
        
        // Get client
        let client = self.get_client().await?;
        
        // Get historical data
        client.get_historical_data(params).await
    }
    
    /// Place order
    pub async fn place_order(&self, order: KiteOrderRequest) -> Result<KiteOrderResponse> {
        // Check if token needs refresh
        if self.check_token_refresh().await? {
            return Err(HedgeXError::SessionError);
        }
        
        // Get client
        let client = self.get_client().await?;
        
        // Place order
        let response = client.place_order(order).await?;
        
        // Log order placement
        info!("Order placed successfully: {}", response.order_id);
        
        Ok(response)
    }
    
    /// Modify order
    pub async fn modify_order(&self, order_id: &str, order: KiteOrderRequest) -> Result<KiteOrderResponse> {
        // Check if token needs refresh
        if self.check_token_refresh().await? {
            return Err(HedgeXError::SessionError);
        }
        
        // Get client
        let client = self.get_client().await?;
        
        // Modify order
        let response = client.modify_order(order_id, order).await?;
        
        // Log order modification
        info!("Order modified successfully: {}", response.order_id);
        
        Ok(response)
    }
    
    /// Cancel order
    pub async fn cancel_order(&self, order_id: &str, variety: KiteOrderVariety) -> Result<KiteOrderResponse> {
        // Check if token needs refresh
        if self.check_token_refresh().await? {
            return Err(HedgeXError::SessionError);
        }
        
        // Get client
        let client = self.get_client().await?;
        
        // Cancel order
        let response = client.cancel_order(order_id, variety).await?;
        
        // Log order cancellation
        info!("Order cancelled successfully: {}", response.order_id);
        
        Ok(response)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::kite_client::KiteApiClient;
    use async_trait::async_trait;
    use mockall::mock;
    use mockall::predicate::*;
    use std::path::PathBuf;
    use tempfile::tempdir;
    
    // Mock Kite API client
    mock! {
        KiteApiClientMock {}
        
        #[async_trait]
        impl KiteApiClient for KiteApiClientMock {
            async fn set_access_token(&self, access_token: String);
            async fn get_access_token(&self) -> Option<String>;
            fn generate_session_url(&self, api_key: &str) -> String;
            async fn generate_session(&self, request_token: &str, api_secret: &str) -> Result<String>;
            async fn invalidate_session(&self) -> Result<()>;
            async fn get_profile(&self) -> Result<KiteProfile>;
            async fn get_margins(&self) -> Result<KiteMarginResponse>;
            async fn get_orders(&self) -> Result<Vec<KiteOrder>>;
            async fn get_order_history(&self, order_id: &str) -> Result<Vec<KiteOrder>>;
            async fn get_trades(&self) -> Result<Vec<KiteOrder>>;
            async fn get_positions(&self) -> Result<KitePosition>;
            async fn get_holdings(&self) -> Result<Vec<KiteHolding>>;
            async fn get_instruments(&self, exchange: Option<KiteExchange>) -> Result<Vec<KiteInstrument>>;
            async fn get_quote(&self, instruments: &[String]) -> Result<HashMap<String, KiteQuote>>;
            async fn get_historical_data(&self, params: KiteHistoricalDataParams) -> Result<Vec<KiteOHLCV>>;
            async fn place_order(&self, order: KiteOrderRequest) -> Result<KiteOrderResponse>;
            async fn modify_order(&self, order_id: &str, order: KiteOrderRequest) -> Result<KiteOrderResponse>;
            async fn cancel_order(&self, order_id: &str, variety: KiteOrderVariety) -> Result<KiteOrderResponse>;
        }
    }
    
    // Helper function to create test database
    async fn setup_test_db() -> (Arc<EnhancedDatabaseService>, PathBuf) {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().to_path_buf();
        
        // Create database service
        let db_service = EnhancedDatabaseService::new(&db_path, "test_password")
            .await
            .unwrap();
            
        // Create kite_credentials table
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS kite_credentials (
                user_id TEXT PRIMARY KEY,
                api_key TEXT NOT NULL,
                api_secret TEXT NOT NULL,
                access_token TEXT,
                access_token_expiry TIMESTAMP
            )"
        )
        .execute(db_service.get_database().get_pool())
        .await
        .unwrap();
        
        (Arc::new(db_service), db_path)
    }
    
    #[tokio::test]
    async fn test_set_credentials() {
        let (db_service, _) = setup_test_db().await;
        
        // Create service
        let service = KiteService::new(db_service.clone(), "test_user")
            .await
            .unwrap();
            
        // Set credentials
        service.set_credentials("test_api_key", "test_api_secret")
            .await
            .unwrap();
            
        // Verify credentials were stored
        let credentials = service.get_stored_credentials().await.unwrap();
        assert_eq!(credentials.api_key, "test_api_key");
        assert_eq!(credentials.api_secret, "test_api_secret");
        assert_eq!(credentials.access_token, None);
    }
    
    #[tokio::test]
    async fn test_generate_session() {
        let (db_service, _) = setup_test_db().await;
        
        // Create service
        let mut service = KiteService::new(db_service.clone(), "test_user")
            .await
            .unwrap();
            
        // Set credentials
        service.set_credentials("test_api_key", "test_api_secret")
            .await
            .unwrap();
            
        // Create mock client
        let mut mock_client = MockKiteApiClientMock::new();
        mock_client
            .expect_generate_session()
            .with(eq("test_request_token"), eq("test_api_secret"))
            .returning(|_, _| Ok("test_access_token".to_string()));
            
        // Replace client with mock
        let client_arc: Arc<dyn KiteApiClient + Send + Sync> = Arc::new(mock_client);
        *service.client.write().await = Some(client_arc);
        
        // Generate session
        let token = service.generate_session("test_request_token")
            .await
            .unwrap();
            
        // Verify token
        assert_eq!(token, "test_access_token");
        
        // Verify token was stored
        let credentials = service.get_stored_credentials().await.unwrap();
        assert_eq!(credentials.access_token, Some("test_access_token".to_string()));
        assert!(credentials.access_token_expiry.is_some());
    }
    
    #[tokio::test]
    async fn test_invalidate_session() {
        let (db_service, _) = setup_test_db().await;
        
        // Create service
        let mut service = KiteService::new(db_service.clone(), "test_user")
            .await
            .unwrap();
            
        // Set credentials with access token
        service.set_credentials("test_api_key", "test_api_secret")
            .await
            .unwrap();
            
        // Update access token directly in database
        sqlx::query(
            "UPDATE kite_credentials SET access_token = ?, access_token_expiry = ? WHERE user_id = ?"
        )
        .bind("encrypted_token")
        .bind(Utc::now())
        .bind("test_user")
        .execute(db_service.get_database().get_pool())
        .await
        .unwrap();
        
        // Create mock client
        let mut mock_client = MockKiteApiClientMock::new();
        mock_client
            .expect_invalidate_session()
            .returning(|| Ok(()));
            
        // Replace client with mock
        let client_arc: Arc<dyn KiteApiClient + Send + Sync> = Arc::new(mock_client);
        *service.client.write().await = Some(client_arc);
        
        // Invalidate session
        service.invalidate_session()
            .await
            .unwrap();
            
        // Verify token was removed
        let credentials = service.get_stored_credentials().await.unwrap();
        assert_eq!(credentials.access_token, None);
        assert_eq!(credentials.access_token_expiry, None);
    }
    
    #[tokio::test]
    async fn test_place_order() {
        let (db_service, _) = setup_test_db().await;
        
        // Create service
        let mut service = KiteService::new(db_service.clone(), "test_user")
            .await
            .unwrap();
            
        // Set credentials with access token
        service.set_credentials("test_api_key", "test_api_secret")
            .await
            .unwrap();
            
        // Update access token directly in database
        let expiry = Utc::now() + chrono::Duration::days(1);
        sqlx::query(
            "UPDATE kite_credentials SET access_token = ?, access_token_expiry = ? WHERE user_id = ?"
        )
        .bind("encrypted_token")
        .bind(expiry)
        .bind("test_user")
        .execute(db_service.get_database().get_pool())
        .await
        .unwrap();
        
        // Create mock client
        let mut mock_client = MockKiteApiClientMock::new();
        mock_client
            .expect_get_access_token()
            .returning(|| Some("test_access_token".to_string()));
            
        mock_client
            .expect_place_order()
            .returning(|_| Ok(KiteOrderResponse { order_id: "test_order_id".to_string() }));
            
        // Replace client with mock
        let client_arc: Arc<dyn KiteApiClient + Send + Sync> = Arc::new(mock_client);
        *service.client.write().await = Some(client_arc);
        
        // Create order request
        let order = KiteOrderRequest {
            tradingsymbol: "INFY".to_string(),
            exchange: KiteExchange::NSE,
            transaction_type: crate::models::kite::KiteTransactionType::Buy,
            order_type: crate::models::kite::KiteOrderType::Market,
            quantity: 10,
            price: None,
            product: crate::models::kite::KiteProduct::CNC,
            validity: crate::models::kite::KiteValidity::Day,
            disclosed_quantity: None,
            trigger_price: None,
            squareoff: None,
            stoploss: None,
            trailing_stoploss: None,
            variety: KiteOrderVariety::Regular,
        };
        
        // Place order
        let response = service.place_order(order)
            .await
            .unwrap();
            
        // Verify response
        assert_eq!(response.order_id, "test_order_id");
    }
}