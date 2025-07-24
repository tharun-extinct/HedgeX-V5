use crate::api::http_server::{create_server, HttpServerState};
use crate::services::AppService;
use axum::http::StatusCode;
use std::sync::Arc;
use tempfile::TempDir;
use tokio::net::TcpListener;
use tower::ServiceExt;

/// Integration test helper for HTTP server
pub struct HttpServerTestHelper {
    pub app_service: Arc<AppService>,
    pub server_state: HttpServerState,
    pub temp_dir: TempDir,
}

impl HttpServerTestHelper {
    /// Create a new test helper with temporary database
    pub async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let temp_dir = TempDir::new()?;
        let app_service = Arc::new(AppService::new(temp_dir.path()).await?);
        let server_state = HttpServerState::new(Arc::clone(&app_service));
        
        Ok(Self {
            app_service,
            server_state,
            temp_dir,
        })
    }
    
    /// Create the HTTP server router
    pub fn create_router(&self) -> axum::Router {
        create_server(self.server_state.clone())
    }
    
    /// Start the server on a random port for testing
    pub async fn start_server(&self) -> Result<String, Box<dyn std::error::Error>> {
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let addr = listener.local_addr()?;
        let app = self.create_router();
        
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        
        Ok(format!("http://{}", addr))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, Method},
    };
    use serde_json::json;
    use tower::ServiceExt;

    #[tokio::test]
    async fn test_health_check_endpoint() {
        let helper = HttpServerTestHelper::new().await.unwrap();
        let app = helper.create_router();

        let request = Request::builder()
            .method(Method::GET)
            .uri("/api/health")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_register_endpoint() {
        let helper = HttpServerTestHelper::new().await.unwrap();
        let app = helper.create_router();

        let register_data = json!({
            "username": "testuser",
            "password": "testpassword"
        });

        let request = Request::builder()
            .method(Method::POST)
            .uri("/api/auth/register")
            .header("content-type", "application/json")
            .body(Body::from(register_data.to_string()))
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_login_endpoint() {
        let helper = HttpServerTestHelper::new().await.unwrap();
        let app = helper.create_router();

        // First register a user
        let register_data = json!({
            "username": "testuser",
            "password": "testpassword"
        });

        let register_request = Request::builder()
            .method(Method::POST)
            .uri("/api/auth/register")
            .header("content-type", "application/json")
            .body(Body::from(register_data.to_string()))
            .unwrap();

        let _register_response = app.clone().oneshot(register_request).await.unwrap();

        // Then try to login
        let login_data = json!({
            "username": "testuser",
            "password": "testpassword"
        });

        let login_request = Request::builder()
            .method(Method::POST)
            .uri("/api/auth/login")
            .header("content-type", "application/json")
            .body(Body::from(login_data.to_string()))
            .unwrap();

        let response = app.oneshot(login_request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_nifty_50_stocks_endpoint() {
        let helper = HttpServerTestHelper::new().await.unwrap();
        let app = helper.create_router();

        let request = Request::builder()
            .method(Method::GET)
            .uri("/api/stocks/nifty50")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_market_data_endpoint() {
        let helper = HttpServerTestHelper::new().await.unwrap();
        let app = helper.create_router();

        let request = Request::builder()
            .method(Method::GET)
            .uri("/api/market/data")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_protected_endpoint_without_auth() {
        let helper = HttpServerTestHelper::new().await.unwrap();
        let app = helper.create_router();

        let request = Request::builder()
            .method(Method::GET)
            .uri("/api/auth/profile")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }
}