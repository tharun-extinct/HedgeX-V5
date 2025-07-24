use crate::error::{ApiResult, HedgeXError, Result};
use crate::services::auth_service::AuthService;
use axum::{
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use std::sync::Arc;
use tracing::{debug, error};

/// Authentication middleware for protected routes
pub async fn auth_middleware(
    State(auth_service): State<Arc<AuthService>>,
    mut request: Request,
    next: Next,
) -> Response {
    // Extract token from Authorization header
    let token = match extract_token_from_header(&request) {
        Some(token) => token,
        None => {
            error!("Authentication failed: No token provided");
            return (
                StatusCode::UNAUTHORIZED,
                Json(ApiResult::<()>::from_error(HedgeXError::SessionError)),
            )
                .into_response();
        }
    };

    // Validate token
    match auth_service.validate_session(&token).await {
        Ok(user_id) => {
            debug!("Authentication successful for user: {}", user_id);
            
            // Add user_id to request extensions
            request.extensions_mut().insert(user_id);
            
            // Continue with the request
            next.run(request).await
        }
        Err(err) => {
            error!("Authentication failed: {}", err);
            (
                StatusCode::UNAUTHORIZED,
                Json(ApiResult::<()>::from_error(err)),
            )
                .into_response()
        }
    }
}

/// Extract token from Authorization header
fn extract_token_from_header<B>(request: &Request<B>) -> Option<String> {
    request
        .headers()
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

/// Extract user ID from request extensions
pub fn extract_user_id<B>(request: &Request<B>) -> Result<String> {
    request
        .extensions()
        .get::<String>()
        .cloned()
        .ok_or_else(|| HedgeXError::SessionError)
}