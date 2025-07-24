use crate::error::{HedgeXError, Result, ResultExt};
use crate::models::{SystemLog, LogLevel};
use crate::db::Database;
use chrono::{Utc, DateTime};
use uuid::Uuid;
use std::sync::Arc;
use std::path::{Path, PathBuf};
use tokio::sync::Mutex;
use tracing::{debug, info, warn, error, span, Level, Instrument};
use tracing_subscriber::{
    fmt, 
    EnvFilter, 
    layer::SubscriberExt, 
    util::SubscriberInitExt,
    fmt::format::FmtSpan,
    fmt::time::ChronoUtc
};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use tokio::fs::create_dir_all;

/// Enhanced logger with structured logging, file rotation, and tracing integration
pub struct EnhancedLogger {
    db: Arc<Mutex<Database>>,
    user_id: Option<String>,
    component: String,
    log_dir: PathBuf,
    max_file_size: u64,
    max_files: usize,
    current_log_file: PathBuf,
}

impl EnhancedLogger {
    /// Create a new enhanced logger
    pub async fn new(
        db: Arc<Mutex<Database>>, 
        user_id: Option<String>,
        app_data_dir: &Path,
    ) -> Result<Self> {
        // Create log directory
        let log_dir = app_data_dir.join("logs");
        create_dir_all(&log_dir).await
            .with_context(|| format!("Failed to create log directory: {:?}", log_dir))?;
        
        let current_log_file = log_dir.join("hedgex.log");
        
        let logger = Self { 
            db, 
            user_id,
            component: "system".to_string(),
            log_dir,
            max_file_size: 10 * 1024 * 1024, // 10 MB
            max_files: 10,
            current_log_file,
        };
        
        // Initialize the logger
        logger.initialize_tracing()?;
        
        info!("EnhancedLogger initialized");
        Ok(logger)
    }
    
    /// Initialize tracing subscriber
    fn initialize_tracing(&self) -> Result<()> {
        let file_appender = tracing_appender::rolling::daily(&self.log_dir, "hedgex");
        let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);
        
        // Keep the guard alive by storing it in a static variable
        // This is safe because we only initialize tracing once
        static mut GUARD: Option<tracing_appender::non_blocking::WorkerGuard> = None;
        unsafe {
            GUARD = Some(_guard);
        }
        
        // Create a custom filter
        let filter = EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| EnvFilter::new("info,hedgex=debug,sqlx=warn"));
        
        // Set up the subscriber with console and file output
        tracing_subscriber::registry()
            .with(
                fmt::layer()
                    .with_writer(std::io::stdout)
                    .with_ansi(true)
                    .with_span_events(FmtSpan::CLOSE)
            )
            .with(
                fmt::layer()
                    .with_writer(non_blocking)
                    .with_ansi(false)
                    .with_span_events(FmtSpan::CLOSE)
                    .with_timer(ChronoUtc::rfc3339())
                    .json()
            )
            .with(filter)
            .init();
            
        info!("Tracing initialized successfully");
        Ok(())
    }
    
    /// Set the component name for this logger
    pub fn with_component(mut self, component: String) -> Self {
        self.component = component;
        self
    }
    
    /// Set the user ID
    pub async fn set_user_id(&mut self, user_id: String) {
        info!(user_id = %user_id, "User ID set");
        self.user_id = Some(user_id);
    }
    
    /// Clear the user ID
    pub async fn clear_user_id(&mut self) {
        if let Some(user_id) = &self.user_id {
            info!(user_id = %user_id, "User ID cleared");
        }
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
        .await?;
        
        // Check if log rotation is needed
        self.check_log_rotation().await?;
        
        Ok(())
    }
    
    /// Check if log rotation is needed and rotate if necessary
    async fn check_log_rotation(&self) -> Result<()> {
        // Check if the current log file exists
        if !self.current_log_file.exists() {
            return Ok(());
        }
        
        // Check the size of the current log file
        let metadata = fs::metadata(&self.current_log_file)
            .with_context(|| format!("Failed to get metadata for log file: {:?}", self.current_log_file))?;
            
        if metadata.len() >= self.max_file_size {
            self.rotate_logs().await?;
        }
        
        Ok(())
    }
    
    /// Rotate log files
    async fn rotate_logs(&self) -> Result<()> {
        debug!("Rotating log files");
        
        // Rename existing log files
        for i in (1..self.max_files).rev() {
            let src = self.log_dir.join(format!("hedgex.{}.log", i));
            let dst = self.log_dir.join(format!("hedgex.{}.log", i + 1));
            
            if src.exists() {
                fs::rename(&src, &dst)
                    .with_context(|| format!("Failed to rename log file from {:?} to {:?}", src, dst))?;
            }
        }
        
        // Rename current log file
        let backup = self.log_dir.join("hedgex.1.log");
        if self.current_log_file.exists() {
            fs::rename(&self.current_log_file, &backup)
                .with_context(|| format!("Failed to rename current log file to {:?}", backup))?;
        }
        
        // Create a new empty log file
        File::create(&self.current_log_file)
            .with_context(|| format!("Failed to create new log file: {:?}", self.current_log_file))?;
            
        info!("Log files rotated successfully");
        Ok(())
    }
    
    /// Simple log method
    pub async fn log(&self, level: LogLevel, message: &str, context: Option<&str>) -> Result<()> {
        self.log_structured(level, message, context, None).await
    }
    
    /// Debug level log
    pub async fn debug(&self, message: &str, context: Option<&str>) -> Result<()> {
        self.log(LogLevel::Debug, message, context).await
    }
    
    /// Debug level log with structured data
    pub async fn debug_structured(&self, message: &str, context: Option<&str>, data: HashMap<String, Value>) -> Result<()> {
        self.log_structured(LogLevel::Debug, message, context, Some(data)).await
    }
    
    /// Info level log
    pub async fn info(&self, message: &str, context: Option<&str>) -> Result<()> {
        self.log(LogLevel::Info, message, context).await
    }
    
    /// Info level log with structured data
    pub async fn info_structured(&self, message: &str, context: Option<&str>, data: HashMap<String, Value>) -> Result<()> {
        self.log_structured(LogLevel::Info, message, context, Some(data)).await
    }
    
    /// Warning level log
    pub async fn warning(&self, message: &str, context: Option<&str>) -> Result<()> {
        self.log(LogLevel::Warning, message, context).await
    }
    
    /// Warning level log with structured data
    pub async fn warning_structured(&self, message: &str, context: Option<&str>, data: HashMap<String, Value>) -> Result<()> {
        self.log_structured(LogLevel::Warning, message, context, Some(data)).await
    }
    
    /// Error level log
    pub async fn error(&self, message: &str, context: Option<&str>) -> Result<()> {
        self.log(LogLevel::Error, message, context).await
    }
    
    /// Error level log with structured data
    pub async fn error_structured(&self, message: &str, context: Option<&str>, data: HashMap<String, Value>) -> Result<()> {
        self.log_structured(LogLevel::Error, message, context, Some(data)).await
    }
    
    /// Critical level log
    pub async fn critical(&self, message: &str, context: Option<&str>) -> Result<()> {
        self.log(LogLevel::Critical, message, context).await
    }
    
    /// Critical level log with structured data
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
    
    /// Clean up old logs
    pub async fn cleanup_old_logs(&self, days_to_keep: i32) -> Result<usize> {
        let db = self.db.lock().await;
        let pool = db.get_pool();
        
        let result = sqlx::query(
            r#"
            DELETE FROM system_logs
            WHERE created_at < datetime('now', ?);
            "#
        )
        .bind(&format!("-{} days", days_to_keep))
        .execute(pool)
        .await
        .map_err(|e| HedgeXError::DatabaseError(e))?;
        
        let deleted_count = result.rows_affected() as usize;
        info!(deleted_count, days_to_keep, "Cleaned up old logs");
        
        Ok(deleted_count)
    }
    
    /// Archive logs to a file
    pub async fn archive_logs(&self, from_date: DateTime<Utc>, to_date: DateTime<Utc>) -> Result<PathBuf> {
        let db = self.db.lock().await;
        let pool = db.get_pool();
        
        let logs = sqlx::query_as::<_, SystemLog>(
            r#"
            SELECT id, user_id, log_level, message, created_at, context
            FROM system_logs 
            WHERE created_at BETWEEN ? AND ?
            ORDER BY created_at ASC
            "#
        )
        .bind(&from_date)
        .bind(&to_date)
        .fetch_all(pool)
        .await
        .map_err(|e| HedgeXError::DatabaseError(e))?;
        
        // Create archive file
        let archive_filename = format!(
            "logs_archive_{}_to_{}.json",
            from_date.format("%Y%m%d"),
            to_date.format("%Y%m%d")
        );
        let archive_path = self.log_dir.join(&archive_filename);
        
        // Convert logs to JSON
        let logs_json = serde_json::to_string_pretty(&logs)
            .with_context(|| "Failed to serialize logs to JSON")?;
            
        // Write to file
        let mut file = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&archive_path)
            .with_context(|| format!("Failed to create archive file: {:?}", archive_path))?;
            
        file.write_all(logs_json.as_bytes())
            .with_context(|| format!("Failed to write logs to archive file: {:?}", archive_path))?;
            
        info!(
            archive_path = %archive_path.display(),
            log_count = logs.len(),
            from_date = %from_date,
            to_date = %to_date,
            "Archived logs to file"
        );
        
        Ok(archive_path)
    }
}