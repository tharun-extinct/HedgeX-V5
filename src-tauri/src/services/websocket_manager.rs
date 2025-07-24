use crate::error::{HedgeXError, Result};
use crate::models::kite::*;
use crate::services::EnhancedDatabaseService;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{broadcast, RwLock, Mutex};
use tokio::time::{sleep, timeout};
use tracing::{debug, error, info, warn};
use websocket::{ClientBuilder, OwnedMessage, WebSocketError};
use url::Url;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;

/// Market data structure for real-time updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketData {
    pub symbol: String,
    pub instrument_token: u64,
    pub ltp: Decimal,
    pub volume: u64,
    pub bid: Decimal,
    pub ask: Decimal,
    pub ohlc: Option<OHLC>,
    pub timestamp: DateTime<Utc>,
    pub change: Option<Decimal>,
    pub change_percent: Option<Decimal>,
}

/// OHLC data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OHLC {
    pub open: Decimal,
    pub high: Decimal,
    pub low: Decimal,
    pub close: Decimal,
}

/// WebSocket connection status
#[derive(Debug, Clone, PartialEq)]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Failed,
}

/// WebSocket subscription mode
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SubscriptionMode {
    /// LTP (Last Traded Price) only
    LTP,
    /// Quote (LTP + market depth)
    Quote,
    /// Full (Quote + OHLC + other data)
    Full,
}

/// WebSocket manager for handling real-time market data
pub struct WebSocketManager {
    /// Database service for caching market data
    db_service: Arc<EnhancedDatabaseService>,
    
    /// Current connection status
    status: Arc<RwLock<ConnectionStatus>>,
    
    /// WebSocket connection URL
    ws_url: String,
    
    /// API credentials for authentication
    api_credentials: Arc<RwLock<Option<KiteApiCredentials>>>,
    
    /// Subscribed instrument tokens
    subscriptions: Arc<RwLock<HashMap<u64, SubscriptionMode>>>,
    
    /// Market data cache
    market_data_cache: Arc<RwLock<HashMap<u64, MarketData>>>,
    
    /// Broadcast channel for market data updates
    market_data_tx: broadcast::Sender<MarketData>,
    
    /// Connection retry configuration
    retry_config: RetryConfig,
    
    /// Last connection attempt time
    last_connection_attempt: Arc<Mutex<Option<Instant>>>,
    
    /// Connection handle for cleanup
    connection_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

/// Retry configuration for connection recovery
#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub max_retries: u32,
    pub initial_delay: Duration,
    pub max_delay: Duration,
    pub backoff_multiplier: f64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 10,
            initial_delay: Duration::from_secs(1),
            max_delay: Duration::from_secs(60),
            backoff_multiplier: 2.0,
        }
    }
}

impl WebSocketManager {
    /// Create a new WebSocket manager
    pub fn new(db_service: Arc<EnhancedDatabaseService>) -> Self {
        let (market_data_tx, _) = broadcast::channel(1000);
        
        Self {
            db_service,
            status: Arc::new(RwLock::new(ConnectionStatus::Disconnected)),
            ws_url: "wss://ws.kite.trade".to_string(),
            api_credentials: Arc::new(RwLock::new(None)),
            subscriptions: Arc::new(RwLock::new(HashMap::new())),
            market_data_cache: Arc::new(RwLock::new(HashMap::new())),
            market_data_tx,
            retry_config: RetryConfig::default(),
            last_connection_attempt: Arc::new(Mutex::new(None)),
            connection_handle: Arc::new(Mutex::new(None)),
        }
    }
    
    /// Get the database service
    pub fn get_db_service(&self) -> Arc<EnhancedDatabaseService> {
        Arc::clone(&self.db_service)
    }
    
    /// Get the market data sender for testing
    pub fn get_market_data_sender(&self) -> broadcast::Sender<MarketData> {
        self.market_data_tx.clone()
    }
    
    /// Set API credentials for WebSocket authentication
    pub async fn set_credentials(&self, credentials: KiteApiCredentials) -> Result<()> {
        let mut creds = self.api_credentials.write().await;
        *creds = Some(credentials);
        info!("WebSocket credentials updated");
        Ok(())
    }
    
    /// Connect to Kite WebSocket API
    pub async fn connect(&self) -> Result<()> {
        let mut status = self.status.write().await;
        if *status == ConnectionStatus::Connected || *status == ConnectionStatus::Connecting {
            return Ok(());
        }
        
        *status = ConnectionStatus::Connecting;
        drop(status);
        
        // Update last connection attempt
        {
            let mut last_attempt = self.last_connection_attempt.lock().await;
            *last_attempt = Some(Instant::now());
        }
        
        info!("Attempting to connect to Kite WebSocket");
        
        // Get credentials
        let credentials = {
            let creds = self.api_credentials.read().await;
            creds.clone().ok_or_else(|| {
                HedgeXError::WebSocketError("No API credentials set".to_string())
            })?
        };
        
        let access_token = credentials.access_token.ok_or_else(|| {
            HedgeXError::WebSocketError("No access token available".to_string())
        })?;
        
        // Build WebSocket URL with authentication
        let ws_url = format!(
            "{}?api_key={}&access_token={}",
            self.ws_url, credentials.api_key, access_token
        );
        
        // Start connection in background task
        let connection_result = self.start_connection_task(ws_url).await;
        
        match connection_result {
            Ok(_) => {
                let mut status = self.status.write().await;
                *status = ConnectionStatus::Connected;
                info!("Successfully connected to Kite WebSocket");
                Ok(())
            }
            Err(e) => {
                let mut status = self.status.write().await;
                *status = ConnectionStatus::Failed;
                error!("Failed to connect to Kite WebSocket: {}", e);
                Err(e)
            }
        }
    }
    
    /// Start the WebSocket connection task
    async fn start_connection_task(&self, ws_url: String) -> Result<()> {
        let url = Url::parse(&ws_url)
            .map_err(|e| HedgeXError::WebSocketError(format!("Invalid WebSocket URL: {}", e)))?;
        
        // Create WebSocket client
        let client = ClientBuilder::new(&ws_url)
            .map_err(|e| HedgeXError::WebSocketError(format!("Failed to create WebSocket client: {}", e)))?
            .connect_insecure()
            .map_err(|e| HedgeXError::WebSocketError(format!("Failed to connect to WebSocket: {}", e)))?;
        
        let (mut receiver, mut sender) = client.split()
            .map_err(|e| HedgeXError::WebSocketError(format!("Failed to split WebSocket connection: {}", e)))?;
        
        // Clone necessary data for the connection task
        let status = Arc::clone(&self.status);
        let subscriptions = Arc::clone(&self.subscriptions);
        let market_data_cache = Arc::clone(&self.market_data_cache);
        let market_data_tx = self.market_data_tx.clone();
        let db_service = Arc::clone(&self.db_service);
        let retry_config = self.retry_config.clone();
        let last_connection_attempt = Arc::clone(&self.last_connection_attempt);
        
        // Start the connection handling task
        let handle = tokio::spawn(async move {
            info!("WebSocket connection task started");
            
            // Send initial subscription messages for existing subscriptions
            let subs = subscriptions.read().await;
            if !subs.is_empty() {
                let tokens: Vec<u64> = subs.keys().cloned().collect();
                drop(subs);
                
                if let Err(e) = Self::send_subscribe_message(&mut sender, &tokens).await {
                    error!("Failed to send initial subscription: {}", e);
                }
            } else {
                drop(subs);
            }
            
            // Main message processing loop
            loop {
                match receiver.recv_message() {
                    Ok(message) => {
                        match message {
                            OwnedMessage::Binary(data) => {
                                // Process binary market data message
                                if let Err(e) = Self::process_binary_message(
                                    &data,
                                    &market_data_cache,
                                    &market_data_tx,
                                    &db_service,
                                ).await {
                                    warn!("Failed to process binary message: {}", e);
                                }
                            }
                            OwnedMessage::Text(text) => {
                                debug!("Received text message: {}", text);
                                // Handle text messages (usually control messages)
                                if let Err(e) = Self::process_text_message(&text).await {
                                    warn!("Failed to process text message: {}", e);
                                }
                            }
                            OwnedMessage::Close(_) => {
                                warn!("WebSocket connection closed by server");
                                break;
                            }
                            OwnedMessage::Ping(data) => {
                                // Respond to ping with pong
                                if let Err(e) = sender.send_message(&OwnedMessage::Pong(data)) {
                                    error!("Failed to send pong: {}", e);
                                    break;
                                }
                            }
                            _ => {
                                // Ignore other message types
                            }
                        }
                    }
                    Err(WebSocketError::IoError(ref e)) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        // Non-blocking operation would block, continue
                        tokio::task::yield_now().await;
                        continue;
                    }
                    Err(e) => {
                        error!("WebSocket receive error: {}", e);
                        break;
                    }
                }
            }
            
            // Connection lost, update status
            {
                let mut status_guard = status.write().await;
                *status_guard = ConnectionStatus::Disconnected;
            }
            
            info!("WebSocket connection task ended");
        });
        
        // Store the connection handle
        {
            let mut connection_handle = self.connection_handle.lock().await;
            *connection_handle = Some(handle);
        }
        
        Ok(())
    }
    
    /// Send subscribe message to WebSocket
    async fn send_subscribe_message(
        sender: &mut websocket::sender::Writer<std::net::TcpStream>,
        tokens: &[u64],
    ) -> Result<()> {
        let subscribe_msg = serde_json::json!({
            "a": "subscribe",
            "v": tokens
        });
        
        let message = OwnedMessage::Text(subscribe_msg.to_string());
        sender.send_message(&message)
            .map_err(|e| HedgeXError::WebSocketError(format!("Failed to send subscribe message: {}", e)))?;
        
        debug!("Sent subscription for {} instruments", tokens.len());
        Ok(())
    }
    
    /// Process binary market data message
    async fn process_binary_message(
        data: &[u8],
        market_data_cache: &Arc<RwLock<HashMap<u64, MarketData>>>,
        market_data_tx: &broadcast::Sender<MarketData>,
        db_service: &Arc<EnhancedDatabaseService>,
    ) -> Result<()> {
        // Parse binary data according to Kite's protocol
        let market_data = Self::parse_kite_binary_data(data)?;
        
        // Update cache
        {
            let mut cache = market_data_cache.write().await;
            cache.insert(market_data.instrument_token, market_data.clone());
        }
        
        // Cache in database for persistence
        if let Err(e) = Self::cache_market_data_in_db(db_service, &market_data).await {
            warn!("Failed to cache market data in database: {}", e);
        }
        
        // Broadcast to subscribers
        if let Err(e) = market_data_tx.send(market_data) {
            warn!("Failed to broadcast market data: {}", e);
        }
        
        Ok(())
    }
    
    /// Process text message from WebSocket
    async fn process_text_message(text: &str) -> Result<()> {
        debug!("Processing text message: {}", text);
        
        // Parse JSON message
        let message: serde_json::Value = serde_json::from_str(text)
            .map_err(|e| HedgeXError::WebSocketError(format!("Failed to parse text message: {}", e)))?;
        
        // Handle different message types
        if let Some(msg_type) = message.get("type").and_then(|t| t.as_str()) {
            match msg_type {
                "connection" => {
                    info!("WebSocket connection established");
                }
                "error" => {
                    let error_msg = message.get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("Unknown error");
                    error!("WebSocket error: {}", error_msg);
                }
                _ => {
                    debug!("Unknown message type: {}", msg_type);
                }
            }
        }
        
        Ok(())
    }
    
    /// Parse Kite binary data format
    fn parse_kite_binary_data(data: &[u8]) -> Result<MarketData> {
        // Implementation based on Kite's binary protocol
        // Reference: https://kite.trade/docs/connect/v3/websocket/#binary-message-format
        
        if data.len() < 8 {
            return Err(HedgeXError::WebSocketError("Invalid binary data length".to_string()));
        }
        
        // Extract instrument token (first 4 bytes, big endian)
        let instrument_token = u32::from_be_bytes([data[0], data[1], data[2], data[3]]) as u64;
        
        // Determine packet length and mode
        let packet_length = data.len();
        
        // Get symbol from instrument token mapping
        // In a real implementation, we would look up the symbol from a mapping table
        let symbol = format!("SYMBOL_{}", instrument_token);
        
        // Initialize market data with default values
        let mut market_data = MarketData {
            symbol,
            instrument_token,
            ltp: Decimal::ZERO,
            volume: 0,
            bid: Decimal::ZERO,
            ask: Decimal::ZERO,
            ohlc: None,
            timestamp: Utc::now(),
            change: None,
            change_percent: None,
        };
        
        // Parse based on packet length
        if packet_length == 8 {
            // Mode: LTP
            let ltp_raw = f32::from_be_bytes([data[4], data[5], data[6], data[7]]);
            market_data.ltp = Decimal::try_from(ltp_raw as f64)
                .map_err(|e| HedgeXError::WebSocketError(format!("Failed to convert LTP: {}", e)))?;
        } else if packet_length >= 28 {
            // Mode: Quote or Full
            
            // Last traded price
            let ltp_raw = f32::from_be_bytes([data[4], data[5], data[6], data[7]]);
            market_data.ltp = Decimal::try_from(ltp_raw as f64)
                .map_err(|e| HedgeXError::WebSocketError(format!("Failed to convert LTP: {}", e)))?;
            
            // Last traded quantity
            let ltq = u32::from_be_bytes([data[8], data[9], data[10], data[11]]);
            
            // Average traded price
            let atp_raw = f32::from_be_bytes([data[12], data[13], data[14], data[15]]);
            
            // Volume
            let volume = u32::from_be_bytes([data[16], data[17], data[18], data[19]]) as u64;
            market_data.volume = volume;
            
            // Best bid price
            let bid_raw = f32::from_be_bytes([data[20], data[21], data[22], data[23]]);
            market_data.bid = Decimal::try_from(bid_raw as f64)
                .map_err(|e| HedgeXError::WebSocketError(format!("Failed to convert bid: {}", e)))?;
            
            // Best ask price
            let ask_raw = f32::from_be_bytes([data[24], data[25], data[26], data[27]]);
            market_data.ask = Decimal::try_from(ask_raw as f64)
                .map_err(|e| HedgeXError::WebSocketError(format!("Failed to convert ask: {}", e)))?;
            
            // If we have full quote data (44 bytes or more)
            if packet_length >= 44 {
                // Open price
                let open_raw = f32::from_be_bytes([data[28], data[29], data[30], data[31]]);
                let open = Decimal::try_from(open_raw as f64)
                    .map_err(|e| HedgeXError::WebSocketError(format!("Failed to convert open: {}", e)))?;
                
                // High price
                let high_raw = f32::from_be_bytes([data[32], data[33], data[34], data[35]]);
                let high = Decimal::try_from(high_raw as f64)
                    .map_err(|e| HedgeXError::WebSocketError(format!("Failed to convert high: {}", e)))?;
                
                // Low price
                let low_raw = f32::from_be_bytes([data[36], data[37], data[38], data[39]]);
                let low = Decimal::try_from(low_raw as f64)
                    .map_err(|e| HedgeXError::WebSocketError(format!("Failed to convert low: {}", e)))?;
                
                // Close price
                let close_raw = f32::from_be_bytes([data[40], data[41], data[42], data[43]]);
                let close = Decimal::try_from(close_raw as f64)
                    .map_err(|e| HedgeXError::WebSocketError(format!("Failed to convert close: {}", e)))?;
                
                // Set OHLC data
                market_data.ohlc = Some(OHLC {
                    open,
                    high,
                    low,
                    close,
                });
                
                // Calculate change and change percent
                if close > Decimal::ZERO {
                    let change = market_data.ltp - close;
                    let change_percent = (change * Decimal::new(100, 0)) / close;
                    
                    market_data.change = Some(change);
                    market_data.change_percent = Some(change_percent);
                }
            }
        }
        
        // Validate the market data
        market_data.validate()?;
        
        Ok(market_data)
    }
    
    /// Cache market data in database
    async fn cache_market_data_in_db(
        db_service: &Arc<EnhancedDatabaseService>,
        market_data: &MarketData,
    ) -> Result<()> {
        let pool = db_service.get_database().get_pool();
        
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO market_data_cache 
            (symbol, ltp, volume, bid, ask, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&market_data.symbol)
        .bind(&market_data.ltp.to_string())
        .bind(market_data.volume as i64)
        .bind(&market_data.bid.to_string())
        .bind(&market_data.ask.to_string())
        .bind(&market_data.timestamp)
        .execute(pool)
        .await
        .map_err(|e| HedgeXError::DatabaseError(e))?;
        
        Ok(())
    }
    
    /// Subscribe to market data for specific instruments
    pub async fn subscribe_to_instruments(
        &self,
        tokens: Vec<u64>,
        mode: SubscriptionMode,
    ) -> Result<()> {
        // Update subscriptions
        {
            let mut subs = self.subscriptions.write().await;
            for token in &tokens {
                subs.insert(*token, mode.clone());
            }
        }
        
        // If connected, send subscription message
        let status = self.status.read().await;
        if *status == ConnectionStatus::Connected {
            // This would need to be implemented with a proper message sender
            info!("Subscribed to {} instruments with mode {:?}", tokens.len(), mode);
        }
        
        Ok(())
    }
    
    /// Unsubscribe from market data for specific instruments
    pub async fn unsubscribe_from_instruments(&self, tokens: Vec<u64>) -> Result<()> {
        // Update subscriptions
        {
            let mut subs = self.subscriptions.write().await;
            for token in &tokens {
                subs.remove(token);
            }
        }
        
        // If connected, send unsubscription message
        let status = self.status.read().await;
        if *status == ConnectionStatus::Connected {
            info!("Unsubscribed from {} instruments", tokens.len());
        }
        
        Ok(())
    }
    
    /// Get current connection status
    pub async fn get_status(&self) -> ConnectionStatus {
        let status = self.status.read().await;
        status.clone()
    }
    
    /// Get market data receiver for real-time updates
    pub fn subscribe_to_market_data(&self) -> broadcast::Receiver<MarketData> {
        self.market_data_tx.subscribe()
    }
    
    /// Get cached market data for an instrument
    pub async fn get_cached_market_data(&self, instrument_token: u64) -> Option<MarketData> {
        let cache = self.market_data_cache.read().await;
        cache.get(&instrument_token).cloned()
    }
    
    /// Get all cached market data
    pub async fn get_all_cached_market_data(&self) -> HashMap<u64, MarketData> {
        let cache = self.market_data_cache.read().await;
        cache.clone()
    }
    
    /// Get all current subscriptions
    pub async fn get_subscriptions(&self) -> HashMap<u64, SubscriptionMode> {
        let subs = self.subscriptions.read().await;
        subs.clone()
    }
    
    /// Disconnect from WebSocket
    pub async fn disconnect(&self) -> Result<()> {
        // Cancel connection task
        {
            let mut handle = self.connection_handle.lock().await;
            if let Some(task_handle) = handle.take() {
                task_handle.abort();
            }
        }
        
        // Update status
        {
            let mut status = self.status.write().await;
            *status = ConnectionStatus::Disconnected;
        }
        
        info!("WebSocket disconnected");
        Ok(())
    }
    
    /// Reconnect with exponential backoff
    pub async fn reconnect_with_backoff(&self) -> Result<()> {
        let mut delay = self.retry_config.initial_delay;
        let mut attempts = 0;
        
        while attempts < self.retry_config.max_retries {
            attempts += 1;
            
            // Update status to reconnecting
            {
                let mut status = self.status.write().await;
                *status = ConnectionStatus::Reconnecting;
            }
            
            info!("Reconnection attempt {} of {}", attempts, self.retry_config.max_retries);
            
            match self.connect().await {
                Ok(_) => {
                    info!("Successfully reconnected to WebSocket");
                    return Ok(());
                }
                Err(e) => {
                    warn!("Reconnection attempt {} failed: {}", attempts, e);
                    
                    if attempts < self.retry_config.max_retries {
                        info!("Waiting {:?} before next reconnection attempt", delay);
                        sleep(delay).await;
                        
                        // Exponential backoff
                        delay = std::cmp::min(
                            Duration::from_secs_f64(delay.as_secs_f64() * self.retry_config.backoff_multiplier),
                            self.retry_config.max_delay,
                        );
                    }
                }
            }
        }
        
        // All reconnection attempts failed
        {
            let mut status = self.status.write().await;
            *status = ConnectionStatus::Failed;
        }
        
        Err(HedgeXError::WebSocketError(
            format!("Failed to reconnect after {} attempts", self.retry_config.max_retries)
        ))
    }
    
    /// Start automatic reconnection monitoring
    pub async fn start_reconnection_monitor(self: Arc<Self>) {
        let status = Arc::clone(&self.status);
        let ws_manager = Arc::clone(&self);
        
        tokio::spawn(async move {
            let mut check_interval = tokio::time::interval(Duration::from_secs(30));
            
            loop {
                check_interval.tick().await;
                
                let current_status = {
                    let status_guard = status.read().await;
                    status_guard.clone()
                };
                
                if current_status == ConnectionStatus::Disconnected || current_status == ConnectionStatus::Failed {
                    warn!("WebSocket connection lost, attempting to reconnect");
                    
                    if let Err(e) = ws_manager.reconnect_with_backoff().await {
                        error!("Automatic reconnection failed: {}", e);
                    }
                }
            }
        });
    }
}

/// Validation functions for market data
impl MarketData {
    /// Validate market data integrity
    pub fn validate(&self) -> Result<()> {
        if self.ltp <= Decimal::ZERO {
            return Err(HedgeXError::ValidationError("LTP must be positive".to_string()));
        }
        
        if self.bid < Decimal::ZERO || self.ask < Decimal::ZERO {
            return Err(HedgeXError::ValidationError("Bid/Ask prices cannot be negative".to_string()));
        }
        
        if self.bid > self.ask {
            return Err(HedgeXError::ValidationError("Bid price cannot be higher than ask price".to_string()));
        }
        
        Ok(())
    }
}