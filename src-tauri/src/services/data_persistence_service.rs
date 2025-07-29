use crate::db::Database;
use crate::error::{HedgeXError, Result};
use crate::utils::{EnhancedCryptoService, EnhancedLogger};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, debug, error, warn, span, Level, Instrument};
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc, Duration as ChronoDuration};
use tokio::fs::{create_dir_all, remove_file, File, read_to_string, write};
use tokio::io::{AsyncWriteExt, AsyncReadExt};
use flate2::write::GzEncoder;
use flate2::read::GzDecoder;
use flate2::Compression;
use std::io::{Write, Read};
use uuid::Uuid;
use sqlx::Row;

/// Configuration for data persistence operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataPersistenceConfig {
    pub auto_backup_enabled: bool,
    pub backup_interval_hours: u64,
    pub max_backups_to_keep: usize,
    pub compress_backups: bool,
    pub encrypt_exports: bool,
    pub log_retention_days: i64,
    pub trade_data_retention_days: i64,
    pub auto_cleanup_enabled: bool,
    pub cleanup_interval_hours: u64,
}

impl Default for DataPersistenceConfig {
    fn default() -> Self {
        Self {
            auto_backup_enabled: true,
            backup_interval_hours: 6, // Every 6 hours
            max_backups_to_keep: 10,
            compress_backups: true,
            encrypt_exports: true,
            log_retention_days: 30,
            trade_data_retention_days: 365, // Keep trade data for 1 year
            auto_cleanup_enabled: true,
            cleanup_interval_hours: 24, // Daily cleanup
        }
    }
}

/// User preferences and settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSettings {
    pub user_id: String,
    pub theme: String,
    pub language: String,
    pub timezone: String,
    pub notifications_enabled: bool,
    pub sound_enabled: bool,
    pub auto_start_trading: bool,
    pub default_risk_percentage: f64,
    pub dashboard_layout: serde_json::Value,
    pub chart_preferences: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Default for UserSettings {
    fn default() -> Self {
        Self {
            user_id: String::new(),
            theme: "dark".to_string(),
            language: "en".to_string(),
            timezone: "UTC".to_string(),
            notifications_enabled: true,
            sound_enabled: true,
            auto_start_trading: false,
            default_risk_percentage: 1.0,
            dashboard_layout: serde_json::json!({}),
            chart_preferences: serde_json::json!({}),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }
}

/// Backup metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupMetadata {
    pub id: String,
    pub label: String,
    pub created_at: DateTime<Utc>,
    pub file_path: PathBuf,
    pub file_size: u64,
    pub compressed: bool,
    pub encrypted: bool,
    pub checksum: String,
    pub backup_type: BackupType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BackupType {
    Automatic,
    Manual,
    PreMigration,
    PreUpdate,
}

/// Export format options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExportFormat {
    Json,
    Csv,
    Sql,
}

/// Data export request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataExportRequest {
    pub user_id: String,
    pub export_type: ExportType,
    pub format: ExportFormat,
    pub date_range: Option<(DateTime<Utc>, DateTime<Utc>)>,
    pub include_sensitive: bool,
    pub compress: bool,
    pub encrypt: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExportType {
    AllData,
    TradeHistory,
    StrategyData,
    UserSettings,
    SystemLogs,
}

/// Data persistence service for backup, export, and cleanup operations
pub struct DataPersistenceService {
    database: Arc<Database>,
    crypto_service: Arc<EnhancedCryptoService>,
    logger: Arc<Mutex<EnhancedLogger>>,
    app_data_dir: PathBuf,
    backup_dir: PathBuf,
    export_dir: PathBuf,
    config: DataPersistenceConfig,
}

impl DataPersistenceService {
    /// Create a new data persistence service
    pub async fn new(
        database: Arc<Database>,
        crypto_service: Arc<EnhancedCryptoService>,
        logger: Arc<Mutex<EnhancedLogger>>,
        app_data_dir: &Path,
        config: DataPersistenceConfig,
    ) -> Result<Self> {
        let span = span!(Level::INFO, "data_persistence_service_init");
        
        async move {
            info!("Initializing DataPersistenceService");
            
            // Create necessary directories
            let backup_dir = app_data_dir.join("backups");
            let export_dir = app_data_dir.join("exports");
            
            create_dir_all(&backup_dir).await
                .map_err(|e| HedgeXError::InternalError(format!("Failed to create backup directory: {}", e)))?;
            create_dir_all(&export_dir).await
                .map_err(|e| HedgeXError::InternalError(format!("Failed to create export directory: {}", e)))?;
            
            let service = Self {
                database,
                crypto_service,
                logger,
                app_data_dir: app_data_dir.to_path_buf(),
                backup_dir,
                export_dir,
                config,
            };
            
            // Initialize user settings table if it doesn't exist
            service.initialize_settings_table().await?;
            
            // Log successful initialization
            {
                let mut logger_guard = service.logger.lock().await;
                let _ = logger_guard.info("DataPersistenceService initialized successfully", Some("persistence")).await;
            }
            
            info!("DataPersistenceService initialization completed");
            Ok(service)
        }
        .instrument(span)
        .await
    }
    
    /// Initialize the user settings table
    async fn initialize_settings_table(&self) -> Result<()> {
        let query = r#"
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id TEXT PRIMARY KEY,
                theme TEXT NOT NULL DEFAULT 'dark',
                language TEXT NOT NULL DEFAULT 'en',
                timezone TEXT NOT NULL DEFAULT 'UTC',
                notifications_enabled BOOLEAN NOT NULL DEFAULT true,
                sound_enabled BOOLEAN NOT NULL DEFAULT true,
                auto_start_trading BOOLEAN NOT NULL DEFAULT false,
                default_risk_percentage REAL NOT NULL DEFAULT 1.0,
                dashboard_layout TEXT NOT NULL DEFAULT '{}',
                chart_preferences TEXT NOT NULL DEFAULT '{}',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        "#;
        
        sqlx::query(query)
            .execute(self.database.get_pool())
            .await
            .map_err(|e| HedgeXError::DatabaseError(e))?;
            
        Ok(())
    }
    
    /// Create an automatic database backup
    pub async fn create_automatic_backup(&self) -> Result<BackupMetadata> {
        self.create_backup("auto", BackupType::Automatic).await
    }
    
    /// Create a manual database backup
    pub async fn create_manual_backup(&self, label: &str) -> Result<BackupMetadata> {
        self.create_backup(label, BackupType::Manual).await
    }
    
    /// Create a database backup with specified type
    pub async fn create_backup(&self, label: &str, backup_type: BackupType) -> Result<BackupMetadata> {
        let span = span!(Level::INFO, "create_backup", label = %label);
        
        async move {
            info!("Creating database backup with label: {}", label);
            
            let backup_id = Uuid::new_v4().to_string();
            let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
            let filename = if self.config.compress_backups {
                format!("hedgex_{}_{}.db.gz", label, timestamp)
            } else {
                format!("hedgex_{}_{}.db", label, timestamp)
            };
            let backup_path = self.backup_dir.join(&filename);
            
            // Create temporary backup using SQLite VACUUM INTO
            let temp_backup_path = self.backup_dir.join(format!("temp_{}.db", backup_id));
            let vacuum_query = format!("VACUUM INTO '{}'", temp_backup_path.to_string_lossy());
            
            sqlx::query(&vacuum_query)
                .execute(self.database.get_pool())
                .await
                .map_err(|e| HedgeXError::DatabaseError(e))?;
            
            // Calculate checksum of the temporary backup
            let temp_data = tokio::fs::read(&temp_backup_path).await
                .map_err(|e| HedgeXError::InternalError(format!("Failed to read temporary backup: {}", e)))?;
            let checksum = self.crypto_service.calculate_checksum(&temp_data)?;
            
            let file_size = if self.config.compress_backups {
                // Compress the backup
                let compressed_data = self.compress_data(&temp_data)?;
                tokio::fs::write(&backup_path, compressed_data).await
                    .map_err(|e| HedgeXError::InternalError(format!("Failed to write compressed backup: {}", e)))?;
                
                tokio::fs::metadata(&backup_path).await
                    .map_err(|e| HedgeXError::InternalError(format!("Failed to get backup file size: {}", e)))?
                    .len()
            } else {
                // Move the temporary backup to final location
                tokio::fs::rename(&temp_backup_path, &backup_path).await
                    .map_err(|e| HedgeXError::InternalError(format!("Failed to move backup file: {}", e)))?;
                
                temp_data.len() as u64
            };
            
            // Clean up temporary file if it still exists
            if temp_backup_path.exists() {
                let _ = remove_file(&temp_backup_path).await;
            }
            
            let metadata = BackupMetadata {
                id: backup_id,
                label: label.to_string(),
                created_at: Utc::now(),
                file_path: backup_path,
                file_size,
                compressed: self.config.compress_backups,
                encrypted: false, // Database backups are not encrypted by default
                checksum,
                backup_type,
            };
            
            // Save backup metadata
            self.save_backup_metadata(&metadata).await?;
            
            // Log successful backup
            {
                let mut logger_guard = self.logger.lock().await;
                let mut data = std::collections::HashMap::new();
                data.insert("backup_id".to_string(), serde_json::Value::String(metadata.id.clone()));
                data.insert("label".to_string(), serde_json::Value::String(label.to_string()));
                data.insert("file_size".to_string(), serde_json::Value::Number(serde_json::Number::from(file_size)));
                
                let _ = logger_guard.info_structured(
                    "Database backup created successfully",
                    Some("persistence"),
                    data
                ).await;
            }
            
            info!("Database backup created successfully: {:?}", metadata.file_path);
            Ok(metadata)
        }
        .instrument(span)
        .await
    }
    
    /// Restore database from backup
    pub async fn restore_from_backup(&self, backup_id: &str) -> Result<()> {
        let span = span!(Level::INFO, "restore_backup", backup_id = %backup_id);
        
        async move {
            info!("Restoring database from backup: {}", backup_id);
            
            // Get backup metadata
            let metadata = self.get_backup_metadata(backup_id).await?;
            
            if !metadata.file_path.exists() {
                return Err(HedgeXError::NotFoundError(format!(
                    "Backup file not found: {:?}", metadata.file_path
                )));
            }
            
            // Read backup data
            let backup_data = tokio::fs::read(&metadata.file_path).await
                .map_err(|e| HedgeXError::InternalError(format!("Failed to read backup file: {}", e)))?;
            
            // Decompress if necessary
            let db_data = if metadata.compressed {
                self.decompress_data(&backup_data)?
            } else {
                backup_data
            };
            
            // Verify checksum
            let calculated_checksum = self.crypto_service.calculate_checksum(&db_data)?;
            if calculated_checksum != metadata.checksum {
                return Err(HedgeXError::DataIntegrityError(
                    "Backup checksum verification failed".to_string()
                ));
            }
            
            // Create a backup of current database before restore
            self.create_backup("pre_restore", BackupType::Manual).await?;
            
            // Write the backup data to a temporary file
            let temp_restore_path = self.app_data_dir.join("temp_restore.db");
            tokio::fs::write(&temp_restore_path, db_data).await
                .map_err(|e| HedgeXError::InternalError(format!("Failed to write restore data: {}", e)))?;
            
            // Close current database connections
            // Note: This is a simplified approach. In a real implementation,
            // you might need to coordinate with other services to close connections
            
            // Replace the main database file
            let main_db_path = self.app_data_dir.join("hedgex.db");
            tokio::fs::rename(&temp_restore_path, &main_db_path).await
                .map_err(|e| HedgeXError::InternalError(format!("Failed to replace database file: {}", e)))?;
            
            // Log successful restore
            {
                let mut logger_guard = self.logger.lock().await;
                let mut data = std::collections::HashMap::new();
                data.insert("backup_id".to_string(), serde_json::Value::String(backup_id.to_string()));
                
                let _ = logger_guard.info_structured(
                    "Database restored successfully from backup",
                    Some("persistence"),
                    data
                ).await;
            }
            
            info!("Database restored successfully from backup: {}", backup_id);
            Ok(())
        }
        .instrument(span)
        .await
    }
    
    /// List all available backups
    pub async fn list_backups(&self) -> Result<Vec<BackupMetadata>> {
        let query = r#"
            SELECT backup_id, label, created_at, file_path, file_size, compressed, encrypted, checksum, backup_type
            FROM backup_metadata
            ORDER BY created_at DESC
        "#;
        
        let rows = sqlx::query(query)
            .fetch_all(self.database.get_pool())
            .await
            .map_err(|e| HedgeXError::DatabaseError(e))?;
        
        let mut backups = Vec::new();
        for row in rows {
            let backup_type_str: String = row.get("backup_type");
            let backup_type = match backup_type_str.as_str() {
                "Automatic" => BackupType::Automatic,
                "Manual" => BackupType::Manual,
                "PreMigration" => BackupType::PreMigration,
                "PreUpdate" => BackupType::PreUpdate,
                _ => BackupType::Manual,
            };
            
            backups.push(BackupMetadata {
                id: row.get("backup_id"),
                label: row.get("label"),
                created_at: row.get("created_at"),
                file_path: PathBuf::from(row.get::<String, _>("file_path")),
                file_size: row.get::<i64, _>("file_size") as u64,
                compressed: row.get("compressed"),
                encrypted: row.get("encrypted"),
                checksum: row.get("checksum"),
                backup_type,
            });
        }
        
        Ok(backups)
    }
    
    /// Clean up old backups based on configuration
    pub async fn cleanup_old_backups(&self) -> Result<usize> {
        let span = span!(Level::INFO, "cleanup_old_backups");
        
        async move {
            info!("Cleaning up old backups, keeping {} newest", self.config.max_backups_to_keep);
            
            let backups = self.list_backups().await?;
            
            if backups.len() <= self.config.max_backups_to_keep {
                debug!("No backups to clean up (have {}, keeping {})", backups.len(), self.config.max_backups_to_keep);
                return Ok(0);
            }
            
            let to_delete = &backups[self.config.max_backups_to_keep..];
            let mut deleted_count = 0;
            
            for backup in to_delete {
                debug!("Deleting old backup: {}", backup.id);
                
                // Delete backup file
                if backup.file_path.exists() {
                    if let Err(e) = remove_file(&backup.file_path).await {
                        warn!("Failed to delete backup file {:?}: {}", backup.file_path, e);
                        continue;
                    }
                }
                
                // Delete backup metadata
                if let Err(e) = self.delete_backup_metadata(&backup.id).await {
                    warn!("Failed to delete backup metadata {}: {}", backup.id, e);
                    continue;
                }
                
                deleted_count += 1;
            }
            
            info!("Cleaned up {} old backups", deleted_count);
            Ok(deleted_count)
        }
        .instrument(span)
        .await
    }   
 
    /// Export user data in specified format
    pub async fn export_data(&self, request: DataExportRequest) -> Result<PathBuf> {
        let span = span!(Level::INFO, "export_data", user_id = %request.user_id);
        
        async move {
            info!("Exporting data for user: {}", request.user_id);
            
            let export_id = Uuid::new_v4().to_string();
            let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
            let base_filename = format!("hedgex_export_{}_{}", request.user_id, timestamp);
            
            let filename = match request.format {
                ExportFormat::Json => format!("{}.json", base_filename),
                ExportFormat::Csv => format!("{}.csv", base_filename),
                ExportFormat::Sql => format!("{}.sql", base_filename),
            };
            
            let export_path = self.export_dir.join(&filename);
            
            // Collect data based on export type
            let export_data = match request.export_type {
                ExportType::AllData => self.export_all_data(&request).await?,
                ExportType::TradeHistory => self.export_trade_history(&request).await?,
                ExportType::StrategyData => self.export_strategy_data(&request).await?,
                ExportType::UserSettings => self.export_user_settings(&request).await?,
                ExportType::SystemLogs => self.export_system_logs(&request).await?,
            };
            
            // Format data according to requested format
            let formatted_data = match request.format {
                ExportFormat::Json => serde_json::to_string_pretty(&export_data)
                    .map_err(|e| HedgeXError::InternalError(format!("JSON serialization failed: {}", e)))?,
                ExportFormat::Csv => self.format_as_csv(&export_data)?,
                ExportFormat::Sql => self.format_as_sql(&export_data)?,
            };
            
            let mut final_data = formatted_data.into_bytes();
            
            // Compress if requested
            if request.compress {
                final_data = self.compress_data(&final_data)?;
            }
            
            // Encrypt if requested and sensitive data is included
            if request.encrypt && request.include_sensitive {
                let encrypted_data = self.crypto_service.encrypt_sensitive("export", &String::from_utf8_lossy(&final_data)).await?;
                final_data = encrypted_data.into_bytes();
            }
            
            // Write to file
            tokio::fs::write(&export_path, final_data).await
                .map_err(|e| HedgeXError::InternalError(format!("Failed to write export file: {}", e)))?;
            
            // Log successful export
            {
                let mut logger_guard = self.logger.lock().await;
                let mut data = std::collections::HashMap::new();
                data.insert("user_id".to_string(), serde_json::Value::String(request.user_id.clone()));
                data.insert("export_type".to_string(), serde_json::Value::String(format!("{:?}", request.export_type)));
                data.insert("format".to_string(), serde_json::Value::String(format!("{:?}", request.format)));
                
                let _ = logger_guard.info_structured(
                    "Data export completed successfully",
                    Some("persistence"),
                    data
                ).await;
            }
            
            info!("Data export completed successfully: {:?}", export_path);
            Ok(export_path)
        }
        .instrument(span)
        .await
    }
    
    /// Save user settings
    pub async fn save_user_settings(&self, settings: &UserSettings) -> Result<()> {
        let query = r#"
            INSERT OR REPLACE INTO user_settings (
                user_id, theme, language, timezone, notifications_enabled, sound_enabled,
                auto_start_trading, default_risk_percentage, dashboard_layout, chart_preferences,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;
        
        sqlx::query(query)
            .bind(&settings.user_id)
            .bind(&settings.theme)
            .bind(&settings.language)
            .bind(&settings.timezone)
            .bind(settings.notifications_enabled)
            .bind(settings.sound_enabled)
            .bind(settings.auto_start_trading)
            .bind(settings.default_risk_percentage)
            .bind(settings.dashboard_layout.to_string())
            .bind(settings.chart_preferences.to_string())
            .bind(settings.created_at)
            .bind(Utc::now())
            .execute(self.database.get_pool())
            .await
            .map_err(|e| HedgeXError::DatabaseError(e))?;
        
        debug!("User settings saved for user: {}", settings.user_id);
        Ok(())
    }
    
    /// Load user settings
    pub async fn load_user_settings(&self, user_id: &str) -> Result<UserSettings> {
        let query = r#"
            SELECT user_id, theme, language, timezone, notifications_enabled, sound_enabled,
                   auto_start_trading, default_risk_percentage, dashboard_layout, chart_preferences,
                   created_at, updated_at
            FROM user_settings
            WHERE user_id = ?
        "#;
        
        let row = sqlx::query(query)
            .bind(user_id)
            .fetch_optional(self.database.get_pool())
            .await
            .map_err(|e| HedgeXError::DatabaseError(e))?;
        
        match row {
            Some(row) => {
                let dashboard_layout: String = row.get("dashboard_layout");
                let chart_preferences: String = row.get("chart_preferences");
                
                Ok(UserSettings {
                    user_id: row.get("user_id"),
                    theme: row.get("theme"),
                    language: row.get("language"),
                    timezone: row.get("timezone"),
                    notifications_enabled: row.get("notifications_enabled"),
                    sound_enabled: row.get("sound_enabled"),
                    auto_start_trading: row.get("auto_start_trading"),
                    default_risk_percentage: row.get("default_risk_percentage"),
                    dashboard_layout: serde_json::from_str(&dashboard_layout)
                        .unwrap_or_else(|_| serde_json::json!({})),
                    chart_preferences: serde_json::from_str(&chart_preferences)
                        .unwrap_or_else(|_| serde_json::json!({})),
                    created_at: row.get("created_at"),
                    updated_at: row.get("updated_at"),
                })
            }
            None => {
                // Return default settings for new user
                let mut settings = UserSettings::default();
                settings.user_id = user_id.to_string();
                Ok(settings)
            }
        }
    }
    
    /// Clean up old logs based on retention policy
    pub async fn cleanup_old_logs(&self) -> Result<usize> {
        let span = span!(Level::INFO, "cleanup_old_logs");
        
        async move {
            info!("Cleaning up logs older than {} days", self.config.log_retention_days);
            
            let cutoff_date = Utc::now() - ChronoDuration::days(self.config.log_retention_days);
            
            let query = "DELETE FROM system_logs WHERE created_at < ?";
            let result = sqlx::query(query)
                .bind(cutoff_date)
                .execute(self.database.get_pool())
                .await
                .map_err(|e| HedgeXError::DatabaseError(e))?;
            
            let deleted_count = result.rows_affected() as usize;
            
            // Log cleanup results
            {
                let mut logger_guard = self.logger.lock().await;
                let mut data = std::collections::HashMap::new();
                data.insert("deleted_count".to_string(), serde_json::Value::Number(serde_json::Number::from(deleted_count)));
                data.insert("retention_days".to_string(), serde_json::Value::Number(serde_json::Number::from(self.config.log_retention_days)));
                
                let _ = logger_guard.info_structured(
                    "Old logs cleaned up successfully",
                    Some("persistence"),
                    data
                ).await;
            }
            
            info!("Cleaned up {} old log entries", deleted_count);
            Ok(deleted_count)
        }
        .instrument(span)
        .await
    }
    
    /// Archive old trade data
    pub async fn archive_old_trade_data(&self) -> Result<usize> {
        let span = span!(Level::INFO, "archive_old_trade_data");
        
        async move {
            info!("Archiving trade data older than {} days", self.config.trade_data_retention_days);
            
            let cutoff_date = Utc::now() - ChronoDuration::days(self.config.trade_data_retention_days);
            
            // First, export old trade data to archive
            let archive_filename = format!("archived_trades_{}.json", Utc::now().format("%Y%m%d"));
            let archive_path = self.export_dir.join(&archive_filename);
            
            let query = r#"
                SELECT id, user_id, symbol, exchange, order_id, trade_type, quantity, price, 
                       status, executed_at, strategy_id
                FROM trades 
                WHERE executed_at < ?
                ORDER BY executed_at
            "#;
            
            let rows = sqlx::query(query)
                .bind(cutoff_date)
                .fetch_all(self.database.get_pool())
                .await
                .map_err(|e| HedgeXError::DatabaseError(e))?;
            
            if rows.is_empty() {
                debug!("No old trade data to archive");
                return Ok(0);
            }
            
            // Convert to JSON and save archive
            let mut archived_trades = Vec::new();
            for row in &rows {
                archived_trades.push(serde_json::json!({
                    "id": row.get::<String, _>("id"),
                    "user_id": row.get::<String, _>("user_id"),
                    "symbol": row.get::<String, _>("symbol"),
                    "exchange": row.get::<String, _>("exchange"),
                    "order_id": row.get::<Option<String>, _>("order_id"),
                    "trade_type": row.get::<String, _>("trade_type"),
                    "quantity": row.get::<i32, _>("quantity"),
                    "price": row.get::<f64, _>("price"),
                    "status": row.get::<String, _>("status"),
                    "executed_at": row.get::<DateTime<Utc>, _>("executed_at").to_rfc3339(),
                    "strategy_id": row.get::<String, _>("strategy_id"),
                }));
            }
            
            let archive_data = serde_json::to_string_pretty(&archived_trades)
                .map_err(|e| HedgeXError::InternalError(format!("Failed to serialize archive data: {}", e)))?;
            
            // Compress archive data
            let compressed_data = self.compress_data(archive_data.as_bytes())?;
            
            tokio::fs::write(&archive_path, compressed_data).await
                .map_err(|e| HedgeXError::InternalError(format!("Failed to write archive file: {}", e)))?;
            
            // Delete archived trades from main table
            let delete_query = "DELETE FROM trades WHERE executed_at < ?";
            let result = sqlx::query(delete_query)
                .bind(cutoff_date)
                .execute(self.database.get_pool())
                .await
                .map_err(|e| HedgeXError::DatabaseError(e))?;
            
            let archived_count = result.rows_affected() as usize;
            
            // Log archival results
            {
                let mut logger_guard = self.logger.lock().await;
                let mut data = std::collections::HashMap::new();
                data.insert("archived_count".to_string(), serde_json::Value::Number(serde_json::Number::from(archived_count)));
                data.insert("archive_file".to_string(), serde_json::Value::String(archive_filename));
                
                let _ = logger_guard.info_structured(
                    "Old trade data archived successfully",
                    Some("persistence"),
                    data
                ).await;
            }
            
            info!("Archived {} old trade records to: {:?}", archived_count, archive_path);
            Ok(archived_count)
        }
        .instrument(span)
        .await
    }
    
    /// Perform secure data deletion for application uninstall
    pub async fn secure_delete_all_data(&self) -> Result<()> {
        let span = span!(Level::WARN, "secure_delete_all_data");
        
        async move {
            warn!("Performing secure deletion of all application data");
            
            // Log the deletion attempt
            {
                let mut logger_guard = self.logger.lock().await;
                let _ = logger_guard.warning("Secure data deletion initiated", Some("persistence")).await;
            }
            
            // Delete all database tables
            let tables = vec![
                "session_tokens",
                "system_logs", 
                "trades",
                "strategy_performance",
                "stock_selection",
                "strategy_params",
                "api_credentials",
                "user_settings",
                "backup_metadata",
                "users",
                "market_data_cache",
            ];
            
            for table in tables {
                let query = format!("DELETE FROM {}", table);
                if let Err(e) = sqlx::query(&query).execute(self.database.get_pool()).await {
                    warn!("Failed to delete table {}: {}", table, e);
                }
            }
            
            // Securely overwrite database file
            let db_path = self.app_data_dir.join("hedgex.db");
            if db_path.exists() {
                self.secure_overwrite_file(&db_path).await?;
            }
            
            // Delete backup files
            if self.backup_dir.exists() {
                self.secure_delete_directory(&self.backup_dir).await?;
            }
            
            // Delete export files
            if self.export_dir.exists() {
                self.secure_delete_directory(&self.export_dir).await?;
            }
            
            // Delete log files
            let log_dir = self.app_data_dir.join("logs");
            if log_dir.exists() {
                self.secure_delete_directory(&log_dir).await?;
            }
            
            warn!("Secure data deletion completed");
            Ok(())
        }
        .instrument(span)
        .await
    }
    
    /// Get data persistence configuration
    pub fn get_config(&self) -> &DataPersistenceConfig {
        &self.config
    }
    
    /// Update data persistence configuration
    pub async fn update_config(&mut self, config: DataPersistenceConfig) -> Result<()> {
        self.config = config;
        
        // Log configuration update
        {
            let mut logger_guard = self.logger.lock().await;
            let _ = logger_guard.info("Data persistence configuration updated", Some("persistence")).await;
        }
        
        Ok(())
    }
    
    // Private helper methods
    
    /// Save backup metadata to database
    async fn save_backup_metadata(&self, metadata: &BackupMetadata) -> Result<()> {
        // Create backup_metadata table if it doesn't exist
        let create_table_query = r#"
            CREATE TABLE IF NOT EXISTS backup_metadata (
                backup_id TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                compressed BOOLEAN NOT NULL,
                encrypted BOOLEAN NOT NULL,
                checksum TEXT NOT NULL,
                backup_type TEXT NOT NULL
            )
        "#;
        
        sqlx::query(create_table_query)
            .execute(self.database.get_pool())
            .await
            .map_err(|e| HedgeXError::DatabaseError(e))?;
        
        let query = r#"
            INSERT INTO backup_metadata (
                backup_id, label, created_at, file_path, file_size, compressed, encrypted, checksum, backup_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;
        
        let backup_type_str = match metadata.backup_type {
            BackupType::Automatic => "Automatic",
            BackupType::Manual => "Manual",
            BackupType::PreMigration => "PreMigration",
            BackupType::PreUpdate => "PreUpdate",
        };
        
        sqlx::query(query)
            .bind(&metadata.id)
            .bind(&metadata.label)
            .bind(metadata.created_at)
            .bind(metadata.file_path.to_string_lossy().to_string())
            .bind(metadata.file_size as i64)
            .bind(metadata.compressed)
            .bind(metadata.encrypted)
            .bind(&metadata.checksum)
            .bind(backup_type_str)
            .execute(self.database.get_pool())
            .await
            .map_err(|e| HedgeXError::DatabaseError(e))?;
        
        Ok(())
    }
    
    /// Get backup metadata by ID
    async fn get_backup_metadata(&self, backup_id: &str) -> Result<BackupMetadata> {
        let query = r#"
            SELECT backup_id, label, created_at, file_path, file_size, compressed, encrypted, checksum, backup_type
            FROM backup_metadata
            WHERE backup_id = ?
        "#;
        
        let row = sqlx::query(query)
            .bind(backup_id)
            .fetch_optional(self.database.get_pool())
            .await
            .map_err(|e| HedgeXError::DatabaseError(e))?;
        
        match row {
            Some(row) => {
                let backup_type_str: String = row.get("backup_type");
                let backup_type = match backup_type_str.as_str() {
                    "Automatic" => BackupType::Automatic,
                    "Manual" => BackupType::Manual,
                    "PreMigration" => BackupType::PreMigration,
                    "PreUpdate" => BackupType::PreUpdate,
                    _ => BackupType::Manual,
                };
                
                Ok(BackupMetadata {
                    id: row.get("backup_id"),
                    label: row.get("label"),
                    created_at: row.get("created_at"),
                    file_path: PathBuf::from(row.get::<String, _>("file_path")),
                    file_size: row.get::<i64, _>("file_size") as u64,
                    compressed: row.get("compressed"),
                    encrypted: row.get("encrypted"),
                    checksum: row.get("checksum"),
                    backup_type,
                })
            }
            None => Err(HedgeXError::NotFoundError(format!("Backup not found: {}", backup_id)))
        }
    }
    
    /// Delete backup metadata
    async fn delete_backup_metadata(&self, backup_id: &str) -> Result<()> {
        let query = "DELETE FROM backup_metadata WHERE backup_id = ?";
        sqlx::query(query)
            .bind(backup_id)
            .execute(self.database.get_pool())
            .await
            .map_err(|e| HedgeXError::DatabaseError(e))?;
        
        Ok(())
    }
    
    /// Compress data using gzip
    fn compress_data(&self, data: &[u8]) -> Result<Vec<u8>> {
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(data)
            .map_err(|e| HedgeXError::CompressionError(format!("Failed to compress data: {}", e)))?;
        encoder.finish()
            .map_err(|e| HedgeXError::CompressionError(format!("Failed to finish compression: {}", e)))
    }
    
    /// Decompress gzip data
    fn decompress_data(&self, data: &[u8]) -> Result<Vec<u8>> {
        let mut decoder = GzDecoder::new(data);
        let mut decompressed = Vec::new();
        decoder.read_to_end(&mut decompressed)
            .map_err(|e| HedgeXError::CompressionError(format!("Failed to decompress data: {}", e)))?;
        Ok(decompressed)
    }
    
    /// Export all user data
    async fn export_all_data(&self, request: &DataExportRequest) -> Result<serde_json::Value> {
        let mut all_data = serde_json::Map::new();
        
        // Export user settings
        if let Ok(settings) = self.load_user_settings(&request.user_id).await {
            all_data.insert("user_settings".to_string(), serde_json::to_value(settings)?);
        }
        
        // Export trade history
        let trade_data = self.export_trade_history(request).await?;
        all_data.insert("trade_history".to_string(), trade_data);
        
        // Export strategy data
        let strategy_data = self.export_strategy_data(request).await?;
        all_data.insert("strategy_data".to_string(), strategy_data);
        
        // Export system logs if requested
        if request.include_sensitive {
            let log_data = self.export_system_logs(request).await?;
            all_data.insert("system_logs".to_string(), log_data);
        }
        
        Ok(serde_json::Value::Object(all_data))
    }
    
    /// Export trade history
    async fn export_trade_history(&self, request: &DataExportRequest) -> Result<serde_json::Value> {
        let mut query = r#"
            SELECT id, symbol, exchange, order_id, trade_type, quantity, price, 
                   status, executed_at, strategy_id
            FROM trades 
            WHERE user_id = ?
        "#.to_string();
        
        let mut bind_values: Vec<Box<dyn sqlx::Encode<'_, sqlx::Sqlite> + Send + Sync>> = vec![
            Box::new(request.user_id.clone())
        ];
        
        if let Some((start_date, end_date)) = request.date_range {
            query.push_str(" AND executed_at BETWEEN ? AND ?");
            bind_values.push(Box::new(start_date));
            bind_values.push(Box::new(end_date));
        }
        
        query.push_str(" ORDER BY executed_at DESC");
        
        let mut sqlx_query = sqlx::query(&query);
        for value in bind_values {
            // This is a simplified approach - in practice you'd need proper dynamic binding
            sqlx_query = sqlx_query.bind(request.user_id.clone());
        }
        
        let rows = sqlx_query
            .fetch_all(self.database.get_pool())
            .await
            .map_err(|e| HedgeXError::DatabaseError(e))?;
        
        let trades: Vec<serde_json::Value> = rows
            .into_iter()
            .map(|row| {
                serde_json::json!({
                    "id": row.get::<String, _>("id"),
                    "symbol": row.get::<String, _>("symbol"),
                    "exchange": row.get::<String, _>("exchange"),
                    "order_id": row.get::<Option<String>, _>("order_id"),
                    "trade_type": row.get::<String, _>("trade_type"),
                    "quantity": row.get::<i32, _>("quantity"),
                    "price": row.get::<f64, _>("price"),
                    "status": row.get::<String, _>("status"),
                    "executed_at": row.get::<DateTime<Utc>, _>("executed_at").to_rfc3339(),
                    "strategy_id": row.get::<String, _>("strategy_id"),
                })
            })
            .collect();
        
        Ok(serde_json::Value::Array(trades))
    }
    
    /// Export strategy data
    async fn export_strategy_data(&self, request: &DataExportRequest) -> Result<serde_json::Value> {
        let query = r#"
            SELECT id, name, description, enabled, max_trades_per_day, risk_percentage,
                   stop_loss_percentage, take_profit_percentage, volume_threshold,
                   created_at, updated_at
            FROM strategy_params 
            WHERE user_id = ?
            ORDER BY created_at DESC
        "#;
        
        let rows = sqlx::query(query)
            .bind(&request.user_id)
            .fetch_all(self.database.get_pool())
            .await
            .map_err(|e| HedgeXError::DatabaseError(e))?;
        
        let strategies: Vec<serde_json::Value> = rows
            .into_iter()
            .map(|row| {
                serde_json::json!({
                    "id": row.get::<String, _>("id"),
                    "name": row.get::<String, _>("name"),
                    "description": row.get::<Option<String>, _>("description"),
                    "enabled": row.get::<bool, _>("enabled"),
                    "max_trades_per_day": row.get::<i32, _>("max_trades_per_day"),
                    "risk_percentage": row.get::<f64, _>("risk_percentage"),
                    "stop_loss_percentage": row.get::<f64, _>("stop_loss_percentage"),
                    "take_profit_percentage": row.get::<f64, _>("take_profit_percentage"),
                    "volume_threshold": row.get::<i64, _>("volume_threshold"),
                    "created_at": row.get::<DateTime<Utc>, _>("created_at").to_rfc3339(),
                    "updated_at": row.get::<DateTime<Utc>, _>("updated_at").to_rfc3339(),
                })
            })
            .collect();
        
        Ok(serde_json::Value::Array(strategies))
    }
    
    /// Export user settings
    async fn export_user_settings(&self, request: &DataExportRequest) -> Result<serde_json::Value> {
        let settings = self.load_user_settings(&request.user_id).await?;
        serde_json::to_value(settings)
            .map_err(|e| HedgeXError::InternalError(format!("Failed to serialize user settings: {}", e)))
    }
    
    /// Export system logs
    async fn export_system_logs(&self, request: &DataExportRequest) -> Result<serde_json::Value> {
        let mut query = r#"
            SELECT id, log_level, message, created_at, context
            FROM system_logs 
            WHERE user_id = ? OR user_id IS NULL
        "#.to_string();
        
        if let Some((start_date, end_date)) = request.date_range {
            query.push_str(" AND created_at BETWEEN ? AND ?");
        }
        
        query.push_str(" ORDER BY created_at DESC LIMIT 1000");
        
        let mut sqlx_query = sqlx::query(&query).bind(&request.user_id);
        
        if let Some((start_date, end_date)) = request.date_range {
            sqlx_query = sqlx_query.bind(start_date).bind(end_date);
        }
        
        let rows = sqlx_query
            .fetch_all(self.database.get_pool())
            .await
            .map_err(|e| HedgeXError::DatabaseError(e))?;
        
        let logs: Vec<serde_json::Value> = rows
            .into_iter()
            .map(|row| {
                serde_json::json!({
                    "id": row.get::<String, _>("id"),
                    "log_level": row.get::<i32, _>("log_level"),
                    "message": row.get::<String, _>("message"),
                    "created_at": row.get::<DateTime<Utc>, _>("created_at").to_rfc3339(),
                    "context": row.get::<Option<String>, _>("context"),
                })
            })
            .collect();
        
        Ok(serde_json::Value::Array(logs))
    }
    
    /// Format data as CSV
    fn format_as_csv(&self, data: &serde_json::Value) -> Result<String> {
        // This is a simplified CSV formatter
        // In a real implementation, you'd want a proper CSV library
        match data {
            serde_json::Value::Array(items) => {
                if items.is_empty() {
                    return Ok(String::new());
                }
                
                let mut csv = String::new();
                
                // Extract headers from first item
                if let Some(first_item) = items.first() {
                    if let serde_json::Value::Object(obj) = first_item {
                        let headers: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
                        csv.push_str(&headers.join(","));
                        csv.push('\n');
                        
                        // Add data rows
                        for item in items {
                            if let serde_json::Value::Object(obj) = item {
                                let values: Vec<String> = headers
                                    .iter()
                                    .map(|header| {
                                        obj.get(*header)
                                            .map(|v| match v {
                                                serde_json::Value::String(s) => format!("\"{}\"", s.replace("\"", "\"\"")),
                                                _ => v.to_string(),
                                            })
                                            .unwrap_or_default()
                                    })
                                    .collect();
                                csv.push_str(&values.join(","));
                                csv.push('\n');
                            }
                        }
                    }
                }
                
                Ok(csv)
            }
            _ => Err(HedgeXError::ValidationError("CSV format only supports arrays of objects".to_string()))
        }
    }
    
    /// Format data as SQL
    fn format_as_sql(&self, data: &serde_json::Value) -> Result<String> {
        // This is a simplified SQL formatter
        match data {
            serde_json::Value::Array(items) => {
                if items.is_empty() {
                    return Ok(String::new());
                }
                
                let mut sql = String::new();
                
                // This would need to be implemented based on the specific data structure
                sql.push_str("-- SQL export not fully implemented\n");
                sql.push_str("-- Use JSON format for complete data export\n");
                
                Ok(sql)
            }
            _ => Err(HedgeXError::ValidationError("SQL format only supports arrays of objects".to_string()))
        }
    }
    
    /// Securely overwrite a file with random data
    async fn secure_overwrite_file(&self, file_path: &Path) -> Result<()> {
        if !file_path.exists() {
            return Ok(());
        }
        
        let file_size = tokio::fs::metadata(file_path).await
            .map_err(|e| HedgeXError::InternalError(format!("Failed to get file metadata: {}", e)))?
            .len();
        
        // Overwrite with random data multiple times
        for _ in 0..3 {
            let random_data = self.crypto_service.generate_random_bytes(file_size as usize)?;
            tokio::fs::write(file_path, random_data).await
                .map_err(|e| HedgeXError::InternalError(format!("Failed to overwrite file: {}", e)))?;
        }
        
        // Finally delete the file
        tokio::fs::remove_file(file_path).await
            .map_err(|e| HedgeXError::InternalError(format!("Failed to delete file: {}", e)))?;
        
        Ok(())
    }
    
    /// Securely delete a directory and all its contents
    fn secure_delete_directory<'a>(&'a self, dir_path: &'a Path) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<()>> + Send + 'a>> {
        Box::pin(async move {
            if !dir_path.exists() {
                return Ok(());
            }
            
            let mut entries = tokio::fs::read_dir(dir_path).await
                .map_err(|e| HedgeXError::InternalError(format!("Failed to read directory: {}", e)))?;
            
            while let Some(entry) = entries.next_entry().await
                .map_err(|e| HedgeXError::InternalError(format!("Failed to read directory entry: {}", e)))? 
            {
                let path = entry.path();
                if path.is_file() {
                    self.secure_overwrite_file(&path).await?;
                } else if path.is_dir() {
                    self.secure_delete_directory(&path).await?;
                }
            }
            
            tokio::fs::remove_dir(dir_path).await
                .map_err(|e| HedgeXError::InternalError(format!("Failed to remove directory: {}", e)))?;
            
            Ok(())
        })
    }
}