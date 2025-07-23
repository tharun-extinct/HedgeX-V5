use crate::db::DatabaseConfig;
use crate::error::{HedgeXError, Result};
use crate::services::DatabaseService;
use crate::utils::{Logger, CryptoService};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, debug, error};

/// Main application service that coordinates all core services
pub struct AppService {
    database_service: Arc<DatabaseService>,
    logger: Arc<Mutex<Logger>>,
    crypto_service: Arc<CryptoService>,
    app_data_dir: std::path::PathBuf,
}

impl AppService {
    /// Initialize the application service with all core components
    pub async fn new(app_data_dir: &Path) -> Result<Self> {
        info!("Initializing AppService");
        
        // Initialize crypto service first
        let crypto_service = Arc::new(CryptoService::new());
        
        // Initialize logger with database placeholder (will be updated after DB init)
        let logger = Arc::new(Mutex::new(Logger::new(
            Arc::new(Mutex::new(
                crate::db::Database::new(app_data_dir)
                    .await
                    .map_err(|e| HedgeXError::DatabaseError(sqlx::Error::Configuration(e.into())))?
            )),
            None
        )));
        
        // Initialize database service
        let database_service = Arc::new(
            DatabaseService::new(app_data_dir, Arc::clone(&logger), Arc::clone(&crypto_service))
                .await?
        );
        
        // Update logger with the proper database reference
        {
            let mut logger_guard = logger.lock().await;
            *logger_guard = Logger::new(database_service.get_database(), None);
        }
        
        let service = Self {
            database_service,
            logger,
            crypto_service,
            app_data_dir: app_data_dir.to_path_buf(),
        };
        
        // Log successful initialization
        {
            let logger_guard = service.logger.lock().await;
            let _ = logger_guard.info("AppService initialized successfully", Some("app")).await;
        }
        
        info!("AppService initialization completed");
        Ok(service)
    }
    
    /// Initialize with custom database configuration
    pub async fn new_with_db_config(app_data_dir: &Path, db_config: DatabaseConfig) -> Result<Self> {
        info!("Initializing AppService with custom database configuration");
        
        // Initialize crypto service first
        let crypto_service = Arc::new(CryptoService::new());
        
        // Initialize logger with database placeholder
        let logger = Arc::new(Mutex::new(Logger::new(
            Arc::new(Mutex::new(
                crate::db::Database::new_with_config(app_data_dir, db_config.clone())
                    .await
                    .map_err(|e| HedgeXError::DatabaseError(sqlx::Error::Configuration(e.into())))?
            )),
            None
        )));
        
        // Initialize database service with custom config
        let database_service = Arc::new(
            DatabaseService::new_with_config(app_data_dir, db_config, Arc::clone(&logger), Arc::clone(&crypto_service))
                .await?
        );
        
        // Update logger with the proper database reference
        {
            let mut logger_guard = logger.lock().await;
            *logger_guard = Logger::new(database_service.get_database(), None);
        }
        
        let service = Self {
            database_service,
            logger,
            crypto_service,
            app_data_dir: app_data_dir.to_path_buf(),
        };
        
        // Log successful initialization
        {
            let logger_guard = service.logger.lock().await;
            let _ = logger_guard.info("AppService initialized successfully with custom config", Some("app")).await;
        }
        
        info!("AppService initialization with custom config completed");
        Ok(service)
    }
    
    /// Get the database service
    pub fn get_database_service(&self) -> Arc<DatabaseService> {
        Arc::clone(&self.database_service)
    }
    
    /// Get the logger
    pub fn get_logger(&self) -> Arc<Mutex<Logger>> {
        Arc::clone(&self.logger)
    }
    
    /// Get the crypto service
    pub fn get_crypto_service(&self) -> Arc<CryptoService> {
        Arc::clone(&self.crypto_service)
    }
    
    /// Get the application data directory
    pub fn get_app_data_dir(&self) -> &Path {
        &self.app_data_dir
    }
    
    /// Perform comprehensive health check of all services
    pub async fn health_check(&self) -> Result<HealthStatus> {
        debug!("Performing comprehensive health check");
        
        let mut status = HealthStatus {
            overall_healthy: true,
            database_healthy: false,
            crypto_service_healthy: false,
            logger_healthy: false,
            errors: Vec::new(),
        };
        
        // Check database health
        match self.database_service.health_check().await {
            Ok(healthy) => {
                status.database_healthy = healthy;
                if !healthy {
                    status.overall_healthy = false;
                    status.errors.push("Database health check failed".to_string());
                }
            },
            Err(e) => {
                status.database_healthy = false;
                status.overall_healthy = false;
                status.errors.push(format!("Database health check error: {}", e));
            }
        }
        
        // Check crypto service health (simple encryption/decryption test)
        match self.test_crypto_service().await {
            Ok(_) => status.crypto_service_healthy = true,
            Err(e) => {
                status.crypto_service_healthy = false;
                status.overall_healthy = false;
                status.errors.push(format!("Crypto service health check error: {}", e));
            }
        }
        
        // Check logger health (simple log write test)
        match self.test_logger().await {
            Ok(_) => status.logger_healthy = true,
            Err(e) => {
                status.logger_healthy = false;
                status.overall_healthy = false;
                status.errors.push(format!("Logger health check error: {}", e));
            }
        }
        
        // Log health check results
        {
            let logger_guard = self.logger.lock().await;
            let mut data = std::collections::HashMap::new();
            data.insert("overall_healthy".to_string(), serde_json::Value::Bool(status.overall_healthy));
            data.insert("database_healthy".to_string(), serde_json::Value::Bool(status.database_healthy));
            data.insert("crypto_service_healthy".to_string(), serde_json::Value::Bool(status.crypto_service_healthy));
            data.insert("logger_healthy".to_string(), serde_json::Value::Bool(status.logger_healthy));
            
            if status.overall_healthy {
                let _ = logger_guard.info_structured("Health check passed", Some("app"), data).await;
            } else {
                data.insert("errors".to_string(), serde_json::Value::Array(
                    status.errors.iter().map(|e| serde_json::Value::String(e.clone())).collect()
                ));
                let _ = logger_guard.warning_structured("Health check failed", Some("app"), data).await;
            }
        }
        
        Ok(status)
    }
    
    /// Test crypto service functionality
    async fn test_crypto_service(&self) -> Result<()> {
        let test_data = "health_check_test_data";
        let key = CryptoService::generate_key()?;
        
        let encrypted = self.crypto_service.encrypt_with_key(test_data, &key)?;
        let decrypted = self.crypto_service.decrypt_with_key(&encrypted, &key)?;
        
        if decrypted == test_data {
            Ok(())
        } else {
            Err(HedgeXError::CryptoError("Crypto service health check failed".to_string()))
        }
    }
    
    /// Test logger functionality
    async fn test_logger(&self) -> Result<()> {
        let logger_guard = self.logger.lock().await;
        logger_guard.debug("Logger health check test", Some("health_check")).await
    }
    
    /// Shutdown the application service gracefully
    pub async fn shutdown(self) -> Result<()> {
        info!("Shutting down AppService");
        
        // Log shutdown start
        {
            let logger_guard = self.logger.lock().await;
            let _ = logger_guard.info("Starting AppService shutdown", Some("app")).await;
        }
        
        // Perform any cleanup operations here
        // For now, just log the shutdown completion
        {
            let logger_guard = self.logger.lock().await;
            let _ = logger_guard.info("AppService shutdown completed", Some("app")).await;
        }
        
        info!("AppService shutdown completed");
        Ok(())
    }
}

/// Health status information for the application
#[derive(Debug, Clone)]
pub struct HealthStatus {
    pub overall_healthy: bool,
    pub database_healthy: bool,
    pub crypto_service_healthy: bool,
    pub logger_healthy: bool,
    pub errors: Vec<String>,
}