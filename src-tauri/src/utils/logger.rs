use crate::models::{SystemLog, LogLevel};
use crate::db::Database;
use crate::error::{HedgeXError, Result};
use chrono::Utc;
use uuid::Uuid;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, info, warn, error, span, Level, Instrument};
use serde_json::Value;
use std::collections::HashMap;

/// Enhanced logger with structured logging and tracing integration
pub struct Logger {
    db: Arc<Mutex<Database>>,
    user_id: Option<String>,
    component: String,
}

impl Logger {
    pub fn new(db: Arc<Mutex<Database>>, user_id: Option<String>) -> Self {
        Self { 
            db, 
            user_id,
            component: "system".to_string(),
        }
    }
    
    pub fn with_component(db: Arc<Mutex<Database>>, user_id: Option<String>, component: String) -> Self {
        Self { db, user_id, component }
    }
    
    pub async fn set_user_id(&mut self, user_id: String) {
        self.user_id = Some(user_id);
    }
    
    pub async fn clear_user_id(&mut self) {
        self.user_id = None;
    }
    
    /// Log with structured data
    pub async fn log_structured(
        &self, 
        level: LogLevel, 
        message: &str, 
        context: Option<&str>,
        structured_data: Option<HashMap<String, Value>>
    ) -> Result<()> {
        let log_id = Uuid::new_v4().to_string();
        let timestamp = Utc::now();
        
        // Create tracing span for structured logging
        let span = span!(
            Level::INFO,
            "hedgex_log",
            log_id = %log_id,
            user_id = %self.user_id.as_deref().unwrap_or("anonymous"),
            component = %self.component,
            level = %format!("{:?}", level)
        );
        
        async move {
            // Log to tracing with structured data
            match level {
                LogLevel::Debug => {
                    debug!(
                        message = %message,
                        context = %context.unwrap_or(""),
                        ?structured_data,
                        "Debug log entry"
                    );
                },
                LogLevel::Info => {
                    info!(
                        message = %message,
                        context = %context.unwrap_or(""),
                        ?structured_data,
                        "Info log entry"
                    );
                },
                LogLevel::Warning => {
                    warn!(
                        message = %message,
                        context = %context.unwrap_or(""),
                        ?structured_data,
                        "Warning log entry"
                    );
                },
                LogLevel::Error => {
                    error!(
                        message = %message,
                        context = %context.unwrap_or(""),
                        ?structured_data,
                        "Error log entry"
                    );
                },
                LogLevel::Critical => {
                    error!(
                        message = %message,
                        context = %context.unwrap_or(""),
                        ?structured_data,
                        "Critical log entry"
                    );
                },
            }
            
            // Create log entry for database
            let log = SystemLog {
                id: log_id,
                user_id: self.user_id.clone(),
                log_level: level,
                message: message.to_string(),
                created_at: timestamp,
                context: context.map(|s| s.to_string()),
            };
            
            // Save to database
            let db = self.db.lock().await;
            let pool = db.get_pool();
            
            let level_int = match log.log_level {
                LogLevel::Debug => 0,
                LogLevel::Info => 1,
                LogLevel::Warning => 2,
                LogLevel::Error => 3,
                LogLevel::Critical => 4,
            };
            
            sqlx::query(
                r#"
                INSERT INTO system_logs (id, user_id, log_level, message, created_at, context)
                VALUES (?, ?, ?, ?, ?, ?)
                "#
            )
            .bind(&log.id)
            .bind(&log.user_id)
            .bind(level_int)
            .bind(&log.message)
            .bind(&log.created_at)
            .bind(&log.context)
            .execute(pool)
            .await
            .map_err(|e| HedgeXError::DatabaseError(e))?;
            
            Ok::<(), HedgeXError>(())
        }
        .instrument(span)
        .await
    }
    
    pub async fn log(&self, level: LogLevel, message: &str, context: Option<&str>) -> Result<()> {
        self.log_structured(level, message, context, None).await
    }
    
    pub async fn debug(&self, message: &str, context: Option<&str>) -> Result<()> {
        self.log(LogLevel::Debug, message, context).await
    }
    
    pub async fn debug_structured(&self, message: &str, context: Option<&str>, data: HashMap<String, Value>) -> Result<()> {
        self.log_structured(LogLevel::Debug, message, context, Some(data)).await
    }
    
    pub async fn info(&self, message: &str, context: Option<&str>) -> Result<()> {
        self.log(LogLevel::Info, message, context).await
    }
    
    pub async fn info_structured(&self, message: &str, context: Option<&str>, data: HashMap<String, Value>) -> Result<()> {
        self.log_structured(LogLevel::Info, message, context, Some(data)).await
    }
    
    pub async fn warning(&self, message: &str, context: Option<&str>) -> Result<()> {
        self.log(LogLevel::Warning, message, context).await
    }
    
    pub async fn warning_structured(&self, message: &str, context: Option<&str>, data: HashMap<String, Value>) -> Result<()> {
        self.log_structured(LogLevel::Warning, message, context, Some(data)).await
    }
    
    pub async fn error(&self, message: &str, context: Option<&str>) -> Result<()> {
        self.log(LogLevel::Error, message, context).await
    }
    
    pub async fn error_structured(&self, message: &str, context: Option<&str>, data: HashMap<String, Value>) -> Result<()> {
        self.log_structured(LogLevel::Error, message, context, Some(data)).await
    }
    
    pub async fn critical(&self, message: &str, context: Option<&str>) -> Result<()> {
        self.log(LogLevel::Critical, message, context).await
    }
    
    pub async fn critical_structured(&self, message: &str, context: Option<&str>, data: HashMap<String, Value>) -> Result<()> {
        self.log_structured(LogLevel::Critical, message, context, Some(data)).await
    }
    
    /// Log trading activity with structured data
    pub async fn log_trading_activity(
        &self,
        action: &str,
        symbol: Option<&str>,
        quantity: Option<i32>,
        price: Option<f64>,
        additional_data: Option<HashMap<String, Value>>
    ) -> Result<()> {
        let mut data = HashMap::new();
        data.insert("action".to_string(), Value::String(action.to_string()));
        
        if let Some(s) = symbol {
            data.insert("symbol".to_string(), Value::String(s.to_string()));
        }
        if let Some(q) = quantity {
            data.insert("quantity".to_string(), Value::Number(q.into()));
        }
        if let Some(p) = price {
            data.insert("price".to_string(), Value::Number(serde_json::Number::from_f64(p).unwrap_or_else(|| serde_json::Number::from(0))));
        }
        
        if let Some(additional) = additional_data {
            data.extend(additional);
        }
        
        self.log_structured(
            LogLevel::Info,
            &format!("Trading activity: {}", action),
            Some("trading"),
            Some(data)
        ).await
    }
    
    /// Log API activity with structured data
    pub async fn log_api_activity(
        &self,
        endpoint: &str,
        method: &str,
        status_code: Option<u16>,
        response_time_ms: Option<u64>,
        error: Option<&str>
    ) -> Result<()> {
        let mut data = HashMap::new();
        data.insert("endpoint".to_string(), Value::String(endpoint.to_string()));
        data.insert("method".to_string(), Value::String(method.to_string()));
        
        if let Some(code) = status_code {
            data.insert("status_code".to_string(), Value::Number(code.into()));
        }
        if let Some(time) = response_time_ms {
            data.insert("response_time_ms".to_string(), Value::Number(time.into()));
        }
        if let Some(err) = error {
            data.insert("error".to_string(), Value::String(err.to_string()));
        }
        
        let level = if error.is_some() { LogLevel::Error } else { LogLevel::Info };
        let message = if let Some(err) = error {
            format!("API call failed: {} {}: {}", method, endpoint, err)
        } else {
            format!("API call: {} {}", method, endpoint)
        };
        
        self.log_structured(level, &message, Some("api"), Some(data)).await
    }
    
    /// Get recent logs from database
    pub async fn get_recent_logs(&self, limit: i32, level_filter: Option<LogLevel>) -> Result<Vec<SystemLog>> {
        let db = self.db.lock().await;
        let pool = db.get_pool();
        
        let query = if let Some(level) = level_filter {
            let level_int = match level {
                LogLevel::Debug => 0,
                LogLevel::Info => 1,
                LogLevel::Warning => 2,
                LogLevel::Error => 3,
                LogLevel::Critical => 4,
            };
            
            sqlx::query_as::<_, SystemLog>(
                r#"
                SELECT id, user_id, log_level, message, created_at, context
                FROM system_logs 
                WHERE log_level >= ? 
                ORDER BY created_at DESC 
                LIMIT ?
                "#
            )
            .bind(level_int)
            .bind(limit)
        } else {
            sqlx::query_as::<_, SystemLog>(
                r#"
                SELECT id, user_id, log_level, message, created_at, context
                FROM system_logs 
                ORDER BY created_at DESC 
                LIMIT ?
                "#
            )
            .bind(limit)
        };
        
        let logs = query.fetch_all(pool).await
            .map_err(|e| HedgeXError::DatabaseError(e))?;
        
        Ok(logs)
    }
}
