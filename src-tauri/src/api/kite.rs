use crate::models::ApiCredentials;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use reqwest::Client;
use url::Url;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use std::sync::Arc;

// Base URLs for Zerodha Kite API
const KITE_API_URL: &str = "https://api.kite.trade";
const KITE_LOGIN_URL: &str = "https://kite.zerodha.com/connect/login";

/// Client for interacting with Zerodha Kite API
#[derive(Clone)]
pub struct KiteClient {
    client: Client,
    credentials: Arc<Mutex<Option<ApiCredentials>>>,
    rate_limiter: Arc<Mutex<RateLimiter>>,
}

/// Simple rate limiter to prevent API throttling
struct RateLimiter {
    last_request: Instant,
    min_interval: Duration,
}

impl RateLimiter {
    fn new(min_interval_ms: u64) -> Self {
        Self {
            last_request: Instant::now() - Duration::from_secs(10),
            min_interval: Duration::from_millis(min_interval_ms),
        }
    }

    async fn wait(&mut self) {
        let elapsed = self.last_request.elapsed();
        if elapsed < self.min_interval {
            let wait_time = self.min_interval - elapsed;
            tokio::time::sleep(wait_time).await;
        }
        self.last_request = Instant::now();
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct LoginResponse {
    status: String,
    data: LoginData,
}

#[derive(Debug, Serialize, Deserialize)]
struct LoginData {
    request_token: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct TokenResponse {
    status: String,
    data: TokenData,
}

#[derive(Debug, Serialize, Deserialize)]
struct TokenData {
    access_token: String,
}

impl KiteClient {
    /// Create a new Kite API client
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap();

        Self {
            client,
            credentials: Arc::new(Mutex::new(None)),
            rate_limiter: Arc::new(Mutex::new(RateLimiter::new(200))), // 200ms between requests
        }
    }

    /// Set API credentials
    pub async fn set_credentials(&self, credentials: ApiCredentials) {
        let mut creds = self.credentials.lock().await;
        *creds = Some(credentials);
    }

    /// Get the login URL for user authentication
    pub fn get_login_url(&self, api_key: &str) -> String {
        format!("{}?api_key={}&v=3", KITE_LOGIN_URL, api_key)
    }

    /// Generate session using request token obtained after login
    pub async fn generate_session(&self, request_token: &str) -> Result<String> {
        let mut rate_limiter = self.rate_limiter.lock().await;
        rate_limiter.wait().await;
        
        let creds = self.credentials.lock().await;
        let credentials = creds.as_ref().ok_or_else(|| anyhow!("No credentials set"))?;
        
        let url = format!("{}/session/token", KITE_API_URL);
        let params = [
            ("api_key", credentials.api_key.as_str()),
            ("request_token", request_token),
        ];

        let response = self.client
            .post(&url)
            .form(&params)
            .send()
            .await?
            .json::<TokenResponse>()
            .await?;

        if response.status != "success" {
            return Err(anyhow!("Failed to generate session"));
        }

        Ok(response.data.access_token)
    }

    /// Get user profile
    pub async fn get_profile(&self) -> Result<serde_json::Value> {
        let mut rate_limiter = self.rate_limiter.lock().await;
        rate_limiter.wait().await;
        
        let creds = self.credentials.lock().await;
        let credentials = creds.as_ref().ok_or_else(|| anyhow!("No credentials set"))?;
        
        let access_token = credentials.access_token.as_ref().ok_or_else(|| anyhow!("No access token"))?;
        
        let url = format!("{}/user/profile", KITE_API_URL);
        
        let response = self.client
            .get(&url)
            .header("X-Kite-Version", "3")
            .header("Authorization", format!("token {}:{}", credentials.api_key, access_token))
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;
            
        Ok(response)
    }

    /// Get market quotes for a list of instruments
    pub async fn get_quotes(&self, symbols: &[String]) -> Result<serde_json::Value> {
        let mut rate_limiter = self.rate_limiter.lock().await;
        rate_limiter.wait().await;
        
        let creds = self.credentials.lock().await;
        let credentials = creds.as_ref().ok_or_else(|| anyhow!("No credentials set"))?;
        
        let access_token = credentials.access_token.as_ref().ok_or_else(|| anyhow!("No access token"))?;
        
        let symbols_str = symbols.join(",");
        let url = Url::parse_with_params(
            &format!("{}/quote", KITE_API_URL),
            &[("i", symbols_str.as_str())]
        )?;
        
        let response = self.client
            .get(url)
            .header("X-Kite-Version", "3")
            .header("Authorization", format!("token {}:{}", credentials.api_key, access_token))
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;
            
        Ok(response)
    }

    /// Place an order
    pub async fn place_order(
        &self,
        exchange: &str,
        symbol: &str,
        transaction_type: &str, // "BUY" or "SELL"
        quantity: u32,
        price: Option<f64>,
        order_type: &str, // "MARKET", "LIMIT", etc.
    ) -> Result<String> {
        let mut rate_limiter = self.rate_limiter.lock().await;
        rate_limiter.wait().await;
        
        let creds = self.credentials.lock().await;
        let credentials = creds.as_ref().ok_or_else(|| anyhow!("No credentials set"))?;
        
        let access_token = credentials.access_token.as_ref().ok_or_else(|| anyhow!("No access token"))?;
        
        let url = format!("{}/orders/regular", KITE_API_URL);
        
        let mut form = vec![
            ("exchange", exchange.to_string()),
            ("tradingsymbol", symbol.to_string()),
            ("transaction_type", transaction_type.to_string()),
            ("quantity", quantity.to_string()),
            ("product", "CNC".to_string()), // CNC for delivery, MIS for intraday
            ("order_type", order_type.to_string()),
        ];
        
        if let Some(p) = price {
            form.push(("price", p.to_string()));
        }
        
        let response = self.client
            .post(&url)
            .header("X-Kite-Version", "3")
            .header("Authorization", format!("token {}:{}", credentials.api_key, access_token))
            .form(&form)
            .send()
            .await?
            .json::<serde_json::Value>()
            .await?;
            
        let order_id = response["data"]["order_id"].as_str()
            .ok_or_else(|| anyhow!("Failed to get order ID from response"))?;
            
        Ok(order_id.to_string())
    }
}
