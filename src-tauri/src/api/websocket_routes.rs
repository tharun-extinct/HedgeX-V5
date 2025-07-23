use crate::error::{ApiResult, HedgeXError, Result};
use crate::services::{WebSocketManager, MarketData, SubscriptionMode, ConnectionStatus};
use axum::{
    extract::{State, Path},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{debug, info};

/// WebSocket status response
#[derive(Debug, Serialize, Deserialize)]
pub struct WebSocketStatusResponse {
    pub status: String,
    pub subscribed_instruments: Vec<u64>,
}

/// Instrument subscription request
#[derive(Debug, Serialize, Deserialize)]
pub struct SubscriptionRequest {
    pub instrument_tokens: Vec<u64>,
    pub mode: String,
}

/// Market data response
#[derive(Debug, Serialize, Deserialize)]
pub struct MarketDataResponse {
    pub data: Vec<MarketData>,
}

/// Create WebSocket routes
pub fn websocket_routes() -> Router<Arc<WebSocketManager>> {
    Router::new()
        .route("/status", get(get_websocket_status))
        .route("/connect", post(connect_websocket))
        .route("/disconnect", post(disconnect_websocket))
        .route("/subscribe", post(subscribe_instruments))
        .route("/unsubscribe", post(unsubscribe_instruments))
        .route("/market-data", get(get_market_data))
        .route("/market-data/:instrument_token", get(get_instrument_market_data))
}

/// Get WebSocket connection status
async fn get_websocket_status(
    State(ws_manager): State<Arc<WebSocketManager>>,
) -> Json<ApiResult<WebSocketStatusResponse>> {
    debug!("Getting WebSocket status");
    
    let status = ws_manager.get_status().await;
    let status_str = match status {
        ConnectionStatus::Connected => "connected",
        ConnectionStatus::Connecting => "connecting",
        ConnectionStatus::Disconnected => "disconnected",
        ConnectionStatus::Reconnecting => "reconnecting",
        ConnectionStatus::Failed => "failed",
    };
    
    // Get subscribed instruments
    let subscriptions = ws_manager.get_subscriptions().await;
    let subscribed_instruments: Vec<u64> = subscriptions.keys().cloned().collect();
    
    let response = WebSocketStatusResponse {
        status: status_str.to_string(),
        subscribed_instruments,
    };
    
    Json(ApiResult::success(response))
}

/// Connect to WebSocket
async fn connect_websocket(
    State(ws_manager): State<Arc<WebSocketManager>>,
) -> Json<ApiResult<()>> {
    info!("Connecting to WebSocket");
    
    match ws_manager.connect().await {
        Ok(_) => Json(ApiResult::success(())),
        Err(e) => Json(ApiResult::from_error(e)),
    }
}

/// Disconnect from WebSocket
async fn disconnect_websocket(
    State(ws_manager): State<Arc<WebSocketManager>>,
) -> Json<ApiResult<()>> {
    info!("Disconnecting from WebSocket");
    
    match ws_manager.disconnect().await {
        Ok(_) => Json(ApiResult::success(())),
        Err(e) => Json(ApiResult::from_error(e)),
    }
}

/// Subscribe to instruments
async fn subscribe_instruments(
    State(ws_manager): State<Arc<WebSocketManager>>,
    Json(request): Json<SubscriptionRequest>,
) -> Json<ApiResult<()>> {
    info!("Subscribing to {} instruments", request.instrument_tokens.len());
    
    // Convert mode string to enum
    let mode = match request.mode.to_lowercase().as_str() {
        "ltp" => SubscriptionMode::LTP,
        "quote" => SubscriptionMode::Quote,
        "full" => SubscriptionMode::Full,
        _ => {
            return Json(ApiResult::from_error(HedgeXError::ValidationError(
                "Invalid subscription mode. Must be one of: ltp, quote, full".to_string(),
            )));
        }
    };
    
    match ws_manager.subscribe_to_instruments(request.instrument_tokens, mode).await {
        Ok(_) => Json(ApiResult::success(())),
        Err(e) => Json(ApiResult::from_error(e)),
    }
}

/// Unsubscribe from instruments
async fn unsubscribe_instruments(
    State(ws_manager): State<Arc<WebSocketManager>>,
    Json(request): Json<SubscriptionRequest>,
) -> Json<ApiResult<()>> {
    info!("Unsubscribing from {} instruments", request.instrument_tokens.len());
    
    match ws_manager.unsubscribe_from_instruments(request.instrument_tokens).await {
        Ok(_) => Json(ApiResult::success(())),
        Err(e) => Json(ApiResult::from_error(e)),
    }
}

/// Get all cached market data
async fn get_market_data(
    State(ws_manager): State<Arc<WebSocketManager>>,
) -> Json<ApiResult<MarketDataResponse>> {
    debug!("Getting all market data");
    
    let market_data = ws_manager.get_all_cached_market_data().await;
    let data: Vec<MarketData> = market_data.values().cloned().collect();
    
    Json(ApiResult::success(MarketDataResponse { data }))
}

/// Get market data for a specific instrument
async fn get_instrument_market_data(
    State(ws_manager): State<Arc<WebSocketManager>>,
    Path(instrument_token): Path<u64>,
) -> Json<ApiResult<Option<MarketData>>> {
    debug!("Getting market data for instrument {}", instrument_token);
    
    let market_data = ws_manager.get_cached_market_data(instrument_token).await;
    Json(ApiResult::success(market_data))
}