use crate::db::{Database, DatabaseConfig, DatabaseStats};
use crate::error::{HedgeXError, Result, ResultExt};
use crate::utils::{EnhancedLogger, EnhancedCryptoService};
use crate::utils::database_utils::DatabaseManager;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, debug, error, warn, span, Level, Instrument};
use std::time::Duration;

/// Enhanced database service with connection pooling, migration management, and encryption
pub struct EnhancedDatabaseService {
    db_manager: Arc<DatabaseManager>,
    logger: Arc<Mutex<EnhancedLogger>>,
    crypto_service: Arc<EnhancedCryptoService>,
    app_data_dir: PathBuf,
}

impl EnhancedDatabaseService {
    /// Create a new enhanced database service
    pub async fn new(
        app_data_dir: &Path,
        master_password: &str,
    ) -> Result<Self> {
        Self::new_with_config(app_data_dir, DatabaseConfig::default(), master_password).await
    }
    
    /// Create a new enhanced database service with custom configuration
    pub async fn new_with_config(
        app_data_dir: &Path,
        config: DatabaseConfig,
        master_password: &str,
    ) -> Result<Self> {
        let span = span!(
            Level::INFO,
            "enhanced_database_service_init",
            app_data_dir = %app_data_dir.display()
        );
        
        async move {
            info!("Initializing EnhancedDatabaseService");
            
            // Initialize database manager
            let db_manager: DatabaseManager = DatabaseManager::new_with_config(app_data_dir, config).await?;
            let db_manager = Arc::new(db_manager);
            
            // Initialize crypto service
            let crypto_service = EnhancedCryptoService::new(master_password)?
                .with_key_rotation_interval(Duration::from_secs(3600)); // 1 hour key rotation
            let crypto_service = Arc::new(crypto_service);
            
            // Initialize logger
            let database = db_manager.get_database();
            let logger = EnhancedLogger::new(
                Arc::new(Mutex::new(database.as_ref().clone())),
                None,
                app_data_dir
            ).await?;
            let logger = Arc::new(Mutex::new(logger));
            
            let service = Self {
                db_manager,
                logger,
                crypto_service,
                app_data_dir: app_data_dir.to_path_buf(),
            };
            
            // Log successful initialization
            {
                let mut logger_guard = service.logger.lock().await;
                let _ = logger_guard.info("EnhancedDatabaseService initialized successfully", Some("database")).await;
            }
            
            info!("EnhancedDatabaseService initialization completed");
            Ok(service)
        }
        .instrument(span)
        .await
    }
    
    /// Get the database instance
    pub fn get_database(&self) -> Arc<Database> {
        self.db_manager.get_database()
    }
    
    /// Get database statistics
    pub async fn get_stats(&self) -> Result<DatabaseStats> {
        self.db_manager.get_stats().await
    }
    
    /// Run database maintenance
    pub async fn run_maintenance(&self) -> Result<()> {
        let span = span!(Level::INFO, "run_maintenance");
        
        async move {
            info!("Starting database maintenance");
            
            // Log maintenance start
            {
                let mut logger_guard = self.logger.lock().await;
                let _ = logger_guard.info("Starting database maintenance", Some("database")).await;
            }
            
            // Run maintenance
            match self.db_manager.run_maintenance().await {
                Ok(_) => {
                    info!("Database maintenance completed successfully");
                    
                    // Log successful maintenance
                    {
                        let mut logger_guard = self.logger.lock().await;
                        let _ = logger_guard.info("Database maintenance completed successfully", Some("database")).await;
                    }
                    
                    Ok(())
                },
                Err(e) => {
                    error!("Database maintenance failed: {}", e);
                    
                    // Log maintenance failure
                    {
                        let mut logger_guard = self.logger.lock().await;
                        let _ = logger_guard.error(&format!("Database maintenance failed: {}", e), Some("database")).await;
                    }
                    
                    Err(e)
                }
            }
        }
        .instrument(span)
        .await
    }
    
    /// Run pending migrations
    pub async fn run_migrations(&self) -> Result<()> {
        let span = span!(Level::INFO, "run_migrations");
        
        async move {
            info!("Running database migrations");
            
            // Log migration start
            {
                let mut logger_guard = self.logger.lock().await;
                let _ = logger_guard.info("Starting database migrations", Some("database")).await;
            }
            
            // Run migrations
            match self.db_manager.run_migrations().await {
                Ok(_) => {
                    info!("Database migrations completed successfully");
                    
                    // Log successful migrations
                    {
                        let mut logger_guard = self.logger.lock().await;
                        let _ = logger_guard.info("Database migrations completed successfully", Some("database")).await;
                    }
                    
                    Ok(())
                },
                Err(e) => {
                    error!("Database migrations failed: {}", e);
                    
                    // Log migration failure
                    {
                        let mut logger_guard = self.logger.lock().await;
                        let _ = logger_guard.error(&format!("Database migrations failed: {}", e), Some("database")).await;
                    }
                    
                    Err(e)
                }
            }
        }
        .instrument(span)
        .await
    }
    
    /// Create database backup
    pub async fn backup_database(&self, label: &str) -> Result<PathBuf> {
        let span = span!(Level::INFO, "backup_database", label = %label);
        
        async move {
            info!("Starting database backup with label: {}", label);
            
            // Log backup start
            {
                let mut logger_guard = self.logger.lock().await;
                let mut data = std::collections::HashMap::new();
                data.insert("label".to_string(), serde_json::Value::String(label.to_string()));
                
                let _ = logger_guard.info_structured(
                    "Starting database backup",
                    Some("database"),
                    data
                ).await;
            }
            
            // Create backup
            match self.db_manager.create_backup(label).await {
                Ok(backup_path) => {
                    info!("Database backup completed successfully: {:?}", backup_path);
                    
                    // Log successful backup
                    {
                        let mut logger_guard = self.logger.lock().await;
                        let mut data = std::collections::HashMap::new();
                        data.insert("label".to_string(), serde_json::Value::String(label.to_string()));
                        data.insert("backup_path".to_string(), serde_json::Value::String(backup_path.to_string_lossy().to_string()));
                        
                        let _ = logger_guard.info_structured(
                            "Database backup completed successfully",
                            Some("database"),
                            data
                        ).await;
                    }
                    
                    Ok(backup_path)
                },
                Err(e) => {
                    error!("Database backup failed: {}", e);
                    
                    // Log backup failure
                    {
                        let mut logger_guard = self.logger.lock().await;
                        let mut data = std::collections::HashMap::new();
                        data.insert("label".to_string(), serde_json::Value::String(label.to_string()));
                        data.insert("error".to_string(), serde_json::Value::String(e.to_string()));
                        
                        let _ = logger_guard.error_structured(
                            "Database backup failed",
                            Some("database"),
                            data
                        ).await;
                    }
                    
                    Err(e)
                }
            }
        }
        .instrument(span)
        .await
    }
    
    /// Health check for the database service
    pub async fn health_check(&self) -> Result<bool> {
        self.db_manager.health_check().await
    }
    
    /// Get the crypto service for encryption operations
    pub fn get_crypto_service(&self) -> Arc<EnhancedCryptoService> {
        Arc::clone(&self.crypto_service)
    }
    
    /// Get the logger instance
    pub fn get_logger(&self) -> Arc<Mutex<EnhancedLogger>> {
        Arc::clone(&self.logger)
    }
    
    /// Get the database manager
    pub fn get_db_manager(&self) -> Arc<DatabaseManager> {
        Arc::clone(&self.db_manager)
    }
    
    /// Encrypt sensitive data
    pub async fn encrypt_sensitive(&self, key_id: &str, plaintext: &str) -> Result<String> {
        self.crypto_service.encrypt_sensitive(key_id, plaintext).await
    }
    
    /// Decrypt sensitive data
    pub async fn decrypt_sensitive(&self, key_id: &str, ciphertext: &str) -> Result<String> {
        self.crypto_service.decrypt_sensitive(key_id, ciphertext).await
    }
    
    /// Encrypt API credentials
    pub async fn encrypt_api_credentials(&self, api_key: &str, api_secret: &str) -> Result<(String, String)> {
        self.crypto_service.encrypt_api_credentials(api_key, api_secret).await
    }
    
    /// Decrypt API credentials
    pub async fn decrypt_api_credentials(&self, encrypted_key: &str, encrypted_secret: &str) -> Result<(String, String)> {
        self.crypto_service.decrypt_api_credentials(encrypted_key, encrypted_secret).await
    }
    
    /// Hash password securely
    pub fn hash_password(&self, password: &str) -> Result<String> {
        self.crypto_service.secure_hash_password(password)
    }
    
    /// Verify password against hash
    pub fn verify_password(&self, password: &str, hash: &str) -> Result<bool> {
        self.crypto_service.verify_secure_password(password, hash)
    }
    
    /// Generate secure token
    pub fn generate_token(&self) -> Result<String> {
        self.crypto_service.generate_secure_token()
    }
}