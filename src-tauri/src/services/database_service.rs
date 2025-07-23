use crate::db::{Database, DatabaseConfig, DatabaseStats};
use crate::error::{HedgeXError, Result};
use crate::utils::{Logger, CryptoService};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, debug, error};

/// Enhanced database service with connection pooling and migration management
pub struct DatabaseService {
    database: Arc<Database>,
    logger: Arc<Mutex<Logger>>,
    crypto_service: Arc<CryptoService>,
}

impl DatabaseService {
    /// Create a new database service with default configuration
    pub async fn new(
        app_data_dir: &Path,
        logger: Arc<Mutex<Logger>>,
        crypto_service: Arc<CryptoService>,
    ) -> Result<Self> {
        Self::new_with_config(app_data_dir, DatabaseConfig::default(), logger, crypto_service).await
    }
    
    /// Create a new database service with custom configuration
    pub async fn new_with_config(
        app_data_dir: &Path,
        config: DatabaseConfig,
        logger: Arc<Mutex<Logger>>,
        crypto_service: Arc<CryptoService>,
    ) -> Result<Self> {
        info!("Initializing DatabaseService");
        
        let database = Database::new_with_config(app_data_dir, config)
            .await
            .map_err(|e| HedgeXError::DatabaseError(sqlx::Error::Configuration(e.into())))?;
        
        let service = Self {
            database: Arc::new(database),
            logger,
            crypto_service,
        };
        
        // Log successful initialization
        {
            let logger_guard = service.logger.lock().await;
            let _ = logger_guard.info("DatabaseService initialized successfully", Some("database")).await;
        }
        
        info!("DatabaseService initialization completed");
        Ok(service)
    }
    
    /// Get the database instance
    pub fn get_database(&self) -> Arc<Database> {
        Arc::clone(&self.database)
    }
    
    /// Get database statistics
    pub async fn get_stats(&self) -> Result<DatabaseStats> {
        debug!("Retrieving database statistics");
        
        let stats = self.database.get_stats().await?;
        
        // Log statistics retrieval
        {
            let logger_guard = self.logger.lock().await;
            let mut data = std::collections::HashMap::new();
            data.insert("pool_size".to_string(), serde_json::Value::Number(stats.pool_size.into()));
            data.insert("database_size_bytes".to_string(), serde_json::Value::Number(stats.database_size_bytes.into()));
            data.insert("table_count".to_string(), serde_json::Value::Number(stats.table_count.into()));
            
            let _ = logger_guard.debug_structured(
                "Database statistics retrieved",
                Some("database"),
                data
            ).await;
        }
        
        Ok(stats)
    }
    
    /// Run database maintenance
    pub async fn run_maintenance(&self) -> Result<()> {
        info!("Starting database maintenance");
        
        // Log maintenance start
        {
            let logger_guard = self.logger.lock().await;
            let _ = logger_guard.info("Starting database maintenance", Some("database")).await;
        }
        
        match self.database.maintenance().await {
            Ok(_) => {
                info!("Database maintenance completed successfully");
                
                // Log successful maintenance
                {
                    let logger_guard = self.logger.lock().await;
                    let _ = logger_guard.info("Database maintenance completed successfully", Some("database")).await;
                }
                
                Ok(())
            },
            Err(e) => {
                error!("Database maintenance failed: {}", e);
                
                // Log maintenance failure
                {
                    let logger_guard = self.logger.lock().await;
                    let _ = logger_guard.error(&format!("Database maintenance failed: {}", e), Some("database")).await;
                }
                
                Err(e)
            }
        }
    }
    
    /// Run pending migrations
    pub async fn run_migrations(&self) -> Result<()> {
        info!("Running database migrations");
        
        // Log migration start
        {
            let logger_guard = self.logger.lock().await;
            let _ = logger_guard.info("Starting database migrations", Some("database")).await;
        }
        
        match self.database.run_migrations().await {
            Ok(_) => {
                info!("Database migrations completed successfully");
                
                // Log successful migrations
                {
                    let logger_guard = self.logger.lock().await;
                    let _ = logger_guard.info("Database migrations completed successfully", Some("database")).await;
                }
                
                Ok(())
            },
            Err(e) => {
                error!("Database migrations failed: {}", e);
                
                // Log migration failure
                {
                    let logger_guard = self.logger.lock().await;
                    let _ = logger_guard.error(&format!("Database migrations failed: {}", e), Some("database")).await;
                }
                
                Err(e)
            }
        }
    }
    
    /// Health check for the database service
    pub async fn health_check(&self) -> Result<bool> {
        debug!("Performing database health check");
        
        // Try to execute a simple query
        let result = sqlx::query("SELECT 1")
            .fetch_one(self.database.get_pool())
            .await;
            
        match result {
            Ok(_) => {
                debug!("Database health check passed");
                
                // Log successful health check
                {
                    let logger_guard = self.logger.lock().await;
                    let _ = logger_guard.debug("Database health check passed", Some("database")).await;
                }
                
                Ok(true)
            },
            Err(e) => {
                error!("Database health check failed: {}", e);
                
                // Log health check failure
                {
                    let logger_guard = self.logger.lock().await;
                    let _ = logger_guard.error(&format!("Database health check failed: {}", e), Some("database")).await;
                }
                
                Err(HedgeXError::DatabaseError(e))
            }
        }
    }
    
    /// Backup database to specified path
    pub async fn backup_database(&self, backup_path: &Path) -> Result<()> {
        info!("Starting database backup to: {:?}", backup_path);
        
        // Log backup start
        {
            let logger_guard = self.logger.lock().await;
            let mut data = std::collections::HashMap::new();
            data.insert("backup_path".to_string(), serde_json::Value::String(backup_path.to_string_lossy().to_string()));
            
            let _ = logger_guard.info_structured(
                "Starting database backup",
                Some("database"),
                data
            ).await;
        }
        
        // Use SQLite VACUUM INTO for backup
        let backup_query = format!("VACUUM INTO '{}'", backup_path.to_string_lossy());
        
        match sqlx::query(&backup_query).execute(self.database.get_pool()).await {
            Ok(_) => {
                info!("Database backup completed successfully");
                
                // Log successful backup
                {
                    let logger_guard = self.logger.lock().await;
                    let mut data = std::collections::HashMap::new();
                    data.insert("backup_path".to_string(), serde_json::Value::String(backup_path.to_string_lossy().to_string()));
                    
                    let _ = logger_guard.info_structured(
                        "Database backup completed successfully",
                        Some("database"),
                        data
                    ).await;
                }
                
                Ok(())
            },
            Err(e) => {
                error!("Database backup failed: {}", e);
                
                // Log backup failure
                {
                    let logger_guard = self.logger.lock().await;
                    let mut data = std::collections::HashMap::new();
                    data.insert("backup_path".to_string(), serde_json::Value::String(backup_path.to_string_lossy().to_string()));
                    data.insert("error".to_string(), serde_json::Value::String(e.to_string()));
                    
                    let _ = logger_guard.error_structured(
                        "Database backup failed",
                        Some("database"),
                        data
                    ).await;
                }
                
                Err(HedgeXError::DatabaseError(e))
            }
        }
    }
    
    /// Get the crypto service for encryption operations
    pub fn get_crypto_service(&self) -> Arc<CryptoService> {
        Arc::clone(&self.crypto_service)
    }
    
    /// Get the logger instance
    pub fn get_logger(&self) -> Arc<Mutex<Logger>> {
        Arc::clone(&self.logger)
    }
}