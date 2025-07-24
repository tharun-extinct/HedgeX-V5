use crate::api::http_server::{HttpServerState, create_server};
use crate::services::AppService;
use axum::body::Body;
use axum::http::{Request, StatusCode, Method};
use serde_json::{json, Value};
use std::sync::Arc;
use tempfile::tempdir;
use tower::ServiceExt;

/// Helper function to create test app service
async fn create_test_app_service() -> Arc<AppService> {
    let temp_dir = tempdir().unwrap();
    let app_data_dir = temp_dir.path();
    
    AppService::new(app_data_dir).await.unwrap().into()
}

/// Helper function to create test server
async fn create_test_server() -> (axum::Router, Arc<AppService>) {
    let app_service = create_test_app_service().await;
    let state = HttpServerState::new(Arc::clone(&app_service));
    let server = create_server(state);
    (server, app_service)
}

/// Helper function to make authenticated request
async fn make_authenticated_request(
    server: &axum::Router,
    method: Method,
    uri: &str,
    token: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut request_builder = Request::builder()
        .method(method)
        .uri(uri)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json");
    
    let request = if let Some(body) = body {
        request_builder.body(Body::from(body.to_string())).unwrap()
    } else {
        request_builder.body(Body::empty()).unwrap()
    };
    
    let response = server.clone().oneshot(request).await.unwrap();
    let status = response.status();
    
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body_str = String::from_utf8(body_bytes.to_vec()).unwrap();
    let body_json: Value = serde_json::from_str(&body_str).unwrap_or(json!({}));
    
    (status, body_json)
}

/// Helper function to make unauthenticated request
async fn make_request(
    server: &axum::Router,
    method: Method,
    uri: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut request_builder = Request::builder()
        .method(method)
        .uri(uri)
        .header("Content-Type", "application/json");
    
    let request = if let Some(body) = body {
        request_builder.body(Body::from(body.to_string())).unwrap()
    } else {
        request_builder.body(Body::empty()).unwrap()
    };
    
    let response = server.clone().oneshot(request).await.unwrap();
    let status = response.status();
    
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let body_str = String::from_utf8(body_bytes.to_vec()).unwrap();
    let body_json: Value = serde_json::from_str(&body_str).unwrap_or(json!({}));
    
    (status, body_json)
}

/// Helper function to register and login a test user
async fn register_and_login_user(server: &axum::Router) -> String {
    // Register user
    let register_body = json!({
        "username": "testuser",
        "password": "TestPassword123"
    });
    
    let (status, _) = make_request(server, Method::POST, "/api/auth/register", Some(register_body)).await;
    assert_eq!(status, StatusCode::OK);
    
    // Login user
    let login_body = json!({
        "username": "testuser",
        "password": "TestPassword123"
    });
    
    let (status, response) = make_request(server, Method::POST, "/api/auth/login", Some(login_body)).await;
    assert_eq!(status, StatusCode::OK);
    
    response["data"]["token"].as_str().unwrap().to_string()
}

#[tokio::test]
async fn test_health_check() {
    let (server, _) = create_test_server().await;
    
    let (status, response) = make_request(&server, Method::GET, "/api/health", None).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
    assert!(response["data"]["app_service"].is_object());
}

#[tokio::test]
async fn test_user_registration() {
    let (server, _) = create_test_server().await;
    
    let register_body = json!({
        "username": "testuser",
        "password": "TestPassword123"
    });
    
    let (status, response) = make_request(&server, Method::POST, "/api/auth/register", Some(register_body)).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
    assert_eq!(response["data"]["username"], "testuser");
    assert!(response["data"]["user_id"].is_string());
}

#[tokio::test]
async fn test_user_login() {
    let (server, _) = create_test_server().await;
    
    // First register a user
    let register_body = json!({
        "username": "testuser",
        "password": "TestPassword123"
    });
    
    let (status, _) = make_request(&server, Method::POST, "/api/auth/register", Some(register_body)).await;
    assert_eq!(status, StatusCode::OK);
    
    // Now login
    let login_body = json!({
        "username": "testuser",
        "password": "TestPassword123"
    });
    
    let (status, response) = make_request(&server, Method::POST, "/api/auth/login", Some(login_body)).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
    assert!(response["data"]["token"].is_string());
    assert!(response["data"]["user_id"].is_string());
    assert!(response["data"]["expires_at"].is_string());
}

#[tokio::test]
async fn test_invalid_login() {
    let (server, _) = create_test_server().await;
    
    let login_body = json!({
        "username": "nonexistent",
        "password": "WrongPassword123"
    });
    
    let (status, response) = make_request(&server, Method::POST, "/api/auth/login", Some(login_body)).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(!response["success"].as_bool().unwrap());
    assert!(response["error"].is_string());
}

#[tokio::test]
async fn test_get_profile() {
    let (server, _) = create_test_server().await;
    let token = register_and_login_user(&server).await;
    
    let (status, response) = make_authenticated_request(&server, Method::GET, "/api/auth/profile", &token, None).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
    assert_eq!(response["data"]["username"], "testuser");
    assert!(response["data"]["user_id"].is_string());
    assert!(response["data"]["created_at"].is_string());
}

#[tokio::test]
async fn test_save_api_credentials() {
    let (server, _) = create_test_server().await;
    let token = register_and_login_user(&server).await;
    
    let credentials_body = json!({
        "api_key": "test_api_key",
        "api_secret": "test_api_secret"
    });
    
    let (status, response) = make_authenticated_request(
        &server, 
        Method::POST, 
        "/api/auth/credentials", 
        &token, 
        Some(credentials_body)
    ).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
}

#[tokio::test]
async fn test_get_api_credentials() {
    let (server, _) = create_test_server().await;
    let token = register_and_login_user(&server).await;
    
    // First save credentials
    let credentials_body = json!({
        "api_key": "test_api_key",
        "api_secret": "test_api_secret"
    });
    
    let (status, _) = make_authenticated_request(
        &server, 
        Method::POST, 
        "/api/auth/credentials", 
        &token, 
        Some(credentials_body)
    ).await;
    assert_eq!(status, StatusCode::OK);
    
    // Now get credentials
    let (status, response) = make_authenticated_request(&server, Method::GET, "/api/auth/credentials", &token, None).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
    assert_eq!(response["data"]["api_key"], "test_api_key");
    assert!(response["data"]["has_api_secret"].as_bool().unwrap());
}

#[tokio::test]
async fn test_logout() {
    let (server, _) = create_test_server().await;
    let token = register_and_login_user(&server).await;
    
    let (status, response) = make_authenticated_request(&server, Method::POST, "/api/auth/logout", &token, None).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
}

#[tokio::test]
async fn test_trading_status() {
    let (server, _) = create_test_server().await;
    let token = register_and_login_user(&server).await;
    
    let (status, response) = make_authenticated_request(&server, Method::GET, "/api/trading/status", &token, None).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
    assert!(response["data"]["is_active"].is_boolean());
    assert!(response["data"]["is_emergency_stop_active"].is_boolean());
}

#[tokio::test]
async fn test_get_positions() {
    let (server, _) = create_test_server().await;
    let token = register_and_login_user(&server).await;
    
    let (status, response) = make_authenticated_request(&server, Method::GET, "/api/trading/positions", &token, None).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
    assert!(response["data"].is_array());
}

#[tokio::test]
async fn test_get_trades() {
    let (server, _) = create_test_server().await;
    let token = register_and_login_user(&server).await;
    
    let (status, response) = make_authenticated_request(&server, Method::GET, "/api/trading/trades", &token, None).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
    assert!(response["data"].is_array());
}

#[tokio::test]
async fn test_get_nifty_50_stocks() {
    let (server, _) = create_test_server().await;
    
    let (status, response) = make_request(&server, Method::GET, "/api/stocks/nifty50", None).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
    assert!(response["data"].is_array());
    assert!(response["data"].as_array().unwrap().len() > 0);
}

#[tokio::test]
async fn test_get_stock_selections() {
    let (server, _) = create_test_server().await;
    let token = register_and_login_user(&server).await;
    
    let (status, response) = make_authenticated_request(&server, Method::GET, "/api/stocks/selections", &token, None).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
    assert!(response["data"].is_array());
}

#[tokio::test]
async fn test_add_stock_selection() {
    let (server, _) = create_test_server().await;
    let token = register_and_login_user(&server).await;
    
    let selection_body = json!({
        "symbol": "RELIANCE",
        "exchange": "NSE"
    });
    
    let (status, response) = make_authenticated_request(
        &server, 
        Method::POST, 
        "/api/stocks/selections", 
        &token, 
        Some(selection_body)
    ).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
    assert_eq!(response["data"]["symbol"], "RELIANCE");
    assert_eq!(response["data"]["exchange"], "NSE");
}

#[tokio::test]
async fn test_remove_stock_selection() {
    let (server, _) = create_test_server().await;
    let token = register_and_login_user(&server).await;
    
    // First add a stock selection
    let selection_body = json!({
        "symbol": "RELIANCE",
        "exchange": "NSE"
    });
    
    let (status, _) = make_authenticated_request(
        &server, 
        Method::POST, 
        "/api/stocks/selections", 
        &token, 
        Some(selection_body)
    ).await;
    assert_eq!(status, StatusCode::OK);
    
    // Now remove it
    let (status, response) = make_authenticated_request(
        &server, 
        Method::DELETE, 
        "/api/stocks/selections/RELIANCE", 
        &token, 
        None
    ).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
}

#[tokio::test]
async fn test_bulk_add_stock_selections() {
    let (server, _) = create_test_server().await;
    let token = register_and_login_user(&server).await;
    
    let bulk_body = json!({
        "symbols": ["RELIANCE", "TCS", "INFY"],
        "exchange": "NSE"
    });
    
    let (status, response) = make_authenticated_request(
        &server, 
        Method::POST, 
        "/api/stocks/selections/bulk", 
        &token, 
        Some(bulk_body)
    ).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
    assert!(response["data"].is_array());
    assert_eq!(response["data"].as_array().unwrap().len(), 3);
}

#[tokio::test]
async fn test_get_market_data() {
    let (server, _) = create_test_server().await;
    
    let (status, response) = make_request(&server, Method::GET, "/api/market/data", None).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
    assert!(response["data"].is_array());
}

#[tokio::test]
async fn test_get_analytics_performance() {
    let (server, _) = create_test_server().await;
    let token = register_and_login_user(&server).await;
    
    let (status, response) = make_authenticated_request(&server, Method::GET, "/api/analytics/performance", &token, None).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
    assert!(response["data"]["total_trades"].is_number());
    assert!(response["data"]["win_rate"].is_number());
}

#[tokio::test]
async fn test_get_logs() {
    let (server, _) = create_test_server().await;
    
    let (status, response) = make_request(&server, Method::GET, "/api/analytics/logs", None).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
    assert!(response["data"].is_array());
}

#[tokio::test]
async fn test_unauthorized_access() {
    let (server, _) = create_test_server().await;
    
    // Try to access protected endpoint without token
    let (status, response) = make_request(&server, Method::GET, "/api/auth/profile", None).await;
    
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert!(!response["success"].as_bool().unwrap());
}

#[tokio::test]
async fn test_invalid_token() {
    let (server, _) = create_test_server().await;
    
    // Try to access protected endpoint with invalid token
    let (status, response) = make_authenticated_request(&server, Method::GET, "/api/auth/profile", "invalid_token", None).await;
    
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert!(!response["success"].as_bool().unwrap());
}

#[tokio::test]
async fn test_create_strategy() {
    let (server, _) = create_test_server().await;
    let token = register_and_login_user(&server).await;
    
    let strategy_body = json!({
        "name": "Test Strategy",
        "description": "A test trading strategy",
        "max_trades_per_day": 10,
        "risk_percentage": 2.0,
        "stop_loss_percentage": 1.5,
        "take_profit_percentage": 3.0,
        "volume_threshold": 1000
    });
    
    let (status, response) = make_authenticated_request(
        &server, 
        Method::POST, 
        "/api/strategies", 
        &token, 
        Some(strategy_body)
    ).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
    assert_eq!(response["data"]["name"], "Test Strategy");
    assert_eq!(response["data"]["max_trades_per_day"], 10);
}

#[tokio::test]
async fn test_get_strategies() {
    let (server, _) = create_test_server().await;
    let token = register_and_login_user(&server).await;
    
    let (status, response) = make_authenticated_request(&server, Method::GET, "/api/strategies", &token, None).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
    assert!(response["data"].is_array());
}

#[tokio::test]
async fn test_start_stop_trading() {
    let (server, _) = create_test_server().await;
    let token = register_and_login_user(&server).await;
    
    // Start trading
    let (status, response) = make_authenticated_request(&server, Method::POST, "/api/trading/start", &token, None).await;
    
    // Note: This might fail due to missing API credentials, but we test the endpoint structure
    assert!(status == StatusCode::OK || status == StatusCode::BAD_REQUEST);
    assert!(response["success"].is_boolean());
    
    // Stop trading
    let (status, response) = make_authenticated_request(&server, Method::POST, "/api/trading/stop", &token, None).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
}

#[tokio::test]
async fn test_emergency_stop() {
    let (server, _) = create_test_server().await;
    let token = register_and_login_user(&server).await;
    
    let (status, response) = make_authenticated_request(&server, Method::POST, "/api/trading/emergency-stop", &token, None).await;
    
    assert_eq!(status, StatusCode::OK);
    assert!(response["success"].as_bool().unwrap());
}