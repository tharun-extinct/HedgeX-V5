use thiserror::Error;
use sqlx::Error as SqlxError;
use reqwest::Error as ReqwestError;
use serde_json::Error as SerdeError;
use std::io::Error as IoError;
use std::fmt::{self, Display, Formatter};
use std::error::Error as StdError;
use tokio::sync::oneshot::error::RecvError;
use tokio::task::JoinError;
use tokio::time::error::Elapsed;
use tracing::{error, warn, info, debug};
use std::backtrace::Backtrace;

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
    
    #[error("I/O error: {0}")]
    IoError(#[from] IoError),
    
    #[error("Task join error: {0}")]
    TaskJoinError(#[from] JoinError),
    
    #[error("Timeout error: {0}")]
    TimeoutError(String),
    
    #[error("Channel receive error: {0}")]
    ChannelRecvError(#[from] RecvError),
    
    #[error("Operation timed out")]
    OperationTimedOut(#[from] Elapsed),
    
    #[error("Concurrency error: {0}")]
    ConcurrencyError(String),
    
    #[error("Data integrity error: {0}")]
    DataIntegrityError(String),
    
    #[error("External service error: {0}")]
    ExternalServiceError(String),
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
        debug!("Creating successful API result");
        Self {
            success: true,
            data: Some(data),
            error: None,
            error_code: None,
        }
    }
    
    /// Create an error result
    pub fn error(error: String, error_code: Option<String>) -> Self {
        warn!("API error: {} (code: {:?})", error, error_code);
        Self {
            success: false,
            data: None,
            error: Some(error),
            error_code,
        }
    }
    
    /// Create an error result from HedgeXError
    pub fn from_error(err: HedgeXError) -> Self {
        // Capture backtrace for debugging
        let backtrace = Backtrace::capture();
        
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
            HedgeXError::IoError(_) => Some("IO_ERROR".to_string()),
            HedgeXError::TaskJoinError(_) => Some("TASK_JOIN_ERROR".to_string()),
            HedgeXError::TimeoutError(_) => Some("TIMEOUT_ERROR".to_string()),
            HedgeXError::ChannelRecvError(_) => Some("CHANNEL_RECV_ERROR".to_string()),
            HedgeXError::OperationTimedOut(_) => Some("OPERATION_TIMEOUT_ERROR".to_string()),
            HedgeXError::ConcurrencyError(_) => Some("CONCURRENCY_ERROR".to_string()),
            HedgeXError::DataIntegrityError(_) => Some("DATA_INTEGRITY_ERROR".to_string()),
            HedgeXError::ExternalServiceError(_) => Some("EXTERNAL_SERVICE_ERROR".to_string()),
        };
        
        // Log the error with backtrace for debugging
        error!("HedgeX error: {} (code: {:?})\nBacktrace: {:?}", err, error_code, backtrace);
        
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
    (auth, $msg:expr) => {{
        tracing::error!("Authentication error: {}", $msg);
        $crate::error::HedgeXError::AuthenticationError($msg.to_string())
    }};
    (trading, $msg:expr) => {{
        tracing::error!("Trading error: {}", $msg);
        $crate::error::HedgeXError::TradingError($msg.to_string())
    }};
    (api, $msg:expr) => {{
        tracing::error!("API error: {}", $msg);
        $crate::error::HedgeXError::ApiError($msg.to_string())
    }};
    (websocket, $msg:expr) => {{
        tracing::error!("WebSocket error: {}", $msg);
        $crate::error::HedgeXError::WebSocketError($msg.to_string())
    }};
    (crypto, $msg:expr) => {{
        tracing::error!("Crypto error: {}", $msg);
        $crate::error::HedgeXError::CryptoError($msg.to_string())
    }};
    (config, $msg:expr) => {{
        tracing::error!("Config error: {}", $msg);
        $crate::error::HedgeXError::ConfigError($msg.to_string())
    }};
    (validation, $msg:expr) => {{
        tracing::error!("Validation error: {}", $msg);
        $crate::error::HedgeXError::ValidationError($msg.to_string())
    }};
    (rate_limit, $msg:expr) => {{
        tracing::error!("Rate limit error: {}", $msg);
        $crate::error::HedgeXError::RateLimitError($msg.to_string())
    }};
    (permission, $msg:expr) => {{
        tracing::error!("Permission error: {}", $msg);
        $crate::error::HedgeXError::PermissionError($msg.to_string())
    }};
    (not_found, $msg:expr) => {{
        tracing::error!("Not found error: {}", $msg);
        $crate::error::HedgeXError::NotFoundError($msg.to_string())
    }};
    (internal, $msg:expr) => {{
        tracing::error!("Internal error: {}", $msg);
        $crate::error::HedgeXError::InternalError($msg.to_string())
    }};
    (timeout, $msg:expr) => {{
        tracing::error!("Timeout error: {}", $msg);
        $crate::error::HedgeXError::TimeoutError($msg.to_string())
    }};
    (concurrency, $msg:expr) => {{
        tracing::error!("Concurrency error: {}", $msg);
        $crate::error::HedgeXError::ConcurrencyError($msg.to_string())
    }};
    (data_integrity, $msg:expr) => {{
        tracing::error!("Data integrity error: {}", $msg);
        $crate::error::HedgeXError::DataIntegrityError($msg.to_string())
    }};
    (external_service, $msg:expr) => {{
        tracing::error!("External service error: {}", $msg);
        $crate::error::HedgeXError::ExternalServiceError($msg.to_string())
    }};
}

/// Extension trait for Result with additional utility methods
pub trait ResultExt<T, E> {
    /// Add context to an error
    fn with_context<C, F>(self, context: F) -> std::result::Result<T, HedgeXError>
    where
        F: FnOnce() -> C,
        C: Display + Send + Sync + 'static;
        
    /// Convert to HedgeXError with a custom message
    fn with_error_msg<M>(self, msg: M) -> std::result::Result<T, HedgeXError>
    where
        M: Display + Send + Sync + 'static;
        
    /// Log error with a custom message and return the result
    fn log_error<M>(self, msg: M) -> std::result::Result<T, E>
    where
        M: Display + Send + Sync + 'static,
        E: StdError;
}

impl<T, E> ResultExt<T, E> for std::result::Result<T, E>
where
    E: StdError + Send + Sync + 'static,
{
    fn with_context<C, F>(self, context: F) -> std::result::Result<T, HedgeXError>
    where
        F: FnOnce() -> C,
        C: Display + Send + Sync + 'static,
    {
        self.map_err(|e| {
            let ctx = context();
            error!("{}: {}", ctx, e);
            HedgeXError::InternalError(format!("{}: {}", ctx, e))
        })
    }
    
    fn with_error_msg<M>(self, msg: M) -> std::result::Result<T, HedgeXError>
    where
        M: Display + Send + Sync + 'static,
    {
        self.map_err(|e| {
            let message = msg.to_string();
            error!("{}: {}", message, e);
            HedgeXError::InternalError(message)
        })
    }
    
    fn log_error<M>(self, msg: M) -> std::result::Result<T, E>
    where
        M: Display + Send + Sync + 'static,
    {
        if let Err(ref e) = self {
            error!("{}: {}", msg, e);
        }
        self
    }
}