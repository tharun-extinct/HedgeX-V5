use crate::db::{Database, DatabaseConfig, DatabaseStats};
use crate::error::{HedgeXError, Result, ResultExt};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, debug, error, warn, span, Level, Instrument};
use sqlx::migrate::MigrateDatabase;
use sqlx::sqlite::Sqlite;
use tokio::fs::{create_dir_all, remove_file};
use tokio::time::{Duration, sleep};
use std::time::Instant;

/// Enhanced database utilities for connection management and migrations
pub struct DatabaseManager {
    database: Arc<Database>,
    app_data_dir: PathBuf,
    backup_dir: PathBuf,
    config: DatabaseConfig,
}

impl DatabaseManager {
    /// Create a new database manager
    pub async fn new(app_data_dir: &Path) -> Result<Self> {
        Self::new_with_config(app_data_dir, DatabaseConfig::default()).await
    }
    
    /// Create a new database manager with custom configuration
    pub async fn new_with_config(app_data_dir: &Path, config: DatabaseConfig) -> Result<Self> {
        // Create span for tracing
        let span = span!(
            Level::INFO,
            "database_manager_init",
            app_data_dir = %app_data_dir.display()
        );
        
        async move {
            info!("Initializing DatabaseManager with config: {:?}", config);
            
            // Ensure directories exist
            let backup_dir = app_data_dir.join("backups");
            create_dir_all(&backup_dir).await
                .with_context(|| format!("Failed to create backup directory: {:?}", backup_dir))?;
                
            // Initialize database
            let database = Database::new_with_config(app_data_dir, config.clone()).await
                .with_context(|| "Failed to initialize database")?;
                
            Ok::<_, HedgeXError>(Self {
                database: Arc::new(database),
                app_data_dir: app_data_dir.to_path_buf(),
                backup_dir,
                config,
            })
        }
        .instrument(span)
        .await
    }
    
    /// Get the database instance
    pub fn get_database(&self) -> Arc<Database> {
        Arc::clone(&self.database)
    }
    
    /// Run database migrations
    pub async fn run_migrations(&self) -> Result<()> {
        let span = span!(Level::INFO, "run_migrations");
        
        async move {
            info!("Running database migrations");
            
            // Create backup before migrations
            self.create_backup("pre_migration").await?;
            
            // Run migrations
            self.database.run_migrations().await?;
            
            info!("Database migrations completed successfully");
            Ok(())
        }
        .instrument(span)
        .await
    }
    
    /// Create a database backup
    pub async fn create_backup(&self, label: &str) -> Result<PathBuf> {
        let span = span!(Level::INFO, "create_backup", label = %label);
        
        async move {
            let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
            let backup_filename = format!("hedgex_{}_{}.db", label, timestamp);
            let backup_path = self.backup_dir.join(backup_filename);
            
            info!("Creating database backup: {:?}", backup_path);
            
            // Use SQLite VACUUM INTO for backup
            let db_path = self.app_data_dir.join("hedgex.db");
            let backup_query = format!("VACUUM INTO '{}'", backup_path.to_string_lossy());
            
            sqlx::query(&backup_query)
                .execute(self.database.get_pool())
                .await
                .with_context(|| format!("Failed to create database backup: {:?}", backup_path))?;
                
            info!("Database backup created successfully: {:?}", backup_path);
            
            Ok(backup_path)
        }
        .instrument(span)
        .await
    }
    
    /// Restore database from backup
    pub async fn restore_from_backup(&self, backup_path: &Path) -> Result<()> {
        let span = span!(Level::INFO, "restore_backup", backup_path = %backup_path.display());
        
        async move {
            info!("Restoring database from backup: {:?}", backup_path);
            
            if !backup_path.exists() {
                return Err(HedgeXError::NotFoundError(format!(
                    "Backup file not found: {:?}", backup_path
                )));
            }
            
            // Close the current database connection
            // We need to drop the current pool and recreate it
            let db_path = self.app_data_dir.join("hedgex.db");
            
            // Create a temporary backup of the current database
            let temp_backup = self.app_data_dir.join("hedgex_temp_backup.db");
            let backup_query = format!("VACUUM INTO '{}'", temp_backup.to_string_lossy());
            
            sqlx::query(&backup_query)
                .execute(self.database.get_pool())
                .await
                .with_context(|| "Failed to create temporary backup")?;
                
            // Close the database connection
            self.database.clone().close().await;
            
            // Wait for connections to close
            sleep(Duration::from_millis(500)).await;
            
            // Copy backup to main database file
            tokio::fs::copy(backup_path, &db_path).await
                .with_context(|| format!("Failed to copy backup to database file: {:?}", db_path))?;
                
            // Reinitialize the database
            let new_db = Database::new_with_config(&self.app_data_dir, self.config.clone()).await
                .with_context(|| "Failed to reinitialize database after restore")?;
                
            // Replace the database instance
            // This is a bit hacky but necessary to update the Arc<Database>
            unsafe {
                let db_ptr = Arc::as_ptr(&self.database) as *mut Database;
                std::ptr::write(db_ptr, new_db);
            }
            
            info!("Database restored successfully from backup: {:?}", backup_path);
            
            // Clean up temporary backup
            if temp_backup.exists() {
                let _ = remove_file(&temp_backup).await;
            }
            
            Ok(())
        }
        .instrument(span)
        .await
    }
    
    /// List available backups
    pub async fn list_backups(&self) -> Result<Vec<PathBuf>> {
        let span = span!(Level::INFO, "list_backups");
        
        async move {
            debug!("Listing database backups");
            
            let mut entries = tokio::fs::read_dir(&self.backup_dir).await
                .with_context(|| format!("Failed to read backup directory: {:?}", self.backup_dir))?;
                
            let mut backups = Vec::new();
            
            while let Some(entry) = entries.next_entry().await
                .with_context(|| "Failed to read directory entry")? 
            {
                let path = entry.path();
                if path.is_file() && path.extension().map_or(false, |ext| ext == "db") {
                    backups.push(path);
                }
            }
            
            // Sort by modification time (newest first)
            backups.sort_by(|a, b| {
                let a_meta = std::fs::metadata(a).ok();
                let b_meta = std::fs::metadata(b).ok();
                
                match (a_meta, b_meta) {
                    (Some(a_meta), Some(b_meta)) => {
                        b_meta.modified().unwrap_or_default()
                            .cmp(&a_meta.modified().unwrap_or_default())
                    },
                    _ => std::cmp::Ordering::Equal,
                }
            });
            
            debug!("Found {} database backups", backups.len());
            Ok(backups)
        }
        .instrument(span)
        .await
    }
    
    /// Clean up old backups, keeping only the specified number
    pub async fn cleanup_old_backups(&self, keep_count: usize) -> Result<usize> {
        let span = span!(Level::INFO, "cleanup_backups", keep_count);
        
        async move {
            info!("Cleaning up old database backups, keeping {} newest", keep_count);
            
            let backups = self.list_backups().await?;
            
            if backups.len() <= keep_count {
                debug!("No backups to clean up (have {}, keeping {})", backups.len(), keep_count);
                return Ok(0);
            }
            
            let to_delete = &backups[keep_count..];
            let delete_count = to_delete.len();
            
            for backup in to_delete {
                debug!("Deleting old backup: {:?}", backup);
                if let Err(e) = remove_file(backup).await {
                    warn!("Failed to delete backup {:?}: {}", backup, e);
                }
            }
            
            info!("Cleaned up {} old database backups", delete_count);
            Ok(delete_count)
        }
        .instrument(span)
        .await
    }
    
    /// Perform database maintenance
    pub async fn run_maintenance(&self) -> Result<()> {
        let span = span!(Level::INFO, "run_maintenance");
        
        async move {
            info!("Starting database maintenance");
            
            let start_time = Instant::now();
            
            // Run ANALYZE to update statistics
            debug!("Running ANALYZE");
            sqlx::query("ANALYZE")
                .execute(self.database.get_pool())
                .await
                .with_context(|| "Failed to run ANALYZE")?;
                
            // Run VACUUM to reclaim space
            debug!("Running VACUUM");
            sqlx::query("VACUUM")
                .execute(self.database.get_pool())
                .await
                .with_context(|| "Failed to run VACUUM")?;
                
            // Run integrity check
            debug!("Running integrity check");
            let integrity: (String,) = sqlx::query_as("PRAGMA integrity_check")
                .fetch_one(self.database.get_pool())
                .await
                .with_context(|| "Failed to run integrity check")?;
                
            if integrity.0 != "ok" {
                error!("Database integrity check failed: {}", integrity.0);
                return Err(HedgeXError::DataIntegrityError(format!(
                    "Database integrity check failed: {}", integrity.0
                )));
            }
            
            let elapsed = start_time.elapsed();
            info!("Database maintenance completed successfully in {:?}", elapsed);
            
            Ok(())
        }
        .instrument(span)
        .await
    }
    
    /// Get database statistics
    pub async fn get_stats(&self) -> Result<DatabaseStats> {
        self.database.get_stats().await
    }
    
    /// Check database health
    pub async fn health_check(&self) -> Result<bool> {
        let span = span!(Level::DEBUG, "health_check");
        
        async move {
            debug!("Performing database health check");
            
            // Try to execute a simple query
            let result = sqlx::query("SELECT 1")
                .fetch_one(self.database.get_pool())
                .await;
                
            match result {
                Ok(_) => {
                    debug!("Database health check passed");
                    Ok(true)
                },
                Err(e) => {
                    error!("Database health check failed: {}", e);
                    Err(HedgeXError::DatabaseError(e))
                }
            }
        }
        .instrument(span)
        .await
    }
    
    /// Initialize a new database if it doesn't exist
    pub async fn initialize_if_needed(db_url: &str) -> Result<bool> {
        let span = span!(Level::INFO, "initialize_if_needed");
        
        async move {
            if !Sqlite::database_exists(db_url).await
                .with_context(|| format!("Failed to check if database exists: {}", db_url))? 
            {
                info!("Database does not exist, creating: {}", db_url);
                Sqlite::create_database(db_url).await
                    .with_context(|| format!("Failed to create database: {}", db_url))?;
                    
                info!("Database created successfully: {}", db_url);
                Ok(true)
            } else {
                debug!("Database already exists: {}", db_url);
                Ok(false)
            }
        }
        .instrument(span)
        .await
    }
}