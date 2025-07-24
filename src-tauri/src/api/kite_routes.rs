use crate::error::{ApiResult, HedgeXError, Result};
use crate::services::kite_service::KiteService;
use crate::models::kite::{
    KiteOrderRequest, KiteOrderResponse, KitePosition, 
    KiteOrder, KiteHolding, KiteMarginResponse, KiteProfile, KiteQuote,
    KiteHistoricalDataParams, KiteOHLCV, KiteInstrument, KiteExchange,
    KiteOrderVariety,
};
use crate::api::middleware::extract_user_id;
use axum::{
    extract::{Path, State, Query},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, put, delete},
    Json, Router,
};
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, error, info, warn, instrument};

/// Kite API routes
pub fn kite_routes(kite_service: Arc<KiteService>) -> Router {
    Router::new()
        .route("/session/url", get(generate_session_url))
        .route("/session/token", post(generate_session))
        .route("/session/token", delete(invalidate_session))
        .route("/profile", get(get_profile))
        .route("/margins", get(get_margins))
        .route("/orders", get(get_orders))
        .route("/orders", post(place_order))
        .route("/orders/:order_id", get(get_order_history))
        .route("/orders/:order_id", put(modify_order))
        .route("/orders/:order_id/:variety", delete(cancel_order))
        .route("/trades", get(get_trades))
        .route("/positions", get(get_positions))
        .route("/holdings", get(get_holdings))
        .route("/instruments", get(get_instruments))
        .route("/instruments/:exchange", get(get_instruments_by_exchange))
        .route("/quote", get(get_quote))
        .route("/historical", post(get_historical_data))
        .with_state(kite_service)
}

/// Request for generating session URL
#[derive(Debug, Deserialize)]
struct SessionUrlRequest {
    api_key: String,
}

/// Response for session URL
#[derive(Debug, Serialize)]
struct SessionUrlResponse {
    url: String,
}

/// Request for generating session token
#[derive(Debug, Deserialize)]
struct SessionTokenRequest {
    request_token: String,
}

/// Response for session token
#[derive(Debug, Serialize)]
struct SessionTokenResponse {
    access_token: String,
}

/// Request for setting API credentials
#[derive(Debug, Deserialize)]
struct SetCredentialsRequest {
    api_key: String,
    api_secret: String,
}

/// Request for getting quotes
#[derive(Debug, Deserialize)]
struct QuoteRequest {
    instruments: String, // Comma-separated list of instruments
}

/// Generate session URL
#[instrument(skip(kite_service))]
async fn generate_session_url(
    State(kite_service): State<Arc<KiteService>>,
    Json(request): Json<SessionUrlRequest>,
) -> impl IntoResponse {
    debug!("Generating session URL");
    
    let url = kite_service.generate_session_url(&request.api_key);
    
    (
        StatusCode::OK,
        Json(ApiResult::success(SessionUrlResponse { url })),
    )
}

/// Generate session token
#[instrument(skip(kite_service))]
async fn generate_session(
    State(kite_service): State<Arc<KiteService>>,
    Json(request): Json<SessionTokenRequest>,
) -> impl IntoResponse {
    debug!("Generating session token");
    
    match kite_service.generate_session(&request.request_token).await {
        Ok(access_token) => {
            info!("Session token generated successfully");
            (
                StatusCode::OK,
                Json(ApiResult::success(SessionTokenResponse { access_token })),
            )
        }
        Err(err) => {
            error!("Failed to generate session token: {}", err);
            (
                StatusCode::UNAUTHORIZED,
                Json(ApiResult::<SessionTokenResponse>::from_error(err)),
            )
        }
    }
}

/// Invalidate session
#[instrument(skip(kite_service))]
async fn invalidate_session(
    State(kite_service): State<Arc<KiteService>>,
) -> impl IntoResponse {
    debug!("Invalidating session");
    
    match kite_service.invalidate_session().await {
        Ok(_) => {
            info!("Session invalidated successfully");
            (
                StatusCode::OK,
                Json(ApiResult::success(())),
            )
        }
        Err(err) => {
            error!("Failed to invalidate session: {}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResult::<()>::from_error(err)),
            )
        }
    }
}

/// Get user profile
#[instrument(skip(kite_service))]
async fn get_profile(
    State(kite_service): State<Arc<KiteService>>,
) -> impl IntoResponse {
    debug!("Getting user profile");
    
    match kite_service.get_profile().await {
        Ok(profile) => {
            debug!("Profile retrieved successfully");
            (
                StatusCode::OK,
                Json(ApiResult::success(profile)),
            )
        }
        Err(err) => {
            error!("Failed to get profile: {}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResult::<KiteProfile>::from_error(err)),
            )
        }
    }
}

/// Get account margins
#[instrument(skip(kite_service))]
async fn get_margins(
    State(kite_service): State<Arc<KiteService>>,
) -> impl IntoResponse {
    debug!("Getting account margins");
    
    match kite_service.get_margins().await {
        Ok(margins) => {
            debug!("Margins retrieved successfully");
            (
                StatusCode::OK,
                Json(ApiResult::success(margins)),
            )
        }
        Err(err) => {
            error!("Failed to get margins: {}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResult::<KiteMarginResponse>::from_error(err)),
            )
        }
    }
}

/// Get order book
#[instrument(skip(kite_service))]
async fn get_orders(
    State(kite_service): State<Arc<KiteService>>,
) -> impl IntoResponse {
    debug!("Getting order book");
    
    match kite_service.get_orders().await {
        Ok(orders) => {
            debug!("Orders retrieved successfully: {} orders", orders.len());
            (
                StatusCode::OK,
                Json(ApiResult::success(orders)),
            )
        }
        Err(err) => {
            error!("Failed to get orders: {}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResult::<Vec<KiteOrder>>::from_error(err)),
            )
        }
    }
}

/// Get order history
#[instrument(skip(kite_service))]
async fn get_order_history(
    State(kite_service): State<Arc<KiteService>>,
    Path(order_id): Path<String>,
) -> impl IntoResponse {
    debug!("Getting order history for order ID: {}", order_id);
    
    match kite_service.get_order_history(&order_id).await {
        Ok(orders) => {
            debug!("Order history retrieved successfully: {} orders", orders.len());
            (
                StatusCode::OK,
                Json(ApiResult::success(orders)),
            )
        }
        Err(err) => {
            error!("Failed to get order history: {}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResult::<Vec<KiteOrder>>::from_error(err)),
            )
        }
    }
}

/// Get trades
#[instrument(skip(kite_service))]
async fn get_trades(
    State(kite_service): State<Arc<KiteService>>,
) -> impl IntoResponse {
    debug!("Getting trades");
    
    match kite_service.get_trades().await {
        Ok(trades) => {
            debug!("Trades retrieved successfully: {} trades", trades.len());
            (
                StatusCode::OK,
                Json(ApiResult::success(trades)),
            )
        }
        Err(err) => {
            error!("Failed to get trades: {}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResult::<Vec<KiteOrder>>::from_error(err)),
            )
        }
    }
}

/// Get positions
#[instrument(skip(kite_service))]
async fn get_positions(
    State(kite_service): State<Arc<KiteService>>,
) -> impl IntoResponse {
    debug!("Getting positions");
    
    match kite_service.get_positions().await {
        Ok(positions) => {
            debug!("Positions retrieved successfully");
            (
                StatusCode::OK,
                Json(ApiResult::success(positions)),
            )
        }
        Err(err) => {
            error!("Failed to get positions: {}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResult::<KitePosition>::from_error(err)),
            )
        }
    }
}

/// Get holdings
#[instrument(skip(kite_service))]
async fn get_holdings(
    State(kite_service): State<Arc<KiteService>>,
) -> impl IntoResponse {
    debug!("Getting holdings");
    
    match kite_service.get_holdings().await {
        Ok(holdings) => {
            debug!("Holdings retrieved successfully: {} holdings", holdings.len());
            (
                StatusCode::OK,
                Json(ApiResult::success(holdings)),
            )
        }
        Err(err) => {
            error!("Failed to get holdings: {}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResult::<Vec<KiteHolding>>::from_error(err)),
            )
        }
    }
}

/// Get instruments
#[instrument(skip(kite_service))]
async fn get_instruments(
    State(kite_service): State<Arc<KiteService>>,
) -> impl IntoResponse {
    debug!("Getting all instruments");
    
    match kite_service.get_instruments(None).await {
        Ok(instruments) => {
            debug!("Instruments retrieved successfully: {} instruments", instruments.len());
            (
                StatusCode::OK,
                Json(ApiResult::success(instruments)),
            )
        }
        Err(err) => {
            error!("Failed to get instruments: {}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResult::<Vec<KiteInstrument>>::from_error(err)),
            )
        }
    }
}

/// Get instruments by exchange
#[instrument(skip(kite_service))]
async fn get_instruments_by_exchange(
    State(kite_service): State<Arc<KiteService>>,
    Path(exchange): Path<String>,
) -> impl IntoResponse {
    debug!("Getting instruments for exchange: {}", exchange);
    
    // Parse exchange
    let exchange = match exchange.parse::<KiteExchange>() {
        Ok(ex) => ex,
        Err(err) => {
            error!("Invalid exchange: {}", err);
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiResult::<Vec<KiteInstrument>>::error(
                    format!("Invalid exchange: {}", err),
                    Some("VALIDATION_ERROR".to_string()),
                )),
            );
        }
    };
    
    match kite_service.get_instruments(Some(exchange)).await {
        Ok(instruments) => {
            debug!("Instruments retrieved successfully: {} instruments", instruments.len());
            (
                StatusCode::OK,
                Json(ApiResult::success(instruments)),
            )
        }
        Err(err) => {
            error!("Failed to get instruments: {}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResult::<Vec<KiteInstrument>>::from_error(err)),
            )
        }
    }
}

/// Get quotes
#[instrument(skip(kite_service))]
async fn get_quote(
    State(kite_service): State<Arc<KiteService>>,
    Query(query): Query<QuoteRequest>,
) -> impl IntoResponse {
    let instruments: Vec<String> = query.instruments
        .split(',')
        .map(|s| s.trim().to_string())
        .collect();
        
    debug!("Getting quotes for {} instruments", instruments.len());
    
    if instruments.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiResult::<HashMap<String, KiteQuote>>::error(
                "No instruments provided".to_string(),
                Some("VALIDATION_ERROR".to_string()),
            )),
        );
    }
    
    match kite_service.get_quote(&instruments).await {
        Ok(quotes) => {
            debug!("Quotes retrieved successfully: {} quotes", quotes.len());
            (
                StatusCode::OK,
                Json(ApiResult::success(quotes)),
            )
        }
        Err(err) => {
            error!("Failed to get quotes: {}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResult::<HashMap<String, KiteQuote>>::from_error(err)),
            )
        }
    }
}

/// Get historical data
#[instrument(skip(kite_service, params))]
async fn get_historical_data(
    State(kite_service): State<Arc<KiteService>>,
    Json(params): Json<KiteHistoricalDataParams>,
) -> impl IntoResponse {
    debug!("Getting historical data for {}", params.symbol);
    
    match kite_service.get_historical_data(params).await {
        Ok(data) => {
            debug!("Historical data retrieved successfully: {} candles", data.len());
            (
                StatusCode::OK,
                Json(ApiResult::success(data)),
            )
        }
        Err(err) => {
            error!("Failed to get historical data: {}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResult::<Vec<KiteOHLCV>>::from_error(err)),
            )
        }
    }
}

/// Place order
#[instrument(skip(kite_service, order))]
async fn place_order(
    State(kite_service): State<Arc<KiteService>>,
    Json(order): Json<KiteOrderRequest>,
) -> impl IntoResponse {
    debug!("Placing order for {} {}", order.transaction_type, order.tradingsymbol);
    
    match kite_service.place_order(order).await {
        Ok(response) => {
            info!("Order placed successfully: {}", response.order_id);
            (
                StatusCode::OK,
                Json(ApiResult::success(response)),
            )
        }
        Err(err) => {
            error!("Failed to place order: {}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResult::<KiteOrderResponse>::from_error(err)),
            )
        }
    }
}

/// Modify order
#[instrument(skip(kite_service, order))]
async fn modify_order(
    State(kite_service): State<Arc<KiteService>>,
    Path(order_id): Path<String>,
    Json(order): Json<KiteOrderRequest>,
) -> impl IntoResponse {
    debug!("Modifying order {}", order_id);
    
    match kite_service.modify_order(&order_id, order).await {
        Ok(response) => {
            info!("Order modified successfully: {}", response.order_id);
            (
                StatusCode::OK,
                Json(ApiResult::success(response)),
            )
        }
        Err(err) => {
            error!("Failed to modify order: {}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResult::<KiteOrderResponse>::from_error(err)),
            )
        }
    }
}

/// Cancel order
#[instrument(skip(kite_service))]
async fn cancel_order(
    State(kite_service): State<Arc<KiteService>>,
    Path((order_id, variety_str)): Path<(String, String)>,
) -> impl IntoResponse {
    debug!("Cancelling order {} with variety {}", order_id, variety_str);
    
    // Parse variety
    let variety = match variety_str.as_str() {
        "regular" => KiteOrderVariety::Regular,
        "co" => KiteOrderVariety::CO,
        "bo" => KiteOrderVariety::BO,
        "amo" => KiteOrderVariety::AMO,
        _ => {
            error!("Invalid order variety: {}", variety_str);
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiResult::<KiteOrderResponse>::error(
                    format!("Invalid order variety: {}", variety_str),
                    Some("VALIDATION_ERROR".to_string()),
                )),
            );
        }
    };
    
    match kite_service.cancel_order(&order_id, variety).await {
        Ok(response) => {
            info!("Order cancelled successfully: {}", response.order_id);
            (
                StatusCode::OK,
                Json(ApiResult::success(response)),
            )
        }
        Err(err) => {
            error!("Failed to cancel order: {}", err);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResult::<KiteOrderResponse>::from_error(err)),
            )
        }
    }
}