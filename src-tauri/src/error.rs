use thiserror::Error;
use sqlx::Error as SqlxError;
use reqwest::Error as ReqwestError;
use serde_json::Error as SerdeError;

/// Main error type for HedgeX application
#[derive(Debug, Error)]
pub enum HedgeXError {
    #[error("Authentication failed: {0}")]
    AuthenticationError(String),
    
    #[error("Trading engine error: {0}")]
    TradingError(String),
    
    #[error("API communication error: {0}")]
    ApiError(String),
    
    #[error("Database error: {0}")]
    DatabaseError(#[from] SqlxError),
    
    #[error("WebSocket error: {0}")]
    WebSocketError(String),
    
    #[error("Encryption error: {0}")]
    CryptoError(String),
    
    #[error("Configuration error: {0}")]
    ConfigError(String),
    
    #[error("Network error: {0}")]
    NetworkError(#[from] ReqwestError),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] SerdeError),
    
    #[error("Validation error: {0}")]
    ValidationError(String),
    
    #[error("Rate limit exceeded: {0}")]
    RateLimitError(String),
    
    #[error("Session expired or invalid")]
    SessionError,
    
    #[error("Insufficient permissions: {0}")]
    PermissionError(String),
    
    #[error("Resource not found: {0}")]
    NotFoundError(String),
    
    #[error("Internal server error: {0}")]
    InternalError(String),
}

/// Result type alias for HedgeX operations
pub type Result<T> = std::result::Result<T, HedgeXError>;

/// Result wrapper for consistent error handling across the application
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ApiResult<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
    pub error_code: Option<String>,
}

impl<T> ApiResult<T> {
    /// Create a successful result
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            error_code: None,
        }
    }
    
    /// Create an error result
    pub fn error(error: String, error_code: Option<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
            error_code,
        }
    }
    
    /// Create an error result from HedgeXError
    pub fn from_error(err: HedgeXError) -> Self {
        let error_code = match &err {
            HedgeXError::AuthenticationError(_) => Some("AUTH_ERROR".to_string()),
            HedgeXError::TradingError(_) => Some("TRADING_ERROR".to_string()),
            HedgeXError::ApiError(_) => Some("API_ERROR".to_string()),
            HedgeXError::DatabaseError(_) => Some("DATABASE_ERROR".to_string()),
            HedgeXError::WebSocketError(_) => Some("WEBSOCKET_ERROR".to_string()),
            HedgeXError::CryptoError(_) => Some("CRYPTO_ERROR".to_string()),
            HedgeXError::ConfigError(_) => Some("CONFIG_ERROR".to_string()),
            HedgeXError::NetworkError(_) => Some("NETWORK_ERROR".to_string()),
            HedgeXError::SerializationError(_) => Some("SERIALIZATION_ERROR".to_string()),
            HedgeXError::ValidationError(_) => Some("VALIDATION_ERROR".to_string()),
            HedgeXError::RateLimitError(_) => Some("RATE_LIMIT_ERROR".to_string()),
            HedgeXError::SessionError => Some("SESSION_ERROR".to_string()),
            HedgeXError::PermissionError(_) => Some("PERMISSION_ERROR".to_string()),
            HedgeXError::NotFoundError(_) => Some("NOT_FOUND_ERROR".to_string()),
            HedgeXError::InternalError(_) => Some("INTERNAL_ERROR".to_string()),
        };
        
        Self {
            success: false,
            data: None,
            error: Some(err.to_string()),
            error_code,
        }
    }
}

impl<T> From<HedgeXError> for ApiResult<T> {
    fn from(err: HedgeXError) -> Self {
        ApiResult::from_error(err)
    }
}

/// Trait for converting results to API results
pub trait IntoApiResult<T> {
    fn into_api_result(self) -> ApiResult<T>;
}

impl<T> IntoApiResult<T> for Result<T> {
    fn into_api_result(self) -> ApiResult<T> {
        match self {
            Ok(data) => ApiResult::success(data),
            Err(err) => ApiResult::from_error(err),
        }
    }
}

/// Macro for creating HedgeXError variants easily
#[macro_export]
macro_rules! hedgex_error {
    (auth, $msg:expr) => {
        $crate::error::HedgeXError::AuthenticationError($msg.to_string())
    };
    (trading, $msg:expr) => {
        $crate::error::HedgeXError::TradingError($msg.to_string())
    };
    (api, $msg:expr) => {
        $crate::error::HedgeXError::ApiError($msg.to_string())
    };
    (websocket, $msg:expr) => {
        $crate::error::HedgeXError::WebSocketError($msg.to_string())
    };
    (crypto, $msg:expr) => {
        $crate::error::HedgeXError::CryptoError($msg.to_string())
    };
    (config, $msg:expr) => {
        $crate::error::HedgeXError::ConfigError($msg.to_string())
    };
    (validation, $msg:expr) => {
        $crate::error::HedgeXError::ValidationError($msg.to_string())
    };
    (rate_limit, $msg:expr) => {
        $crate::error::HedgeXError::RateLimitError($msg.to_string())
    };
    (permission, $msg:expr) => {
        $crate::error::HedgeXError::PermissionError($msg.to_string())
    };
    (not_found, $msg:expr) => {
        $crate::error::HedgeXError::NotFoundError($msg.to_string())
    };
    (internal, $msg:expr) => {
        $crate::error::HedgeXError::InternalError($msg.to_string())
    };
}