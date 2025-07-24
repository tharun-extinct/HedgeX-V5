use crate::error::{ApiResult, HedgeXError, Result};
use crate::services::{AppService, AuthService, WebSocketManager, StrategyService};
use crate::trading::TradingEngine;
use crate::api::middleware::auth_middleware;
use axum::{
    extract::{Path, Query, Request, State},
    http::{HeaderMap, StatusCode},
    middleware,
    response::Json,
    routing::{delete, get, post, put},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower::ServiceBuilder;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::{debug, error, info, warn};

/// Shared application state for HTTP server
#[derive(Clone)]
pub struct HttpServerState {
    pub app_service: Arc<AppService>,
    pub trading_engines: Arc<RwLock<HashMap<String, Arc<TradingEngine>>>>,
}

impl HttpServerState {
    pub fn new(app_service: Arc<AppService>) -> Self {
        Self {
            app_service,
            trading_engines: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

/// Create the main HTTP server with all routes
pub fn create_server(state: HttpServerState) -> Router {
    // Create CORS layer
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Public routes (no authentication required)
    let public_routes = Router::new()
        .route("/api/auth/login", post(login))
        .route("/api/auth/register", post(register))
        .route("/api/health", get(health_check))
        .route("/api/stocks/nifty50", get(get_nifty_50_stocks))
        .route("/api/market/data", get(get_market_data))
        .route("/api/market/data/:symbol", get(get_symbol_market_data))
        .route("/api/analytics/logs", get(get_logs));

    // Protected routes (require authentication)
    let protected_routes = Router::new()
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/profile", get(get_profile))
        .route("/api/auth/credentials", post(save_api_credentials))
        .route("/api/auth/credentials", get(get_api_credentials))
        .route("/api/auth/credentials", put(update_api_credentials))
        
        // Trading control endpoints
        .route("/api/trading/start", post(start_trading))
        .route("/api/trading/stop", post(stop_trading))
        .route("/api/trading/emergency-stop", post(emergency_stop))
        .route("/api/trading/status", get(get_trading_status))
        .route("/api/trading/positions", get(get_positions))
        .route("/api/trading/trades", get(get_trades))
        .route("/api/trading/performance", get(get_performance_metrics))
        
        // Strategy management endpoints
        .route("/api/strategies", get(get_strategies))
        .route("/api/strategies", post(create_strategy))
        .route("/api/strategies/:id", get(get_strategy))
        .route("/api/strategies/:id", put(update_strategy))
        .route("/api/strategies/:id", delete(delete_strategy))
        .route("/api/strategies/:id/enable", post(enable_strategy))
        .route("/api/strategies/:id/disable", post(disable_strategy))
        .route("/api/strategies/:id/performance", get(get_strategy_performance))
        
        // Stock selection endpoints
        .route("/api/stocks/selections", get(get_stock_selections))
        .route("/api/stocks/selections", post(add_stock_selection))
        .route("/api/stocks/selections/:symbol", delete(remove_stock_selection))
        .route("/api/stocks/selections/bulk", post(bulk_add_stock_selections))
        .route("/api/stocks/selections/bulk", delete(bulk_remove_stock_selections))
        
        // Analytics endpoints
        .route("/api/analytics/trades", get(get_trade_history))
        .route("/api/analytics/performance", get(get_analytics_performance))
        .layer(middleware::from_fn_with_state(
            state.app_service.get_auth_service(),
            auth_middleware,
        ));

    // Combine routes
    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(cors)
        )
        .with_state(state)
}

// ============================================================================
// Authentication Endpoints
// ============================================================================

#[derive(Deserialize)]
struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Serialize)]
struct LoginResponse {
    token: String,
    user_id: String,
    expires_at: String,
}

async fn login(
    State(state): State<HttpServerState>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<ApiResult<LoginResponse>>, StatusCode> {
    debug!("Login attempt for user: {}", request.username);
    
    let auth_service = state.app_service.get_auth_service();
    let login_req = crate::services::auth_service::LoginRequest {
        username: request.username,
        password: request.password,
    };
    
    match auth_service.login(login_req).await {
        Ok(session) => {
            info!("Login successful for user: {}", session.user_id);
            let response = LoginResponse {
                token: session.token,
                user_id: session.user_id,
                expires_at: session.expires_at.to_rfc3339(),
            };
            Ok(Json(ApiResult::success(response)))
        }
        Err(e) => {
            warn!("Login failed: {}", e);
            Ok(Json(ApiResult::from_error(e)))
        }
    }
}

#[derive(Deserialize)]
struct RegisterRequest {
    username: String,
    password: String,
}

#[derive(Serialize)]
struct RegisterResponse {
    user_id: String,
    username: String,
}

async fn register(
    State(state): State<HttpServerState>,
    Json(request): Json<RegisterRequest>,
) -> Result<Json<ApiResult<RegisterResponse>>, StatusCode> {
    debug!("Registration attempt for user: {}", request.username);
    
    let auth_service = state.app_service.get_auth_service();
    let register_req = crate::services::auth_service::RegisterRequest {
        username: request.username.clone(),
        password: request.password,
    };
    
    match auth_service.register(register_req).await {
        Ok(user) => {
            info!("Registration successful for user: {}", user.username);
            let response = RegisterResponse {
                user_id: user.id,
                username: user.username,
            };
            Ok(Json(ApiResult::success(response)))
        }
        Err(e) => {
            warn!("Registration failed: {}", e);
            Ok(Json(ApiResult::from_error(e)))
        }
    }
}

async fn logout(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
) -> Result<Json<ApiResult<String>>, StatusCode> {
    if let Some(token) = extract_token_from_headers(&headers) {
        let auth_service = state.app_service.get_auth_service();
        match auth_service.logout(&token).await {
            Ok(_) => {
                info!("Logout successful");
                Ok(Json(ApiResult::success("Logged out successfully".to_string())))
            }
            Err(e) => {
                warn!("Logout failed: {}", e);
                Ok(Json(ApiResult::from_error(e)))
            }
        }
    } else {
        Ok(Json(ApiResult::error("No token provided".to_string(), Some("INVALID_TOKEN".to_string()))))
    }
}

#[derive(Serialize)]
struct ProfileResponse {
    user_id: String,
    username: String,
    created_at: String,
}

async fn get_profile(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
) -> Result<Json<ApiResult<ProfileResponse>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    // Get user profile from database
    let query = "SELECT id, username, created_at FROM users WHERE id = ?";
    let db_pool = state.app_service.get_enhanced_database_service().get_database().get_pool();
    
    match sqlx::query(query).bind(&user_id).fetch_one(db_pool).await {
        Ok(row) => {
            let profile = ProfileResponse {
                user_id: row.get("id"),
                username: row.get("username"),
                created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            };
            Ok(Json(ApiResult::success(profile)))
        }
        Err(e) => {
            error!("Failed to get user profile: {}", e);
            Ok(Json(ApiResult::from_error(HedgeXError::DatabaseError(e))))
        }
    }
}

#[derive(Deserialize)]
struct ApiCredentialsRequest {
    api_key: String,
    api_secret: String,
    access_token: Option<String>,
}

async fn save_api_credentials(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
    Json(request): Json<ApiCredentialsRequest>,
) -> Result<Json<ApiResult<String>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let auth_service = state.app_service.get_auth_service();
    let credentials = crate::models::auth::ApiCredentials {
        user_id: user_id.clone(),
        api_key: request.api_key,
        api_secret: request.api_secret,
        access_token: request.access_token,
        access_token_expiry: None,
    };
    
    match auth_service.store_api_credentials(&user_id, credentials).await {
        Ok(_) => {
            info!("API credentials saved for user: {}", user_id);
            Ok(Json(ApiResult::success("API credentials saved successfully".to_string())))
        }
        Err(e) => {
            error!("Failed to save API credentials: {}", e);
            Ok(Json(ApiResult::from_error(e)))
        }
    }
}

#[derive(Serialize)]
struct ApiCredentialsResponse {
    api_key: String,
    has_api_secret: bool,
    has_access_token: bool,
    access_token_expiry: Option<String>,
}

async fn get_api_credentials(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
) -> Result<Json<ApiResult<ApiCredentialsResponse>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let auth_service = state.app_service.get_auth_service();
    
    match auth_service.get_api_credentials(&user_id).await {
        Ok(credentials) => {
            let response = ApiCredentialsResponse {
                api_key: credentials.api_key,
                has_api_secret: !credentials.api_secret.is_empty(),
                has_access_token: credentials.access_token.is_some(),
                access_token_expiry: credentials.access_token_expiry.map(|dt| dt.to_rfc3339()),
            };
            Ok(Json(ApiResult::success(response)))
        }
        Err(e) => {
            error!("Failed to get API credentials: {}", e);
            Ok(Json(ApiResult::from_error(e)))
        }
    }
}

async fn update_api_credentials(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
    Json(request): Json<ApiCredentialsRequest>,
) -> Result<Json<ApiResult<String>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let auth_service = state.app_service.get_auth_service();
    let credentials = crate::models::auth::ApiCredentials {
        user_id: user_id.clone(),
        api_key: request.api_key,
        api_secret: request.api_secret,
        access_token: request.access_token,
        access_token_expiry: None,
    };
    
    match auth_service.update_api_credentials(&user_id, credentials).await {
        Ok(_) => {
            info!("API credentials updated for user: {}", user_id);
            Ok(Json(ApiResult::success("API credentials updated successfully".to_string())))
        }
        Err(e) => {
            error!("Failed to update API credentials: {}", e);
            Ok(Json(ApiResult::from_error(e)))
        }
    }
}

// ============================================================================
// Trading Control Endpoints
// ============================================================================

async fn start_trading(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
) -> Result<Json<ApiResult<String>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    // Get or create trading engine for user
    let trading_engine = match get_or_create_trading_engine(&state, &user_id).await {
        Ok(engine) => engine,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    match trading_engine.start_trading().await {
        Ok(_) => {
            info!("Trading started for user: {}", user_id);
            Ok(Json(ApiResult::success("Trading started successfully".to_string())))
        }
        Err(e) => {
            error!("Failed to start trading: {}", e);
            Ok(Json(ApiResult::from_error(e)))
        }
    }
}

async fn stop_trading(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
) -> Result<Json<ApiResult<String>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let trading_engines = state.trading_engines.read().await;
    if let Some(trading_engine) = trading_engines.get(&user_id) {
        match trading_engine.stop_trading().await {
            Ok(_) => {
                info!("Trading stopped for user: {}", user_id);
                Ok(Json(ApiResult::success("Trading stopped successfully".to_string())))
            }
            Err(e) => {
                error!("Failed to stop trading: {}", e);
                Ok(Json(ApiResult::from_error(e)))
            }
        }
    } else {
        Ok(Json(ApiResult::success("Trading was not active".to_string())))
    }
}

async fn emergency_stop(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
) -> Result<Json<ApiResult<String>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let trading_engines = state.trading_engines.read().await;
    if let Some(trading_engine) = trading_engines.get(&user_id) {
        match trading_engine.emergency_stop().await {
            Ok(_) => {
                warn!("Emergency stop activated for user: {}", user_id);
                Ok(Json(ApiResult::success("Emergency stop activated".to_string())))
            }
            Err(e) => {
                error!("Failed to activate emergency stop: {}", e);
                Ok(Json(ApiResult::from_error(e)))
            }
        }
    } else {
        Ok(Json(ApiResult::success("No active trading to stop".to_string())))
    }
}

#[derive(Serialize)]
struct TradingStatusResponse {
    is_active: bool,
    is_emergency_stop_active: bool,
    last_execution_time_ms: Option<u64>,
}

async fn get_trading_status(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
) -> Result<Json<ApiResult<TradingStatusResponse>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let trading_engines = state.trading_engines.read().await;
    if let Some(trading_engine) = trading_engines.get(&user_id) {
        let is_active = trading_engine.is_trading_active().await;
        let is_emergency_stop_active = trading_engine.is_emergency_stop_active().await;
        let last_execution_time_ms = trading_engine.get_last_execution_time().await
            .map(|duration| duration.as_millis() as u64);
        
        let response = TradingStatusResponse {
            is_active,
            is_emergency_stop_active,
            last_execution_time_ms,
        };
        
        Ok(Json(ApiResult::success(response)))
    } else {
        let response = TradingStatusResponse {
            is_active: false,
            is_emergency_stop_active: false,
            last_execution_time_ms: None,
        };
        Ok(Json(ApiResult::success(response)))
    }
}

async fn get_positions(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
) -> Result<Json<ApiResult<Vec<crate::models::trading::Position>>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let trading_engines = state.trading_engines.read().await;
    if let Some(trading_engine) = trading_engines.get(&user_id) {
        match trading_engine.get_positions().await {
            Ok(positions) => Ok(Json(ApiResult::success(positions))),
            Err(e) => {
                error!("Failed to get positions: {}", e);
                Ok(Json(ApiResult::from_error(e)))
            }
        }
    } else {
        Ok(Json(ApiResult::success(Vec::new())))
    }
}

async fn get_trades(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResult<Vec<crate::models::trading::Trade>>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let limit = params.get("limit")
        .and_then(|s| s.parse::<i32>().ok())
        .unwrap_or(100);
    
    let offset = params.get("offset")
        .and_then(|s| s.parse::<i32>().ok())
        .unwrap_or(0);
    
    let query = "
        SELECT id, user_id, symbol, exchange, order_id, trade_type, quantity, 
               price, status, executed_at, strategy_id, created_at, updated_at
        FROM trades 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
    ";
    
    let db_pool = state.app_service.get_enhanced_database_service().get_database().get_pool();
    
    match sqlx::query(query)
        .bind(&user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(db_pool)
        .await
    {
        Ok(rows) => {
            let mut trades = Vec::new();
            
            for row in rows {
                let trade_type_str: String = row.get("trade_type");
                let status_str: String = row.get("status");
                let price_f64: f64 = row.get("price");
                
                let trade_type = match trade_type_str.as_str() {
                    "Buy" => crate::models::trading::TradeType::Buy,
                    "Sell" => crate::models::trading::TradeType::Sell,
                    _ => continue,
                };
                
                let status = match status_str.as_str() {
                    "Pending" => crate::models::trading::TradeStatus::Pending,
                    "Executed" => crate::models::trading::TradeStatus::Executed,
                    "Cancelled" => crate::models::trading::TradeStatus::Cancelled,
                    "Failed" => crate::models::trading::TradeStatus::Failed,
                    "PartiallyFilled" => crate::models::trading::TradeStatus::PartiallyFilled,
                    _ => continue,
                };
                
                let trade = crate::models::trading::Trade {
                    id: row.get("id"),
                    user_id: row.get("user_id"),
                    symbol: row.get("symbol"),
                    exchange: row.get("exchange"),
                    order_id: row.get("order_id"),
                    trade_type,
                    quantity: row.get("quantity"),
                    price: rust_decimal::Decimal::from_f64_retain(price_f64).unwrap_or(rust_decimal::Decimal::ZERO),
                    status,
                    executed_at: row.get("executed_at"),
                    strategy_id: row.get("strategy_id"),
                    created_at: row.get("created_at"),
                    updated_at: row.get("updated_at"),
                };
                
                trades.push(trade);
            }
            
            Ok(Json(ApiResult::success(trades)))
        }
        Err(e) => {
            error!("Failed to get trades: {}", e);
            Ok(Json(ApiResult::from_error(HedgeXError::DatabaseError(e))))
        }
    }
}

async fn get_performance_metrics(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
) -> Result<Json<ApiResult<crate::models::trading::PerformanceMetrics>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let trading_engines = state.trading_engines.read().await;
    if let Some(trading_engine) = trading_engines.get(&user_id) {
        match trading_engine.get_performance_metrics().await {
            Ok(metrics) => Ok(Json(ApiResult::success(metrics))),
            Err(e) => {
                error!("Failed to get performance metrics: {}", e);
                Ok(Json(ApiResult::from_error(e)))
            }
        }
    } else {
        // Return empty metrics if no trading engine
        let metrics = crate::models::trading::PerformanceMetrics::new(&user_id);
        Ok(Json(ApiResult::success(metrics)))
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Extract token from Authorization header
fn extract_token_from_headers(headers: &HeaderMap) -> Option<String> {
    headers
        .get("Authorization")
        .and_then(|auth_header| auth_header.to_str().ok())
        .and_then(|auth_value| {
            if auth_value.starts_with("Bearer ") {
                Some(auth_value[7..].to_string())
            } else {
                None
            }
        })
}

/// Extract user ID from headers using authentication service
async fn extract_user_id_from_headers(
    headers: &HeaderMap,
    auth_service: &Arc<AuthService>,
) -> Result<String> {
    let token = extract_token_from_headers(headers)
        .ok_or_else(|| HedgeXError::SessionError)?;
    
    auth_service.validate_session(&token).await
}



/// Get or create trading engine for user
async fn get_or_create_trading_engine(
    state: &HttpServerState,
    user_id: &str,
) -> Result<Arc<TradingEngine>> {
    let mut trading_engines = state.trading_engines.write().await;
    
    if let Some(engine) = trading_engines.get(user_id) {
        return Ok(Arc::clone(engine));
    }
    
    // Create new trading engine
    let kite_service = Arc::new(crate::services::kite_service::KiteService::new(
        state.app_service.get_enhanced_database_service(),
        user_id,
    ).await?);
    
    let trading_engine = Arc::new(TradingEngine::new(
        state.app_service.get_enhanced_database_service(),
        kite_service,
        user_id,
    ).await?);
    
    trading_engines.insert(user_id.to_string(), Arc::clone(&trading_engine));
    
    Ok(trading_engine)
}

/// Health check endpoint
async fn health_check(
    State(state): State<HttpServerState>,
) -> Result<Json<ApiResult<HashMap<String, serde_json::Value>>>, StatusCode> {
    let mut health_info = HashMap::new();
    
    // Check app service health
    match state.app_service.health_check().await {
        Ok(health_status) => {
            health_info.insert("app_service".to_string(), serde_json::json!({
                "healthy": health_status.overall_healthy,
                "database": health_status.database_healthy,
                "crypto": health_status.crypto_service_healthy,
                "logger": health_status.logger_healthy,
                "errors": health_status.errors
            }));
        }
        Err(e) => {
            health_info.insert("app_service".to_string(), serde_json::json!({
                "healthy": false,
                "error": e.to_string()
            }));
        }
    }
    
    // Check active trading engines
    let trading_engines = state.trading_engines.read().await;
    health_info.insert("active_trading_engines".to_string(), 
                      serde_json::json!(trading_engines.len()));
    
    health_info.insert("timestamp".to_string(), 
                      serde_json::json!(chrono::Utc::now().to_rfc3339()));
    
    Ok(Json(ApiResult::success(health_info)))
}
// =======
=====================================================================
// Strategy Management Endpoints
// ============================================================================

async fn get_strategies(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
) -> Result<Json<ApiResult<Vec<crate::models::trading::StrategyParams>>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let strategy_service = crate::services::StrategyService::new(
        state.app_service.get_enhanced_database_service()
    ).await.map_err(|e| {
        error!("Failed to create strategy service: {}", e);
        e
    });
    
    match strategy_service {
        Ok(service) => {
            match service.get_strategies(&user_id).await {
                Ok(strategies) => Ok(Json(ApiResult::success(strategies))),
                Err(e) => {
                    error!("Failed to get strategies: {}", e);
                    Ok(Json(ApiResult::from_error(e)))
                }
            }
        }
        Err(e) => Ok(Json(ApiResult::from_error(e)))
    }
}

#[derive(Deserialize)]
struct CreateStrategyRequest {
    name: String,
    description: Option<String>,
    max_trades_per_day: i32,
    risk_percentage: f64,
    stop_loss_percentage: f64,
    take_profit_percentage: f64,
    volume_threshold: i64,
}

async fn create_strategy(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
    Json(request): Json<CreateStrategyRequest>,
) -> Result<Json<ApiResult<crate::models::trading::StrategyParams>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let strategy_service = crate::services::StrategyService::new(
        state.app_service.get_enhanced_database_service()
    ).await.map_err(|e| {
        error!("Failed to create strategy service: {}", e);
        e
    });
    
    match strategy_service {
        Ok(service) => {
            let create_req = crate::services::CreateStrategyRequest {
                name: request.name,
                description: request.description,
                max_trades_per_day: request.max_trades_per_day,
                risk_percentage: request.risk_percentage,
                stop_loss_percentage: request.stop_loss_percentage,
                take_profit_percentage: request.take_profit_percentage,
                volume_threshold: request.volume_threshold,
            };
            
            match service.create_strategy(&user_id, create_req).await {
                Ok(strategy) => {
                    info!("Strategy created: {} for user: {}", strategy.name, user_id);
                    Ok(Json(ApiResult::success(strategy)))
                }
                Err(e) => {
                    error!("Failed to create strategy: {}", e);
                    Ok(Json(ApiResult::from_error(e)))
                }
            }
        }
        Err(e) => Ok(Json(ApiResult::from_error(e)))
    }
}

async fn get_strategy(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
    Path(strategy_id): Path<String>,
) -> Result<Json<ApiResult<crate::models::trading::StrategyParams>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let strategy_service = crate::services::StrategyService::new(
        state.app_service.get_enhanced_database_service()
    ).await.map_err(|e| {
        error!("Failed to create strategy service: {}", e);
        e
    });
    
    match strategy_service {
        Ok(service) => {
            match service.get_strategy(&user_id, &strategy_id).await {
                Ok(Some(strategy)) => Ok(Json(ApiResult::success(strategy))),
                Ok(None) => Ok(Json(ApiResult::from_error(
                    HedgeXError::NotFoundError("Strategy not found".to_string())
                ))),
                Err(e) => {
                    error!("Failed to get strategy: {}", e);
                    Ok(Json(ApiResult::from_error(e)))
                }
            }
        }
        Err(e) => Ok(Json(ApiResult::from_error(e)))
    }
}

#[derive(Deserialize)]
struct UpdateStrategyRequest {
    name: Option<String>,
    description: Option<String>,
    max_trades_per_day: Option<i32>,
    risk_percentage: Option<f64>,
    stop_loss_percentage: Option<f64>,
    take_profit_percentage: Option<f64>,
    volume_threshold: Option<i64>,
}

async fn update_strategy(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
    Path(strategy_id): Path<String>,
    Json(request): Json<UpdateStrategyRequest>,
) -> Result<Json<ApiResult<crate::models::trading::StrategyParams>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let strategy_service = crate::services::StrategyService::new(
        state.app_service.get_enhanced_database_service()
    ).await.map_err(|e| {
        error!("Failed to create strategy service: {}", e);
        e
    });
    
    match strategy_service {
        Ok(service) => {
            let update_req = crate::services::UpdateStrategyRequest {
                name: request.name,
                description: request.description,
                max_trades_per_day: request.max_trades_per_day,
                risk_percentage: request.risk_percentage,
                stop_loss_percentage: request.stop_loss_percentage,
                take_profit_percentage: request.take_profit_percentage,
                volume_threshold: request.volume_threshold,
            };
            
            match service.update_strategy(&user_id, &strategy_id, update_req).await {
                Ok(strategy) => {
                    info!("Strategy updated: {} for user: {}", strategy.name, user_id);
                    Ok(Json(ApiResult::success(strategy)))
                }
                Err(e) => {
                    error!("Failed to update strategy: {}", e);
                    Ok(Json(ApiResult::from_error(e)))
                }
            }
        }
        Err(e) => Ok(Json(ApiResult::from_error(e)))
    }
}

async fn delete_strategy(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
    Path(strategy_id): Path<String>,
) -> Result<Json<ApiResult<String>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let strategy_service = crate::services::StrategyService::new(
        state.app_service.get_enhanced_database_service()
    ).await.map_err(|e| {
        error!("Failed to create strategy service: {}", e);
        e
    });
    
    match strategy_service {
        Ok(service) => {
            match service.delete_strategy(&user_id, &strategy_id).await {
                Ok(_) => {
                    info!("Strategy deleted: {} for user: {}", strategy_id, user_id);
                    Ok(Json(ApiResult::success("Strategy deleted successfully".to_string())))
                }
                Err(e) => {
                    error!("Failed to delete strategy: {}", e);
                    Ok(Json(ApiResult::from_error(e)))
                }
            }
        }
        Err(e) => Ok(Json(ApiResult::from_error(e)))
    }
}

async fn enable_strategy(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
    Path(strategy_id): Path<String>,
) -> Result<Json<ApiResult<String>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let strategy_service = crate::services::StrategyService::new(
        state.app_service.get_enhanced_database_service()
    ).await.map_err(|e| {
        error!("Failed to create strategy service: {}", e);
        e
    });
    
    match strategy_service {
        Ok(service) => {
            match service.enable_strategy(&user_id, &strategy_id).await {
                Ok(_) => {
                    info!("Strategy enabled: {} for user: {}", strategy_id, user_id);
                    Ok(Json(ApiResult::success("Strategy enabled successfully".to_string())))
                }
                Err(e) => {
                    error!("Failed to enable strategy: {}", e);
                    Ok(Json(ApiResult::from_error(e)))
                }
            }
        }
        Err(e) => Ok(Json(ApiResult::from_error(e)))
    }
}

async fn disable_strategy(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
    Path(strategy_id): Path<String>,
) -> Result<Json<ApiResult<String>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let strategy_service = crate::services::StrategyService::new(
        state.app_service.get_enhanced_database_service()
    ).await.map_err(|e| {
        error!("Failed to create strategy service: {}", e);
        e
    });
    
    match strategy_service {
        Ok(service) => {
            match service.disable_strategy(&user_id, &strategy_id).await {
                Ok(_) => {
                    info!("Strategy disabled: {} for user: {}", strategy_id, user_id);
                    Ok(Json(ApiResult::success("Strategy disabled successfully".to_string())))
                }
                Err(e) => {
                    error!("Failed to disable strategy: {}", e);
                    Ok(Json(ApiResult::from_error(e)))
                }
            }
        }
        Err(e) => Ok(Json(ApiResult::from_error(e)))
    }
}

async fn get_strategy_performance(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
    Path(strategy_id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResult<crate::services::StrategyPerformance>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let days = params.get("days")
        .and_then(|s| s.parse::<i32>().ok());
    
    let strategy_service = crate::services::StrategyService::new(
        state.app_service.get_enhanced_database_service()
    ).await.map_err(|e| {
        error!("Failed to create strategy service: {}", e);
        e
    });
    
    match strategy_service {
        Ok(service) => {
            match service.get_strategy_performance(&user_id, &strategy_id, days).await {
                Ok(performance) => Ok(Json(ApiResult::success(performance))),
                Err(e) => {
                    error!("Failed to get strategy performance: {}", e);
                    Ok(Json(ApiResult::from_error(e)))
                }
            }
        }
        Err(e) => Ok(Json(ApiResult::from_error(e)))
    }
}

// ============================================================================
// Stock Selection Endpoints
// ============================================================================

async fn get_nifty_50_stocks(
    _headers: HeaderMap,
    State(state): State<HttpServerState>,
) -> Result<Json<ApiResult<Vec<(String, String)>>>, StatusCode> {
    let strategy_service = crate::services::StrategyService::new(
        state.app_service.get_enhanced_database_service()
    ).await.map_err(|e| {
        error!("Failed to create strategy service: {}", e);
        e
    });
    
    match strategy_service {
        Ok(service) => {
            let stocks = service.get_nifty_50_stocks();
            Ok(Json(ApiResult::success(stocks)))
        }
        Err(e) => Ok(Json(ApiResult::from_error(e)))
    }
}

async fn get_stock_selections(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
) -> Result<Json<ApiResult<Vec<crate::models::trading::StockSelection>>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let strategy_service = crate::services::StrategyService::new(
        state.app_service.get_enhanced_database_service()
    ).await.map_err(|e| {
        error!("Failed to create strategy service: {}", e);
        e
    });
    
    match strategy_service {
        Ok(service) => {
            match service.get_stock_selections(&user_id).await {
                Ok(selections) => Ok(Json(ApiResult::success(selections))),
                Err(e) => {
                    error!("Failed to get stock selections: {}", e);
                    Ok(Json(ApiResult::from_error(e)))
                }
            }
        }
        Err(e) => Ok(Json(ApiResult::from_error(e)))
    }
}

#[derive(Deserialize)]
struct AddStockSelectionRequest {
    symbol: String,
    exchange: Option<String>,
}

async fn add_stock_selection(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
    Json(request): Json<AddStockSelectionRequest>,
) -> Result<Json<ApiResult<crate::models::trading::StockSelection>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let exchange = request.exchange.unwrap_or_else(|| "NSE".to_string());
    
    let strategy_service = crate::services::StrategyService::new(
        state.app_service.get_enhanced_database_service()
    ).await.map_err(|e| {
        error!("Failed to create strategy service: {}", e);
        e
    });
    
    match strategy_service {
        Ok(service) => {
            match service.add_stock_selection(&user_id, &request.symbol, &exchange).await {
                Ok(selection) => {
                    info!("Stock selection added: {} for user: {}", request.symbol, user_id);
                    Ok(Json(ApiResult::success(selection)))
                }
                Err(e) => {
                    error!("Failed to add stock selection: {}", e);
                    Ok(Json(ApiResult::from_error(e)))
                }
            }
        }
        Err(e) => Ok(Json(ApiResult::from_error(e)))
    }
}

async fn remove_stock_selection(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
    Path(symbol): Path<String>,
) -> Result<Json<ApiResult<String>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let strategy_service = crate::services::StrategyService::new(
        state.app_service.get_enhanced_database_service()
    ).await.map_err(|e| {
        error!("Failed to create strategy service: {}", e);
        e
    });
    
    match strategy_service {
        Ok(service) => {
            match service.remove_stock_selection(&user_id, &symbol).await {
                Ok(_) => {
                    info!("Stock selection removed: {} for user: {}", symbol, user_id);
                    Ok(Json(ApiResult::success("Stock selection removed successfully".to_string())))
                }
                Err(e) => {
                    error!("Failed to remove stock selection: {}", e);
                    Ok(Json(ApiResult::from_error(e)))
                }
            }
        }
        Err(e) => Ok(Json(ApiResult::from_error(e)))
    }
}

#[derive(Deserialize)]
struct BulkStockSelectionRequest {
    symbols: Vec<String>,
    exchange: Option<String>,
}

async fn bulk_add_stock_selections(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
    Json(request): Json<BulkStockSelectionRequest>,
) -> Result<Json<ApiResult<Vec<crate::models::trading::StockSelection>>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let exchange = request.exchange.unwrap_or_else(|| "NSE".to_string());
    
    let strategy_service = crate::services::StrategyService::new(
        state.app_service.get_enhanced_database_service()
    ).await.map_err(|e| {
        error!("Failed to create strategy service: {}", e);
        e
    });
    
    match strategy_service {
        Ok(service) => {
            match service.bulk_add_stock_selections(&user_id, request.symbols.clone(), &exchange).await {
                Ok(selections) => {
                    info!("Bulk stock selections added: {:?} for user: {}", request.symbols, user_id);
                    Ok(Json(ApiResult::success(selections)))
                }
                Err(e) => {
                    error!("Failed to bulk add stock selections: {}", e);
                    Ok(Json(ApiResult::from_error(e)))
                }
            }
        }
        Err(e) => Ok(Json(ApiResult::from_error(e)))
    }
}

async fn bulk_remove_stock_selections(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
    Json(request): Json<BulkStockSelectionRequest>,
) -> Result<Json<ApiResult<String>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let strategy_service = crate::services::StrategyService::new(
        state.app_service.get_enhanced_database_service()
    ).await.map_err(|e| {
        error!("Failed to create strategy service: {}", e);
        e
    });
    
    match strategy_service {
        Ok(service) => {
            match service.bulk_remove_stock_selections(&user_id, request.symbols.clone()).await {
                Ok(_) => {
                    info!("Bulk stock selections removed: {:?} for user: {}", request.symbols, user_id);
                    Ok(Json(ApiResult::success("Stock selections removed successfully".to_string())))
                }
                Err(e) => {
                    error!("Failed to bulk remove stock selections: {}", e);
                    Ok(Json(ApiResult::from_error(e)))
                }
            }
        }
        Err(e) => Ok(Json(ApiResult::from_error(e)))
    }
}

// ============================================================================
// Market Data Endpoints
// ============================================================================

async fn get_market_data(
    _headers: HeaderMap,
    State(state): State<HttpServerState>,
) -> Result<Json<ApiResult<Vec<serde_json::Value>>>, StatusCode> {
    let websocket_manager = state.app_service.get_websocket_manager();
    
    let market_data = websocket_manager.get_all_cached_market_data().await;
    
    let data: Vec<serde_json::Value> = market_data
        .values()
        .map(|md| {
            serde_json::json!({
                "symbol": md.symbol,
                "instrument_token": md.instrument_token,
                "ltp": md.ltp.to_string(),
                "volume": md.volume,
                "bid": md.bid.to_string(),
                "ask": md.ask.to_string(),
                "timestamp": md.timestamp.to_rfc3339(),
                "change": md.change.map(|c| c.to_string()),
                "change_percent": md.change_percent.map(|c| c.to_string()),
            })
        })
        .collect();
    
    Ok(Json(ApiResult::success(data)))
}

async fn get_symbol_market_data(
    _headers: HeaderMap,
    State(state): State<HttpServerState>,
    Path(symbol): Path<String>,
) -> Result<Json<ApiResult<serde_json::Value>>, StatusCode> {
    let websocket_manager = state.app_service.get_websocket_manager();
    
    match websocket_manager.get_cached_market_data(&symbol).await {
        Some(md) => {
            let data = serde_json::json!({
                "symbol": md.symbol,
                "instrument_token": md.instrument_token,
                "ltp": md.ltp.to_string(),
                "volume": md.volume,
                "bid": md.bid.to_string(),
                "ask": md.ask.to_string(),
                "timestamp": md.timestamp.to_rfc3339(),
                "change": md.change.map(|c| c.to_string()),
                "change_percent": md.change_percent.map(|c| c.to_string()),
            });
            Ok(Json(ApiResult::success(data)))
        }
        None => {
            Ok(Json(ApiResult::from_error(
                HedgeXError::NotFoundError(format!("No market data found for symbol: {}", symbol))
            )))
        }
    }
}

// ============================================================================
// Analytics Endpoints
// ============================================================================

async fn get_trade_history(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResult<Vec<crate::models::trading::Trade>>>, StatusCode> {
    // This is the same as get_trades but with different filtering options
    get_trades(headers, State(state), Query(params)).await
}

#[derive(Serialize)]
struct AnalyticsPerformanceResponse {
    total_trades: i32,
    profitable_trades: i32,
    total_pnl: String,
    win_rate: f64,
    max_drawdown: String,
    sharpe_ratio: f64,
    profit_factor: f64,
}

async fn get_analytics_performance(
    headers: HeaderMap,
    State(state): State<HttpServerState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResult<AnalyticsPerformanceResponse>>, StatusCode> {
    let user_id = match extract_user_id_from_headers(&headers, &state.app_service.get_auth_service()).await {
        Ok(id) => id,
        Err(e) => return Ok(Json(ApiResult::from_error(e))),
    };
    
    let days = params.get("days")
        .and_then(|s| s.parse::<i32>().ok())
        .unwrap_or(30);
    
    // Calculate performance metrics from database
    let query = "
        SELECT 
            COUNT(*) as total_trades,
            COUNT(CASE WHEN price > 0 THEN 1 END) as profitable_trades,
            SUM(price * quantity * CASE WHEN trade_type = 'Sell' THEN 1 ELSE -1 END) as total_pnl
        FROM trades 
        WHERE user_id = ? 
        AND status = 'Executed'
        AND created_at >= datetime('now', '-' || ? || ' days')
    ";
    
    let db_pool = state.app_service.get_enhanced_database_service().get_database().get_pool();
    
    match sqlx::query(query)
        .bind(&user_id)
        .bind(days)
        .fetch_one(db_pool)
        .await
    {
        Ok(row) => {
            let total_trades: i32 = row.get("total_trades");
            let profitable_trades: i32 = row.get("profitable_trades");
            let total_pnl: f64 = row.get::<Option<f64>, _>("total_pnl").unwrap_or(0.0);
            
            let win_rate = if total_trades > 0 {
                (profitable_trades as f64 / total_trades as f64) * 100.0
            } else {
                0.0
            };
            
            let response = AnalyticsPerformanceResponse {
                total_trades,
                profitable_trades,
                total_pnl: total_pnl.to_string(),
                win_rate,
                max_drawdown: "0.0".to_string(), // TODO: Calculate actual max drawdown
                sharpe_ratio: 0.0, // TODO: Calculate actual Sharpe ratio
                profit_factor: if total_trades > 0 { total_pnl / total_trades as f64 } else { 0.0 },
            };
            
            Ok(Json(ApiResult::success(response)))
        }
        Err(e) => {
            error!("Failed to get analytics performance: {}", e);
            Ok(Json(ApiResult::from_error(HedgeXError::DatabaseError(e))))
        }
    }
}

#[derive(Serialize)]
struct LogEntry {
    timestamp: String,
    level: String,
    message: String,
    module: Option<String>,
}

async fn get_logs(
    _headers: HeaderMap,
    State(state): State<HttpServerState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<ApiResult<Vec<LogEntry>>>, StatusCode> {
    let limit = params.get("limit")
        .and_then(|s| s.parse::<i32>().ok())
        .unwrap_or(100);
    
    let level_filter = params.get("level").cloned();
    
    // Get logs from database
    let mut query = "SELECT timestamp, level, message, module FROM logs".to_string();
    let mut conditions = Vec::new();
    
    if let Some(level) = &level_filter {
        conditions.push(format!("level = '{}'", level));
    }
    
    if !conditions.is_empty() {
        query.push_str(" WHERE ");
        query.push_str(&conditions.join(" AND "));
    }
    
    query.push_str(" ORDER BY timestamp DESC LIMIT ?");
    
    let db_pool = state.app_service.get_enhanced_database_service().get_database().get_pool();
    
    match sqlx::query(&query)
        .bind(limit)
        .fetch_all(db_pool)
        .await
    {
        Ok(rows) => {
            let logs: Vec<LogEntry> = rows
                .into_iter()
                .map(|row| LogEntry {
                    timestamp: row.get::<chrono::DateTime<chrono::Utc>, _>("timestamp").to_rfc3339(),
                    level: row.get("level"),
                    message: row.get("message"),
                    module: row.get("module"),
                })
                .collect();
            
            Ok(Json(ApiResult::success(logs)))
        }
        Err(e) => {
            error!("Failed to get logs: {}", e);
            Ok(Json(ApiResult::from_error(HedgeXError::DatabaseError(e))))
        }
    }
}