use crate::models::{SystemLog, LogLevel};
use crate::db::Database;
use anyhow::Result;
use chrono::Utc;
use uuid::Uuid;
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct Logger {
    db: Arc<Mutex<Database>>,
    user_id: Option<String>,
}

impl Logger {
    pub fn new(db: Arc<Mutex<Database>>, user_id: Option<String>) -> Self {
        Self { db, user_id }
    }
    
    pub async fn set_user_id(&mut self, user_id: String) {
        self.user_id = Some(user_id);
    }
    
    pub async fn clear_user_id(&mut self) {
        self.user_id = None;
    }
    
    pub async fn log(&self, level: LogLevel, message: &str, context: Option<&str>) -> Result<()> {
        let log = SystemLog {
            id: Uuid::new_v4().to_string(),
            user_id: self.user_id.clone(),
            log_level: level.clone(),
            message: message.to_string(),
            created_at: Utc::now(),
            context: context.map(|s| s.to_string()),
        };
        
        // Print to console as well
        match level {
            LogLevel::Debug => println!("[DEBUG] {}", message),
            LogLevel::Info => println!("[INFO] {}", message),
            LogLevel::Warning => eprintln!("[WARNING] {}", message),
            LogLevel::Error => eprintln!("[ERROR] {}", message),
            LogLevel::Critical => eprintln!("[CRITICAL] {}", message),
        }
        
        // Save to database
        let db = self.db.lock().await;
        let pool = db.get_pool();
        
        sqlx::query!(
            r#"
            INSERT INTO system_logs (id, user_id, log_level, message, created_at, context)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
            log.id,
            log.user_id,
            log.log_level as i32, // Assuming we map the enum to integers in the DB
            log.message,
            log.created_at,
            log.context
        )
        .execute(pool)
        .await?;
        
        Ok(())
    }
    
    pub async fn debug(&self, message: &str, context: Option<&str>) -> Result<()> {
        self.log(LogLevel::Debug, message, context).await
    }
    
    pub async fn info(&self, message: &str, context: Option<&str>) -> Result<()> {
        self.log(LogLevel::Info, message, context).await
    }
    
    pub async fn warning(&self, message: &str, context: Option<&str>) -> Result<()> {
        self.log(LogLevel::Warning, message, context).await
    }
    
    pub async fn error(&self, message: &str, context: Option<&str>) -> Result<()> {
        self.log(LogLevel::Error, message, context).await
    }
    
    pub async fn critical(&self, message: &str, context: Option<&str>) -> Result<()> {
        self.log(LogLevel::Critical, message, context).await
    }
}
