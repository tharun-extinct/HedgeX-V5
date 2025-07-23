use crate::error::{HedgeXError, Result, ApiResult, IntoApiResult};
use crate::models::{LoginRequest, RegisterRequest, ApiCredentialsRequest, PasswordChangeRequest};
use crate::services::AuthService;
use axum::{
    extract::{Json, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tracing::{debug, error, info, warn, span, Level, Instrument};

/// Create authentication routes
pub fn auth_routes(auth_service: Arc<AuthService>) -> Router {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/logout", post(logout))
        .route("/profile", get(get_profile))
        .route("/api-credentials", post(store_api_credentials))
        .route("/api-credentials", get(get_api_credentials))
        .route("/change-password", post(change_password))
        .with_state(auth_service)
}

/// Extract session token from headers
fn extract_token(headers: &HeaderMap) -> Result<String> {
    let auth_header = headers
        .get("Authorization")
        .ok_or_else(|| HedgeXError::AuthenticationError("Missing Authorization header".to_string()))?;
    
    let auth_str = auth_header
        .to_str()
        .map_err(|_| HedgeXError::AuthenticationError("Invalid Authorization header".to_string()))?;
    
    if !auth_str.starts_with("Bearer ") {
        return Err(HedgeXError::AuthenticationError("Invalid Authorization format".to_string()));
    }
    
    Ok(auth_str[7..].to_string())
}

/// Register a new user
async fn register(
    State(auth_service): State<Arc<AuthService>>,
    Json(request): Json<RegisterRequest>,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "register_endpoint");
    
    async move {
        info!("Register endpoint called");
        
        let result = auth_service.register(request).await;
        Json(result.into_api_result())
    }
    .instrument(span)
    .await
}

/// Login a user
async fn login(
    State(auth_service): State<Arc<AuthService>>,
    Json(request): Json<LoginRequest>,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "login_endpoint");
    
    async move {
        info!("Login endpoint called");
        
        let result = auth_service.login(request).await;
        Json(result.into_api_result())
    }
    .instrument(span)
    .await
}

/// Logout a user
async fn logout(
    State(auth_service): State<Arc<AuthService>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "logout_endpoint");
    
    async move {
        info!("Logout endpoint called");
        
        let token = match extract_token(&headers) {
            Ok(token) => token,
            Err(e) => return Json(ApiResult::<()>::from_error(e)),
        };
        
        let result = auth_service.logout(&token).await;
        Json(result.into_api_result())
    }
    .instrument(span)
    .await
}

/// Get user profile
async fn get_profile(
    State(auth_service): State<Arc<AuthService>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "get_profile_endpoint");
    
    async move {
        info!("Get profile endpoint called");
        
        let token = match extract_token(&headers) {
            Ok(token) => token,
            Err(e) => return Json(ApiResult::from_error(e)),
        };
        
        // Validate session
        let user_id = match auth_service.validate_session(&token).await {
            Ok(user_id) => user_id,
            Err(e) => return Json(ApiResult::from_error(e)),
        };
        
        // Get user profile
        let result = auth_service.get_user_profile(&user_id).await;
        Json(result.into_api_result())
    }
    .instrument(span)
    .await
}

/// Store API credentials
async fn store_api_credentials(
    State(auth_service): State<Arc<AuthService>>,
    headers: HeaderMap,
    Json(request): Json<ApiCredentialsRequest>,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "store_api_credentials_endpoint");
    
    async move {
        info!("Store API credentials endpoint called");
        
        let token = match extract_token(&headers) {
            Ok(token) => token,
            Err(e) => return Json(ApiResult::<()>::from_error(e)),
        };
        
        // Validate session
        let user_id = match auth_service.validate_session(&token).await {
            Ok(user_id) => user_id,
            Err(e) => return Json(ApiResult::<()>::from_error(e)),
        };
        
        // Store API credentials
        let result = auth_service.store_api_credentials(&user_id, request).await;
        Json(result.into_api_result())
    }
    .instrument(span)
    .await
}

/// Get API credentials
async fn get_api_credentials(
    State(auth_service): State<Arc<AuthService>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "get_api_credentials_endpoint");
    
    async move {
        info!("Get API credentials endpoint called");
        
        let token = match extract_token(&headers) {
            Ok(token) => token,
            Err(e) => return Json(ApiResult::from_error(e)),
        };
        
        // Validate session
        let user_id = match auth_service.validate_session(&token).await {
            Ok(user_id) => user_id,
            Err(e) => return Json(ApiResult::from_error(e)),
        };
        
        // Get API credentials
        let result = auth_service.get_api_credentials(&user_id).await;
        Json(result.into_api_result())
    }
    .instrument(span)
    .await
}

/// Change user password
async fn change_password(
    State(auth_service): State<Arc<AuthService>>,
    headers: HeaderMap,
    Json(request): Json<PasswordChangeRequest>,
) -> impl IntoResponse {
    let span = span!(Level::INFO, "change_password_endpoint");
    
    async move {
        info!("Change password endpoint called");
        
        // Validate password confirmation
        if request.new_password != request.confirm_password {
            return Json(ApiResult::<()>::from_error(
                HedgeXError::ValidationError("Passwords do not match".to_string())
            ));
        }
        
        let token = match extract_token(&headers) {
            Ok(token) => token,
            Err(e) => return Json(ApiResult::<()>::from_error(e)),
        };
        
        // Validate session
        let user_id = match auth_service.validate_session(&token).await {
            Ok(user_id) => user_id,
            Err(e) => return Json(ApiResult::<()>::from_error(e)),
        };
        
        // Change password
        let result = auth_service.change_password(&user_id, &request.current_password, &request.new_password).await;
        Json(result.into_api_result())
    }
    .instrument(span)
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{AuthResponse, UserProfile};
    use crate::utils::{EnhancedCryptoService, EnhancedLogger};
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use axum::routing::post;
    use axum::Router;
    use serde_json::{json, Value};
    use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};
    use std::path::Path;
    use tempfile::tempdir;
    use std::sync::Arc;
    use tokio::sync::Mutex;
    use tower::ServiceExt;

    async fn setup_test_db() -> Pool<Sqlite> {
        // Create in-memory database for testing
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect("sqlite::memory:")
            .await
            .expect("Failed to create in-memory database");

        // Run migrations
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )"
        )
        .execute(&pool)
        .await
        .expect("Failed to create users table");

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS api_credentials (
                user_id TEXT PRIMARY KEY,
                api_key TEXT NOT NULL,
                api_secret TEXT NOT NULL,
                access_token TEXT,
                access_token_expiry TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )"
        )
        .execute(&pool)
        .await
        .expect("Failed to create api_credentials table");

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS session_tokens (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_used TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN NOT NULL DEFAULT true,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )"
        )
        .execute(&pool)
        .await
        .expect("Failed to create session_tokens table");

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS system_logs (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                log_level INTEGER NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                context TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )"
        )
        .execute(&pool)
        .await
        .expect("Failed to create system_logs table");

        pool
    }

    async fn setup_auth_router() -> (Router, Pool<Sqlite>) {
        let pool = setup_test_db().await;
        let pool_arc = Arc::new(pool.clone());
        
        // Create temp directory for logger
        let temp_dir = tempdir().expect("Failed to create temp directory");
        let temp_path = temp_dir.path();
        
        // Setup crypto service
        let crypto_service = EnhancedCryptoService::new("test_master_password")
            .expect("Failed to create crypto service");
        let crypto_service = Arc::new(crypto_service);
        
        // Setup logger
        let logger = EnhancedLogger::new(
            Arc::new(Mutex::new(pool.clone())),
            None,
            temp_path
        )
        .await
        .expect("Failed to create logger");
        let logger = Arc::new(Mutex::new(logger));
        
        let auth_service = Arc::new(AuthService::new(
            pool_arc,
            crypto_service,
            logger
        ));
        
        let router = auth_routes(auth_service);
        
        (router, pool)
    }

    #[tokio::test]
    async fn test_register_endpoint() {
        let (app, _pool) = setup_auth_router().await;
        
        let request_body = json!({
            "username": "testuser",
            "password": "password123",
            "confirm_password": "password123"
        });
        
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/register")
                    .header("Content-Type", "application/json")
                    .body(Body::from(request_body.to_string()))
                    .unwrap()
            )
            .await
            .unwrap();
        
        assert_eq!(response.status(), StatusCode::OK);
        
        let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
        let response_json: Value = serde_json::from_slice(&body).unwrap();
        
        assert_eq!(response_json["success"], true);
        assert_eq!(response_json["data"]["username"], "testuser");
        assert!(response_json["data"]["token"].is_string());
    }

    #[tokio::test]
    async fn test_login_endpoint() {
        let (app, _pool) = setup_auth_router().await;
        
        // Register a user first
        let register_body = json!({
            "username": "logintest",
            "password": "password123",
            "confirm_password": "password123"
        });
        
        let _ = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/register")
                    .header("Content-Type", "application/json")
                    .body(Body::from(register_body.to_string()))
                    .unwrap()
            )
            .await
            .unwrap();
        
        // Now try to login
        let login_body = json!({
            "username": "logintest",
            "password": "password123"
        });
        
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/login")
                    .header("Content-Type", "application/json")
                    .body(Body::from(login_body.to_string()))
                    .unwrap()
            )
            .await
            .unwrap();
        
        assert_eq!(response.status(), StatusCode::OK);
        
        let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
        let response_json: Value = serde_json::from_slice(&body).unwrap();
        
        assert_eq!(response_json["success"], true);
        assert_eq!(response_json["data"]["username"], "logintest");
        assert!(response_json["data"]["token"].is_string());
    }

    #[tokio::test]
    async fn test_api_credentials_endpoints() {
        let (app, _pool) = setup_auth_router().await;
        
        // Register a user first
        let register_body = json!({
            "username": "apitest",
            "password": "password123",
            "confirm_password": "password123"
        });
        
        let register_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/register")
                    .header("Content-Type", "application/json")
                    .body(Body::from(register_body.to_string()))
                    .unwrap()
            )
            .await
            .unwrap();
        
        let register_body = hyper::body::to_bytes(register_response.into_body()).await.unwrap();
        let register_json: Value = serde_json::from_slice(&register_body).unwrap();
        let token = register_json["data"]["token"].as_str().unwrap();
        
        // Store API credentials
        let api_creds_body = json!({
            "api_key": "test_api_key",
            "api_secret": "test_api_secret"
        });
        
        let store_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api-credentials")
                    .header("Content-Type", "application/json")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::from(api_creds_body.to_string()))
                    .unwrap()
            )
            .await
            .unwrap();
        
        assert_eq!(store_response.status(), StatusCode::OK);
        
        // Get API credentials
        let get_response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/api-credentials")
                    .header("Authorization", format!("Bearer {}", token))
                    .body(Body::empty())
                    .unwrap()
            )
            .await
            .unwrap();
        
        assert_eq!(get_response.status(), StatusCode::OK);
        
        let get_body = hyper::body::to_bytes(get_response.into_body()).await.unwrap();
        let get_json: Value = serde_json::from_slice(&get_body).unwrap();
        
        assert_eq!(get_json["success"], true);
        assert_eq!(get_json["data"]["api_key"], "test_api_key");
        assert_eq!(get_json["data"]["api_secret"], "test_api_secret");
    }
}