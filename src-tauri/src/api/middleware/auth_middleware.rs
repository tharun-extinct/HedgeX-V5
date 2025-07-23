use crate::error::{ApiResult, HedgeXError};
use crate::services::auth_service::AuthService;
use axum::{
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use std::sync::Arc;
use tracing::{error, info};

/// Authentication middleware for protecting routes
pub async fn auth_middleware<B>(
    State(auth_service): State<Arc<AuthService>>,
    request: Request<B>,
    next: Next<B>,
) -> Response {
    // Extract token from Authorization header
    let auth_header = request.headers().get("Authorization");
    
    let token = match auth_header {
        Some(header) => {
            let auth_str = match header.to_str() {
                Ok(s) => s,
                Err(_) => {
                    return (
                        StatusCode::UNAUTHORIZED,
                        Json(ApiResult::<String>::error(
                            "Invalid Authorization header".to_string(),
                            Some("AUTH_ERROR".to_string()),
                        )),
                    )
                        .into_response();
                }
            };

            if !auth_str.starts_with("Bearer ") {
                return (
                    StatusCode::UNAUTHORIZED,
                    Json(ApiResult::<String>::error(
                        "Invalid Authorization format, expected Bearer token".to_string(),
                        Some("AUTH_ERROR".to_string()),
                    )),
                )
                    .into_response();
            }

            &auth_str[7..]
        }
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(ApiResult::<String>::error(
                    "Missing Authorization header".to_string(),
                    Some("AUTH_ERROR".to_string()),
                )),
            )
                .into_response();
        }
    };

    // Validate session
    match auth_service.validate_session(token).await {
        Ok(user_id) => {
            // Add user_id to request extensions
            let mut request = request;
            request.extensions_mut().insert(user_id);
            
            // Continue to the handler
            next.run(request).await
        }
        Err(err) => {
            error!("Authentication failed: {}", err);
            
            let status = match err {
                HedgeXError::SessionError => StatusCode::UNAUTHORIZED,
                _ => StatusCode::INTERNAL_SERVER_ERROR,
            };
            
            (status, Json(ApiResult::<String>::from_error(err))).into_response()
        }
    }
}

/// Extract authenticated user ID from request extensions
pub fn extract_user_id<B>(request: &Request<B>) -> Result<String, Response> {
    request
        .extensions()
        .get::<String>()
        .cloned()
        .ok_or_else(|| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiResult::<String>::error(
                    "User ID not found in request".to_string(),
                    Some("INTERNAL_ERROR".to_string()),
                )),
            )
                .into_response()
        })
}