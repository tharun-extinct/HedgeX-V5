use crate::error::{ApiResult, HedgeXError, Result};
use crate::services::auth_service::{
    ApiCredentialsRequest, AuthService, LoginRequest, RegisterRequest, SessionToken, UserInfo
};
use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tracing::{debug, error, info};

/// Authentication API handler
pub struct AuthApiHandler {
    auth_service: Arc<AuthService>,
}

impl AuthApiHandler {
    /// Create a new authentication API handler
    pub fn new(auth_service: Arc<AuthService>) -> Self {
        Self { auth_service }
    }

    /// Create authentication API routes
    pub fn routes(&self) -> Router {
        let auth_service = Arc::clone(&self.auth_service);
        
        Router::new()
            .route("/register", post(Self::register))
            .route("/login", post(Self::login))
            .route("/logout", post(Self::logout))
            .route("/validate", post(Self::validate_session))
            .route("/user/:user_id", get(Self::get_user_info))
            .route("/api-credentials", post(Self::store_api_credentials))
            .route("/api-credentials/:user_id", get(Self::get_api_credentials))
            .with_state(auth_service)
    }

    /// Register a new user
    async fn register(
        State(auth_service): State<Arc<AuthService>>,
        Json(request): Json<RegisterRequest>,
    ) -> impl IntoResponse {
        info!("API: Register user request received");
        
        match auth_service.register(request).await {
            Ok(user_info) => {
                info!("API: User registered successfully");
                (StatusCode::CREATED, Json(ApiResult::success(user_info)))
            }
            Err(err) => {
                error!("API: User registration failed: {}", err);
                (StatusCode::BAD_REQUEST, Json(ApiResult::<UserInfo>::from_error(err)))
            }
        }
    }

    /// Login user
    async fn login(
        State(auth_service): State<Arc<AuthService>>,
        Json(request): Json<LoginRequest>,
    ) -> impl IntoResponse {
        info!("API: Login request received");
        
        match auth_service.login(request).await {
            Ok(session) => {
                info!("API: Login successful");
                (StatusCode::OK, Json(ApiResult::success(session)))
            }
            Err(err) => {
                error!("API: Login failed: {}", err);
                (StatusCode::UNAUTHORIZED, Json(ApiResult::<SessionToken>::from_error(err)))
            }
        }
    }

    /// Logout user
    async fn logout(
        State(auth_service): State<Arc<AuthService>>,
        Json(token): Json<String>,
    ) -> impl IntoResponse {
        info!("API: Logout request received");
        
        match auth_service.logout(&token).await {
            Ok(_) => {
                info!("API: Logout successful");
                (StatusCode::OK, Json(ApiResult::success("Logged out successfully")))
            }
            Err(err) => {
                error!("API: Logout failed: {}", err);
                (StatusCode::BAD_REQUEST, Json(ApiResult::<String>::from_error(err)))
            }
        }
    }

    /// Validate session token
    async fn validate_session(
        State(auth_service): State<Arc<AuthService>>,
        Json(token): Json<String>,
    ) -> impl IntoResponse {
        debug!("API: Validate session request received");
        
        match auth_service.validate_session(&token).await {
            Ok(user_id) => {
                debug!("API: Session validation successful");
                (StatusCode::OK, Json(ApiResult::success(user_id)))
            }
            Err(err) => {
                debug!("API: Session validation failed: {}", err);
                (StatusCode::UNAUTHORIZED, Json(ApiResult::<String>::from_error(err)))
            }
        }
    }

    /// Get user information
    async fn get_user_info(
        State(auth_service): State<Arc<AuthService>>,
        Path(user_id): Path<String>,
    ) -> impl IntoResponse {
        info!("API: Get user info request received for user: {}", user_id);
        
        match auth_service.get_user_info(&user_id).await {
            Ok(user_info) => {
                info!("API: User info retrieved successfully");
                (StatusCode::OK, Json(ApiResult::success(user_info)))
            }
            Err(err) => {
                error!("API: Get user info failed: {}", err);
                (StatusCode::NOT_FOUND, Json(ApiResult::<UserInfo>::from_error(err)))
            }
        }
    }

    /// Store API credentials
    async fn store_api_credentials(
        State(auth_service): State<Arc<AuthService>>,
        Json(request): Json<(String, ApiCredentialsRequest)>,
    ) -> impl IntoResponse {
        let (user_id, credentials) = request;
        info!("API: Store API credentials request received for user: {}", user_id);
        
        match auth_service.store_api_credentials(&user_id, credentials).await {
            Ok(_) => {
                info!("API: API credentials stored successfully");
                (StatusCode::OK, Json(ApiResult::success("API credentials stored successfully")))
            }
            Err(err) => {
                error!("API: Store API credentials failed: {}", err);
                (StatusCode::BAD_REQUEST, Json(ApiResult::<String>::from_error(err)))
            }
        }
    }

    /// Get API credentials
    async fn get_api_credentials(
        State(auth_service): State<Arc<AuthService>>,
        Path(user_id): Path<String>,
    ) -> impl IntoResponse {
        info!("API: Get API credentials request received for user: {}", user_id);
        
        match auth_service.get_api_credentials(&user_id).await {
            Ok(credentials) => {
                info!("API: API credentials retrieved successfully");
                (StatusCode::OK, Json(ApiResult::success(credentials)))
            }
            Err(err) => {
                error!("API: Get API credentials failed: {}", err);
                (StatusCode::NOT_FOUND, Json(ApiResult::<String>::from_error(err)))
            }
        }
    }
}

/// Authentication middleware for protected routes
pub async fn auth_middleware(
    auth_service: Arc<AuthService>,
    token: &str,
) -> Result<String> {
    auth_service.validate_session(token).await
}