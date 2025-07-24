use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

/// Log level enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[repr(i32)]
pub enum LogLevel {
    Error = 1,
    Warn = 2,
    Info = 3,
    Debug = 4,
    Trace = 5,
}

impl From<i32> for LogLevel {
    fn from(value: i32) -> Self {
        match value {
            1 => LogLevel::Error,
            2 => LogLevel::Warn,
            3 => LogLevel::Info,
            4 => LogLevel::Debug,
            5 => LogLevel::Trace,
            _ => LogLevel::Info, // Default to Info for unknown values
        }
    }
}

impl From<LogLevel> for i32 {
    fn from(level: LogLevel) -> Self {
        level as i32
    }
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LogLevel::Error => write!(f, "ERROR"),
            LogLevel::Warn => write!(f, "WARN"),
            LogLevel::Info => write!(f, "INFO"),
            LogLevel::Debug => write!(f, "DEBUG"),
            LogLevel::Trace => write!(f, "TRACE"),
        }
    }
}

/// System log model
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SystemLog {
    pub id: String,
    pub user_id: Option<String>,
    pub log_level: i32,
    pub message: String,
    pub created_at: DateTime<Utc>,
    pub context: Option<String>,
}

impl SystemLog {
    /// Create a new system log entry
    pub fn new(
        id: String,
        user_id: Option<String>,
        log_level: LogLevel,
        message: String,
        context: Option<String>,
    ) -> Self {
        Self {
            id,
            user_id,
            log_level: log_level as i32,
            message,
            created_at: Utc::now(),
            context,
        }
    }
    
    /// Get the log level as enum
    pub fn get_log_level(&self) -> LogLevel {
        LogLevel::from(self.log_level)
    }
}