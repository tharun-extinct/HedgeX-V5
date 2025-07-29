use crate::error::{HedgeXError, Result};
use crate::models::kite::{
    KiteApiCredentials, KiteOrderRequest, KiteOrderResponse, KitePosition, 
    KiteOrder, KiteHolding, KiteMarginResponse, KiteProfile, KiteQuote,
    KiteHistoricalDataParams, KiteOHLCV, KiteInstrument, KiteOrderStatus,
    KiteOrderType, KiteOrderVariety, KiteExchange, KiteProduct, KiteValidity,
    KiteTransactionType, KiteTriggerType, KiteDiscloseQuantity,
};
use reqwest::{Client, StatusCode, header};
use serde::{Serialize, Deserialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, RwLock};
use tokio::time::sleep;
use tracing::{debug, error, info, warn, instrument, Span, span, Level};
use sha2::{Sha256, Digest};
use hmac::{Hmac, Mac};
use base64::{Engine as _, engine::general_purpose};
use rand::Rng;
use std::fmt;
use std::str::FromStr;
use async_trait::async_trait;

type HmacSha256 = Hmac<Sha256>;

/// Maximum number of retry attempts for API calls
const MAX_RETRY_ATTEMPTS: u32 = 5;

/// Base URL for Kite API
const KITE_API_URL: &str = "https://api.kite.trade";

/// Base URL for Kite Connect API
const KITE_CONNECT_URL: &str = "https://kite.zerodha.com/connect";

/// Trait for Kite API client operations
#[async_trait]
pub trait KiteApiClient: Send + Sync {
    /// Set access token for API calls
    async fn set_access_token(&self, access_token: String);
    
    /// Get access token
    async fn get_access_token(&self) -> Option<String>;
    
    /// Generate session URL for login
    fn generate_session_url(&self, api_key: &str) -> String;
    
    /// Generate session token from request token
    async fn generate_session(&self, request_token: &str, api_secret: &str) -> Result<String>;
    
    /// Invalidate session
    async fn invalidate_session(&self) -> Result<()>;
    
    /// Get user profile
    async fn get_profile(&self) -> Result<KiteProfile>;
    
    /// Get account margins
    async fn get_margins(&self) -> Result<KiteMarginResponse>;
    
    /// Get order book
    async fn get_orders(&self) -> Result<Vec<KiteOrder>>;
    
    /// Get order history
    async fn get_order_history(&self, order_id: &str) -> Result<Vec<KiteOrder>>;
    
    /// Get trades
    async fn get_trades(&self) -> Result<Vec<KiteOrder>>;
    
    /// Get positions
    async fn get_positions(&self) -> Result<KitePosition>;
    
    /// Get holdings
    async fn get_holdings(&self) -> Result<Vec<KiteHolding>>;
    
    /// Get instruments
    async fn get_instruments(&self, exchange: Option<KiteExchange>) -> Result<Vec<KiteInstrument>>;
    
    /// Get quotes
    async fn get_quote(&self, instruments: &[String]) -> Result<HashMap<String, KiteQuote>>;
    
    /// Get historical data
    async fn get_historical_data(&self, params: KiteHistoricalDataParams) -> Result<Vec<KiteOHLCV>>;
    
    /// Place order
    async fn place_order(&self, order: KiteOrderRequest) -> Result<KiteOrderResponse>;
    
    /// Modify order
    async fn modify_order(&self, order_id: &str, order: KiteOrderRequest) -> Result<KiteOrderResponse>;
    
    /// Cancel order
    async fn cancel_order(&self, order_id: &str, variety: KiteOrderVariety) -> Result<KiteOrderResponse>;
}

/// Kite API client implementation
pub struct KiteClient {
    /// HTTP client for API requests
    client: Client,
    
    /// API key for authentication
    api_key: String,
    
    /// Access token for authenticated requests
    access_token: RwLock<Option<String>>,
    
    /// Last API call timestamp for rate limiting
    last_api_call: Mutex<Instant>,
    
    /// Minimum time between API calls in milliseconds
    rate_limit_ms: u64,
    
    /// Base URL for API requests
    base_url: String,
}

impl KiteClient {
    /// Create a new Kite API client
    pub fn new(api_key: &str) -> Result<Self> {
        Self::new_with_config(api_key, KITE_API_URL, 200)
    }
    
    /// Create a new Kite API client with custom configuration
    pub fn new_with_config(api_key: &str, base_url: &str, rate_limit_ms: u64) -> Result<Self> {
        // Create HTTP client with appropriate timeouts and headers
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .connect_timeout(Duration::from_secs(10))
            .pool_idle_timeout(Duration::from_secs(60))
            .pool_max_idle_per_host(10)
            .build()
            .map_err(|e| HedgeXError::NetworkError(e))?;
            
        Ok(Self {
            client,
            api_key: api_key.to_string(),
            access_token: RwLock::new(None),
            last_api_call: Mutex::new(Instant::now()),
            rate_limit_ms,
            base_url: base_url.to_string(),
        })
    }
    
    /// Create API request URL
    fn create_url(&self, endpoint: &str) -> String {
        format!("{}{}", self.base_url, endpoint)
    }
    
    /// Create request headers
    async fn create_headers(&self) -> Result<header::HeaderMap> {
        let mut headers = header::HeaderMap::new();
        
        // Add API key header
        headers.insert(
            "X-Kite-Version",
            header::HeaderValue::from_static("3"),
        );
        
        // Add authorization header if access token is available
        if let Some(token) = self.get_access_token().await {
            let auth_value = format!("token {}:{}", self.api_key, token);
            headers.insert(
                header::AUTHORIZATION,
                header::HeaderValue::from_str(&auth_value)
                    .map_err(|e| HedgeXError::ValidationError(e.to_string()))?,
            );
        }
        
        // Add content type for JSON
        headers.insert(
            header::CONTENT_TYPE,
            header::HeaderValue::from_static("application/json"),
        );
        
        // Add user agent
        headers.insert(
            header::USER_AGENT,
            header::HeaderValue::from_static("HedgeX/1.0"),
        );
        
        Ok(headers)
    }
    
    /// Apply rate limiting to API calls
    async fn apply_rate_limit(&self) {
        let mut last_call = self.last_api_call.lock().await;
        let elapsed = last_call.elapsed();
        let min_interval = Duration::from_millis(self.rate_limit_ms);
        
        // If we've made a request too recently, sleep for the remaining time
        if elapsed < min_interval {
            let sleep_duration = min_interval - elapsed;
            debug!("Rate limiting: sleeping for {}ms", sleep_duration.as_millis());
            sleep(sleep_duration).await;
        }
        
        // Update last call time
        *last_call = Instant::now();
    }
    
    /// Make API request with retry and backoff
    #[instrument(skip(self, body), fields(endpoint = %endpoint, method = %method))]
    async fn make_request<T, U>(&self, method: &str, endpoint: &str, body: Option<&T>) -> Result<U>
    where
        T: Serialize + Send + Sync,
        U: for<'de> Deserialize<'de> + Send + Sync,
    {
        // Apply rate limiting
        self.apply_rate_limit().await;
        
        let url = self.create_url(endpoint);
        let headers = self.create_headers().await?;
        
        // Create request builder based on method
        let mut request_builder = match method {
            "GET" => self.client.get(&url),
            "POST" => self.client.post(&url),
            "PUT" => self.client.put(&url),
            "DELETE" => self.client.delete(&url),
            _ => return Err(HedgeXError::ValidationError(format!("Unsupported HTTP method: {}", method))),
        };
        
        // Add headers and body
        request_builder = request_builder.headers(headers);
        if let Some(data) = body {
            request_builder = request_builder.json(data);
        }
        
        // Execute request with retry and exponential backoff
        let mut attempt = 0;
        let mut last_error = None;
        
        while attempt < MAX_RETRY_ATTEMPTS {
            match request_builder.try_clone() {
                Some(builder) => {
                    // Execute request
                    match builder.send().await {
                        Ok(response) => {
                            let status = response.status();
                            
                            // Handle response based on status code
                            if status.is_success() {
                                // Parse successful response
                                match response.json::<KiteApiResponse<U>>().await {
                                    Ok(api_response) => {
                                        if api_response.status == "success" {
                                            debug!("API request successful: {}", endpoint);
                                            return Ok(api_response.data);
                                        } else {
                                            let error_msg = format!(
                                                "API error: {} ({})",
                                                api_response.error_message.clone().unwrap_or_else(|| "Unknown error".to_string()),
                                                api_response.error_type.clone().unwrap_or_else(|| "unknown".to_string())
                                            );
                                            error!("{}", error_msg);
                                            return Err(self.map_api_error(&api_response));
                                        }
                                    }
                                    Err(e) => {
                                        error!("Failed to parse API response: {}", e);
                                        last_error = Some(HedgeXError::NetworkError(e));
                                    }
                                }
                            } else {
                                // Handle error response
                                match response.json::<KiteApiResponse<Value>>().await {
                                    Ok(api_response) => {
                                        let error_msg = format!(
                                            "API error ({}): {} ({})",
                                            status.as_u16(),
                                            api_response.error_message.clone().unwrap_or_else(|| "Unknown error".to_string()),
                                            api_response.error_type.clone().unwrap_or_else(|| "unknown".to_string())
                                        );
                                        error!("{}", error_msg);
                                        
                                        // Check if we should retry based on status code
                                        if Self::should_retry(status) {
                                            last_error = Some(self.map_api_error(&api_response));
                                        } else {
                                            return Err(self.map_api_error(&api_response));
                                        }
                                    }
                                    Err(e) => {
                                        error!("Failed to parse error response: {}", e);
                                        last_error = Some(HedgeXError::NetworkError(e));
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            error!("Request failed: {}", e);
                            
                            // Check if we should retry based on error
                            if e.is_timeout() || e.is_connect() {
                                last_error = Some(HedgeXError::NetworkError(e));
                            } else {
                                return Err(HedgeXError::NetworkError(e));
                            }
                        }
                    }
                }
                None => {
                    error!("Failed to clone request builder");
                    return Err(HedgeXError::InternalError("Failed to clone request builder".to_string()));
                }
            }
            
            // Increment attempt counter
            attempt += 1;
            
            // If this was the last attempt, return the last error
            if attempt >= MAX_RETRY_ATTEMPTS {
                error!("Max retry attempts reached for API request");
                return Err(last_error.unwrap_or_else(|| {
                    HedgeXError::ApiError("Max retry attempts reached".to_string())
                }));
            }
            
            // Calculate backoff duration with jitter
            let backoff_ms = self.calculate_backoff_ms(attempt);
            warn!("Retrying API request in {}ms (attempt {}/{})", backoff_ms, attempt + 1, MAX_RETRY_ATTEMPTS);
            
            // Sleep for backoff duration
            sleep(Duration::from_millis(backoff_ms)).await;
        }
        
        // This should never be reached due to the return in the loop
        Err(HedgeXError::InternalError("Unexpected error in API request".to_string()))
    }
    
    /// Calculate backoff duration with exponential backoff and jitter
    fn calculate_backoff_ms(&self, attempt: u32) -> u64 {
        let base_ms = 100;
        let max_ms = 30000; // 30 seconds max
        
        // Calculate exponential backoff
        let exp_backoff = base_ms * 2u64.pow(attempt);
        
        // Apply jitter (±20%)
        let jitter_factor = 0.8 + (rand::thread_rng().gen::<f64>() * 0.4);
        let backoff_with_jitter = (exp_backoff as f64 * jitter_factor) as u64;
        
        // Cap at maximum backoff
        std::cmp::min(backoff_with_jitter, max_ms)
    }
    
    /// Determine if we should retry based on status code
    fn should_retry(status: StatusCode) -> bool {
        match status.as_u16() {
            408 | // Request Timeout
            429 | // Too Many Requests
            500 | // Internal Server Error
            502 | // Bad Gateway
            503 | // Service Unavailable
            504 => true, // Gateway Timeout
            _ => false,
        }
    }
    
    /// Map API error response to HedgeXError
    fn map_api_error<T>(&self, response: &KiteApiResponse<T>) -> HedgeXError {
        let error_type = response.error_type.as_deref().unwrap_or("unknown");
        let error_message = response.error_message.as_deref().unwrap_or("Unknown error");
        
        match error_type {
            "TokenException" => HedgeXError::AuthenticationError(error_message.to_string()),
            "PermissionException" => HedgeXError::PermissionError(error_message.to_string()),
            "InputException" => HedgeXError::ValidationError(error_message.to_string()),
            "OrderException" => HedgeXError::TradingError(error_message.to_string()),
            "DataException" => HedgeXError::DataIntegrityError(error_message.to_string()),
            "NetworkException" => HedgeXError::ExternalServiceError(error_message.to_string()),
            "GeneralException" => HedgeXError::ApiError(error_message.to_string()),
            "TooManyRequestsException" => HedgeXError::RateLimitError(error_message.to_string()),
            _ => HedgeXError::ApiError(format!("{}: {}", error_type, error_message)),
        }
    }
    
    /// Generate checksum for request signing
    fn generate_checksum(&self, api_key: &str, request_token: &str, api_secret: &str) -> Result<String> {
        let message = format!("{}{}{}", api_key, request_token, api_secret);
        
        let mut mac = HmacSha256::new_from_slice(api_secret.as_bytes())
            .map_err(|e| HedgeXError::CryptoError(e.to_string()))?;
            
        mac.update(message.as_bytes());
        let result = mac.finalize();
        let bytes = result.into_bytes();
        
        Ok(general_purpose::STANDARD.encode(bytes))
    }
}

#[async_trait]
impl KiteApiClient for KiteClient {
    async fn set_access_token(&self, access_token: String) {
        let mut token = self.access_token.write().await;
        *token = Some(access_token);
        debug!("Access token set successfully");
    }
    
    async fn get_access_token(&self) -> Option<String> {
        let token = self.access_token.read().await;
        token.clone()
    }
    
    fn generate_session_url(&self, api_key: &str) -> String {
        format!("{}/login?api_key={}", KITE_CONNECT_URL, api_key)
    }
    
    async fn generate_session(&self, request_token: &str, api_secret: &str) -> Result<String> {
        let checksum = self.generate_checksum(&self.api_key, request_token, api_secret)?;
        
        #[derive(Serialize)]
        struct SessionRequest {
            request_token: String,
            checksum: String,
        }
        
        let request = SessionRequest {
            request_token: request_token.to_string(),
            checksum,
        };
        
        #[derive(Deserialize)]
        struct SessionResponse {
            access_token: String,
        }
        
        let response: SessionResponse = self.make_request("POST", "/session/token", Some(&request)).await?;
        
        // Set the access token
        self.set_access_token(response.access_token.clone()).await;
        
        Ok(response.access_token)
    }
    
    async fn invalidate_session(&self) -> Result<()> {
        // Make request to invalidate session
        let _: Value = self.make_request("DELETE", "/session/token", None::<&()>).await?;
        
        // Clear access token
        let mut token = self.access_token.write().await;
        *token = None;
        
        Ok(())
    }
    
    async fn get_profile(&self) -> Result<KiteProfile> {
        self.make_request("GET", "/user/profile", None::<&()>).await
    }
    
    async fn get_margins(&self) -> Result<KiteMarginResponse> {
        self.make_request("GET", "/user/margins", None::<&()>).await
    }
    
    async fn get_orders(&self) -> Result<Vec<KiteOrder>> {
        self.make_request("GET", "/orders", None::<&()>).await
    }
    
    async fn get_order_history(&self, order_id: &str) -> Result<Vec<KiteOrder>> {
        let endpoint = format!("/orders/{}", order_id);
        self.make_request("GET", &endpoint, None::<&()>).await
    }
    
    async fn get_trades(&self) -> Result<Vec<KiteOrder>> {
        self.make_request("GET", "/trades", None::<&()>).await
    }
    
    async fn get_positions(&self) -> Result<KitePosition> {
        self.make_request("GET", "/portfolio/positions", None::<&()>).await
    }
    
    async fn get_holdings(&self) -> Result<Vec<KiteHolding>> {
        self.make_request("GET", "/portfolio/holdings", None::<&()>).await
    }
    
    async fn get_instruments(&self, exchange: Option<KiteExchange>) -> Result<Vec<KiteInstrument>> {
        let endpoint = match exchange {
            Some(ex) => format!("/instruments/{}", ex),
            None => "/instruments".to_string(),
        };
        
        self.make_request("GET", &endpoint, None::<&()>).await
    }
    
    async fn get_quote(&self, instruments: &[String]) -> Result<HashMap<String, KiteQuote>> {
        if instruments.is_empty() {
            return Err(HedgeXError::ValidationError("No instruments provided".to_string()));
        }
        
        let instruments_str = instruments.join(",");
        let endpoint = format!("/quote?i={}", instruments_str);
        
        self.make_request("GET", &endpoint, None::<&()>).await
    }
    
    async fn get_historical_data(&self, params: KiteHistoricalDataParams) -> Result<Vec<KiteOHLCV>> {
        let endpoint = format!(
            "/instruments/historical/{}/{}/{}?from={}&to={}&interval={}",
            params.exchange, params.symbol, params.instrument_token,
            params.from_date, params.to_date, params.interval
        );
        
        self.make_request("GET", &endpoint, None::<&()>).await
    }
    
    async fn place_order(&self, order: KiteOrderRequest) -> Result<KiteOrderResponse> {
        self.make_request("POST", "/orders", Some(&order)).await
    }
    
    async fn modify_order(&self, order_id: &str, order: KiteOrderRequest) -> Result<KiteOrderResponse> {
        let endpoint = format!("/orders/{}", order_id);
        self.make_request("PUT", &endpoint, Some(&order)).await
    }
    
    async fn cancel_order(&self, order_id: &str, variety: KiteOrderVariety) -> Result<KiteOrderResponse> {
        let endpoint = format!("/orders/{}/{}", variety, order_id);
        self.make_request("DELETE", &endpoint, None::<&()>).await
    }
}

/// Kite API response structure
#[derive(Debug, Deserialize)]
struct KiteApiResponse<T> {
    status: String,
    data: T,
    #[serde(rename = "error_type")]
    error_type: Option<String>,
    #[serde(rename = "error_message")]
    error_message: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockito::{mock, server_url};
    use serde_json::json;
    
    #[tokio::test]
    async fn test_set_get_access_token() {
        let client = KiteClient::new("test_api_key").unwrap();
        let test_token = "test_access_token".to_string();
        
        // Initially token should be None
        assert_eq!(client.get_access_token().await, None);
        
        // Set token
        client.set_access_token(test_token.clone()).await;
        
        // Get token should return the set token
        assert_eq!(client.get_access_token().await, Some(test_token));
    }
    
    #[tokio::test]
    async fn test_generate_session_url() {
        let client = KiteClient::new("test_api_key").unwrap();
        let url = client.generate_session_url("test_api_key");
        
        assert_eq!(url, format!("{}/login?api_key=test_api_key", KITE_CONNECT_URL));
    }
    
    #[tokio::test]
    async fn test_generate_checksum() {
        let client = KiteClient::new("test_api_key").unwrap();
        let checksum = client.generate_checksum("api_key", "request_token", "api_secret").unwrap();
        
        // The checksum should be a non-empty string
        assert!(!checksum.is_empty());
    }
    
    #[tokio::test]
    async fn test_calculate_backoff_ms() {
        let client = KiteClient::new("test_api_key").unwrap();
        
        // Test backoff for different attempts
        let backoff1 = client.calculate_backoff_ms(1);
        let backoff2 = client.calculate_backoff_ms(2);
        
        // Backoff should increase with attempt number
        assert!(backoff2 > backoff1);
        
        // Backoff should be within reasonable range
        assert!(backoff1 >= 100);
        assert!(backoff2 >= 200);
    }
    
    #[tokio::test]
    async fn test_should_retry() {
        // Should retry on these status codes
        assert!(KiteClient::should_retry(StatusCode::REQUEST_TIMEOUT));
        assert!(KiteClient::should_retry(StatusCode::TOO_MANY_REQUESTS));
        assert!(KiteClient::should_retry(StatusCode::INTERNAL_SERVER_ERROR));
        assert!(KiteClient::should_retry(StatusCode::BAD_GATEWAY));
        assert!(KiteClient::should_retry(StatusCode::SERVICE_UNAVAILABLE));
        assert!(KiteClient::should_retry(StatusCode::GATEWAY_TIMEOUT));
        
        // Should not retry on these status codes
        assert!(!KiteClient::should_retry(StatusCode::BAD_REQUEST));
        assert!(!KiteClient::should_retry(StatusCode::UNAUTHORIZED));
        assert!(!KiteClient::should_retry(StatusCode::FORBIDDEN));
        assert!(!KiteClient::should_retry(StatusCode::NOT_FOUND));
    }
    
    #[tokio::test]
    async fn test_map_api_error() {
        let client = KiteClient::new("test_api_key").unwrap();
        
        // Test different error types
        let response = KiteApiResponse::<()> {
            status: "error".to_string(),
            data: (),
            error_type: Some("TokenException".to_string()),
            error_message: Some("Invalid token".to_string()),
        };
        
        let error = client.map_api_error(&response);
        match error {
            HedgeXError::AuthenticationError(msg) => assert_eq!(msg, "Invalid token"),
            _ => panic!("Expected AuthenticationError"),
        }
        
        // Test rate limit error
        let response = KiteApiResponse::<()> {
            status: "error".to_string(),
            data: (),
            error_type: Some("TooManyRequestsException".to_string()),
            error_message: Some("Rate limit exceeded".to_string()),
        };
        
        let error = client.map_api_error(&response);
        match error {
            HedgeXError::RateLimitError(msg) => assert_eq!(msg, "Rate limit exceeded"),
            _ => panic!("Expected RateLimitError"),
        }
    }
    
    #[tokio::test]
    async fn test_generate_session() {
        let mut server = mockito::Server::new();
        let mock_url = server.url();
        
        // Create client with mock server URL
        let client = KiteClient::new_with_config("test_api_key", &mock_url, 0).unwrap();
        
        // Setup mock response
        let _m = server.mock("POST", "/session/token")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"status":"success","data":{"access_token":"test_access_token"}}"#)
            .create();
        
        // Call generate_session
        let result = client.generate_session("test_request_token", "test_api_secret").await;
        
        // Verify result
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "test_access_token");
        
        // Verify access token was set
        assert_eq!(client.get_access_token().await, Some("test_access_token".to_string()));
    }
    
    #[tokio::test]
    async fn test_invalidate_session() {
        let mut server = mockito::Server::new();
        let mock_url = server.url();
        
        // Create client with mock server URL
        let client = KiteClient::new_with_config("test_api_key", &mock_url, 0).unwrap();
        
        // Set access token
        client.set_access_token("test_access_token".to_string()).await;
        
        // Setup mock response
        let _m = server.mock("DELETE", "/session/token")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"status":"success","data":{}}"#)
            .create();
        
        // Call invalidate_session
        let result = client.invalidate_session().await;
        
        // Verify result
        assert!(result.is_ok());
        
        // Verify access token was cleared
        assert_eq!(client.get_access_token().await, None);
    }
    
    #[tokio::test]
    async fn test_get_profile() {
        let mut server = mockito::Server::new();
        let mock_url = server.url();
        
        // Create client with mock server URL
        let client = KiteClient::new_with_config("test_api_key", &mock_url, 0).unwrap();
        
        // Set access token
        client.set_access_token("test_access_token".to_string()).await;
        
        // Setup mock response
        let _m = server.mock("GET", "/user/profile")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"status":"success","data":{"user_id":"AB1234","user_name":"Test User","email":"test@example.com","user_type":"individual","broker":"ZERODHA"}}"#)
            .create();
        
        // Call get_profile
        let result = client.get_profile().await;
        
        // Verify result
        assert!(result.is_ok());
        let profile = result.unwrap();
        assert_eq!(profile.user_id, "AB1234");
        assert_eq!(profile.user_name, "Test User");
        assert_eq!(profile.email, "test@example.com");
    }
    
    #[tokio::test]
    async fn test_get_orders() {
        let mut server = mockito::Server::new();
        let mock_url = server.url();
        
        // Create client with mock server URL
        let client = KiteClient::new_with_config("test_api_key", &mock_url, 0).unwrap();
        
        // Set access token
        client.set_access_token("test_access_token".to_string()).await;
        
        // Setup mock response
        let _m = server.mock("GET", "/orders")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"status":"success","data":[{"order_id":"123456","status":"COMPLETE","tradingsymbol":"INFY","exchange":"NSE","transaction_type":"BUY","quantity":10,"price":1500.0}]}"#)
            .create();
        
        // Call get_orders
        let result = client.get_orders().await;
        
        // Verify result
        assert!(result.is_ok());
        let orders = result.unwrap();
        assert_eq!(orders.len(), 1);
        assert_eq!(orders[0].order_id, "123456");
        assert_eq!(orders[0].status, KiteOrderStatus::Complete);
        assert_eq!(orders[0].tradingsymbol, "INFY");
    }
    
    #[tokio::test]
    async fn test_place_order() {
        let mut server = mockito::Server::new();
        let mock_url = server.url();
        
        // Create client with mock server URL
        let client = KiteClient::new_with_config("test_api_key", &mock_url, 0).unwrap();
        
        // Set access token
        client.set_access_token("test_access_token".to_string()).await;
        
        // Setup mock response
        let _m = server.mock("POST", "/orders")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(r#"{"status":"success","data":{"order_id":"123456"}}"#)
            .create();
        
        // Create order request
        let order = KiteOrderRequest {
            tradingsymbol: "INFY".to_string(),
            exchange: KiteExchange::NSE,
            transaction_type: KiteTransactionType::Buy,
            order_type: KiteOrderType::Limit,
            quantity: 10,
            price: Some(1500.0),
            product: KiteProduct::CNC,
            validity: KiteValidity::Day,
            disclosed_quantity: Some(KiteDiscloseQuantity::new(0)),
            trigger_price: None,
            squareoff: None,
            stoploss: None,
            trailing_stoploss: None,
            variety: KiteOrderVariety::Regular,
        };
        
        // Call place_order
        let result = client.place_order(order).await;
        
        // Verify result
        assert!(result.is_ok());
        let response = result.unwrap();
        assert_eq!(response.order_id, "123456");
    }
    
    #[tokio::test]
    async fn test_error_handling() {
        let mut server = mockito::Server::new();
        let mock_url = server.url();
        
        // Create client with mock server URL
        let client = KiteClient::new_with_config("test_api_key", &mock_url, 0).unwrap();
        
        // Set access token
        client.set_access_token("test_access_token".to_string()).await;
        
        // Setup mock response for authentication error
        let _m = server.mock("GET", "/user/profile")
            .with_status(403)
            .with_header("content-type", "application/json")
            .with_body(r#"{"status":"error","error_type":"TokenException","error_message":"Invalid API key or access token"}"#)
            .create();
        
        // Call get_profile
        let result = client.get_profile().await;
        
        // Verify error
        assert!(result.is_err());
        match result.unwrap_err() {
            HedgeXError::AuthenticationError(msg) => {
                assert_eq!(msg, "Invalid API key or access token");
            }
            err => panic!("Expected AuthenticationError, got {:?}", err),
        }
    }
    
    #[tokio::test]
    async fn test_rate_limit_error() {
        let mut server = mockito::Server::new();
        let mock_url = server.url();
        
        // Create client with mock server URL
        let client = KiteClient::new_with_config("test_api_key", &mock_url, 0).unwrap();
        
        // Set access token
        client.set_access_token("test_access_token".to_string()).await;
        
        // Setup mock response for rate limit error
        let _m = server.mock("GET", "/user/profile")
            .with_status(429)
            .with_header("content-type", "application/json")
            .with_body(r#"{"status":"error","error_type":"TooManyRequestsException","error_message":"Rate limit exceeded"}"#)
            .create();
        
        // Call get_profile
        let result = client.get_profile().await;
        
        // Verify error
        assert!(result.is_err());
        match result.unwrap_err() {
            HedgeXError::RateLimitError(msg) => {
                assert_eq!(msg, "Rate limit exceeded");
            }
            err => panic!("Expected RateLimitError, got {:?}", err),
        }
    }
}