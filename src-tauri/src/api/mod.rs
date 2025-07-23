pub mod auth_api;
pub mod middleware;

use crate::services::auth_service::AuthService;
use axum::{
    middleware,
    routing::get,
    Router,
};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

/// Create API router with all routes
pub fn create_api_router(auth_service: Arc<AuthService>) -> Router {
    // Create CORS layer
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Create auth API handler
    let auth_api = auth_api::AuthApiHandler::new(Arc::clone(&auth_service));

    // Create protected routes
    let protected_routes = Router::new()
        .route("/health", get(|| async { "OK" }))
        .layer(middleware::from_fn_with_state(
            Arc::clone(&auth_service),
            middleware::auth_middleware,
        ));

    // Combine all routes
    Router::new()
        .nest("/auth", auth_api.routes())
        .merge(protected_routes)
        .layer(cors)
}