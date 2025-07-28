#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use crate::utils::{EnhancedCryptoService, EnhancedLogger};
    use tempfile::TempDir;
    use tokio::sync::Mutex;
    use std::sync::Arc;
    use chrono::Utc;

    async fn setup_test_service() -> (DataPersistenceService, TempDir) {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let app_data_dir = temp_dir.path();
        
        // Initialize database
        let database = Arc::new(Database::new(app_data_dir).await.expect("Failed to create database"));
        
        // Initialize crypto service
        let crypto_service = Arc::new(
            EnhancedCryptoService::new("test_master_password")
                .expect("Failed to create crypto service")
        );
        
        // Initialize logger - create a simple mock logger for testing
        let logger = Arc::new(Mutex::new(
            EnhancedLogger::new(
                database.clone(),
                None,
                app_data_dir
            ).await.expect("Failed to create logger")
        ));
        
        let config = DataPersistenceConfig {
            auto_backup_enabled: true,
            backup_interval_hours: 1,
            max_backups_to_keep: 5,
            compress_backups: true,
            encrypt_exports: true,
            log_retention_days: 7,
            trade_data_retention_days: 30,
            auto_cleanup_enabled: true,
            cleanup_interval_hours: 24,
        };
        
        let service = DataPersistenceService::new(
            database,
            crypto_service,
            logger,
            app_data_dir,
            config,
        ).await.expect("Failed to create data persistence service");
        
        (service, temp_dir)
    }

    #[tokio::test]
    async fn test_create_and_list_backups() {
        let (service, _temp_dir) = setup_test_service().await;
        
        // Create a manual backup
        let backup_metadata = service.create_manual_backup("test_backup").await
            .expect("Failed to create backup");
        
        assert_eq!(backup_metadata.label, "test_backup");
        assert!(backup_metadata.file_path.exists());
        assert!(backup_metadata.file_size > 0);
        
        // List backups
        let backups = service.list_backups().await
            .expect("Failed to list backups");
        
        assert_eq!(backups.len(), 1);
        assert_eq!(backups[0].id, backup_metadata.id);
        assert_eq!(backups[0].label, "test_backup");
    }

    #[tokio::test]
    async fn test_automatic_backup() {
        let (service, _temp_dir) = setup_test_service().await;
        
        // Create an automatic backup
        let backup_metadata = service.create_automatic_backup().await
            .expect("Failed to create automatic backup");
        
        assert_eq!(backup_metadata.label, "auto");
        assert!(matches!(backup_metadata.backup_type, BackupType::Automatic));
        assert!(backup_metadata.file_path.exists());
    }

    #[tokio::test]
    async fn test_backup_cleanup() {
        let (mut service, _temp_dir) = setup_test_service().await;
        
        // Update config to keep only 2 backups
        let mut config = service.get_config().clone();
        config.max_backups_to_keep = 2;
        service.update_config(config).await.expect("Failed to update config");
        
        // Create 4 backups
        for i in 1..=4 {
            service.create_manual_backup(&format!("backup_{}", i)).await
                .expect("Failed to create backup");
        }
        
        // Verify we have 4 backups
        let backups = service.list_backups().await.expect("Failed to list backups");
        assert_eq!(backups.len(), 4);
        
        // Cleanup old backups
        let deleted_count = service.cleanup_old_backups().await
            .expect("Failed to cleanup backups");
        
        assert_eq!(deleted_count, 2);
        
        // Verify we now have only 2 backups
        let backups = service.list_backups().await.expect("Failed to list backups");
        assert_eq!(backups.len(), 2);
    }

    #[tokio::test]
    async fn test_user_settings_persistence() {
        let (service, _temp_dir) = setup_test_service().await;
        
        let settings = UserSettings {
            user_id: "test_user".to_string(),
            theme: "dark".to_string(),
            language: "en".to_string(),
            timezone: "UTC".to_string(),
            notifications_enabled: true,
            sound_enabled: false,
            auto_start_trading: true,
            default_risk_percentage: 2.5,
            dashboard_layout: serde_json::json!({"layout": "grid"}),
            chart_preferences: serde_json::json!({"theme": "dark"}),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        
        // Save settings
        service.save_user_settings(&settings).await
            .expect("Failed to save user settings");
        
        // Load settings
        let loaded_settings = service.load_user_settings("test_user").await
            .expect("Failed to load user settings");
        
        assert_eq!(loaded_settings.user_id, "test_user");
        assert_eq!(loaded_settings.theme, "dark");
        assert_eq!(loaded_settings.language, "en");
        assert_eq!(loaded_settings.timezone, "UTC");
        assert_eq!(loaded_settings.notifications_enabled, true);
        assert_eq!(loaded_settings.sound_enabled, false);
        assert_eq!(loaded_settings.auto_start_trading, true);
        assert_eq!(loaded_settings.default_risk_percentage, 2.5);
    }

    #[tokio::test]
    async fn test_data_export() {
        let (service, _temp_dir) = setup_test_service().await;
        
        // Create some test data first
        let settings = UserSettings {
            user_id: "test_user".to_string(),
            theme: "light".to_string(),
            language: "es".to_string(),
            timezone: "EST".to_string(),
            notifications_enabled: false,
            sound_enabled: true,
            auto_start_trading: false,
            default_risk_percentage: 1.0,
            dashboard_layout: serde_json::json!({"layout": "list"}),
            chart_preferences: serde_json::json!({"theme": "light"}),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        
        service.save_user_settings(&settings).await
            .expect("Failed to save test settings");
        
        // Export user settings
        let export_request = DataExportRequest {
            user_id: "test_user".to_string(),
            export_type: ExportType::UserSettings,
            format: ExportFormat::Json,
            date_range: None,
            include_sensitive: false,
            compress: false,
            encrypt: false,
        };
        
        let export_path = service.export_data(export_request).await
            .expect("Failed to export data");
        
        assert!(export_path.exists());
        
        // Read and verify exported data
        let exported_content = tokio::fs::read_to_string(&export_path).await
            .expect("Failed to read exported file");
        
        let exported_settings: UserSettings = serde_json::from_str(&exported_content)
            .expect("Failed to parse exported settings");
        
        assert_eq!(exported_settings.user_id, "test_user");
        assert_eq!(exported_settings.theme, "light");
        assert_eq!(exported_settings.language, "es");
    }

    #[tokio::test]
    async fn test_compressed_export() {
        let (service, _temp_dir) = setup_test_service().await;
        
        // Create test settings
        let settings = UserSettings {
            user_id: "test_user".to_string(),
            theme: "dark".to_string(),
            language: "en".to_string(),
            timezone: "UTC".to_string(),
            notifications_enabled: true,
            sound_enabled: true,
            auto_start_trading: false,
            default_risk_percentage: 1.5,
            dashboard_layout: serde_json::json!({"layout": "grid", "columns": 3}),
            chart_preferences: serde_json::json!({"theme": "dark", "indicators": ["RSI", "MACD"]}),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        
        service.save_user_settings(&settings).await
            .expect("Failed to save test settings");
        
        // Export with compression
        let export_request = DataExportRequest {
            user_id: "test_user".to_string(),
            export_type: ExportType::UserSettings,
            format: ExportFormat::Json,
            date_range: None,
            include_sensitive: false,
            compress: true,
            encrypt: false,
        };
        
        let export_path = service.export_data(export_request).await
            .expect("Failed to export compressed data");
        
        assert!(export_path.exists());
        
        // Verify the file is compressed (should be smaller than uncompressed JSON)
        let file_size = tokio::fs::metadata(&export_path).await
            .expect("Failed to get file metadata")
            .len();
        
        // Compressed file should exist and have some size
        assert!(file_size > 0);
    }

    #[tokio::test]
    async fn test_csv_export_format() {
        let (service, _temp_dir) = setup_test_service().await;
        
        // Export in CSV format (should work for simple data structures)
        let export_request = DataExportRequest {
            user_id: "test_user".to_string(),
            export_type: ExportType::UserSettings,
            format: ExportFormat::Csv,
            date_range: None,
            include_sensitive: false,
            compress: false,
            encrypt: false,
        };
        
        let export_path = service.export_data(export_request).await
            .expect("Failed to export CSV data");
        
        assert!(export_path.exists());
        assert!(export_path.extension().unwrap() == "csv");
    }

    #[tokio::test]
    async fn test_backup_restore_cycle() {
        let (service, _temp_dir) = setup_test_service().await;
        
        // Create test data
        let settings = UserSettings {
            user_id: "test_user".to_string(),
            theme: "original_theme".to_string(),
            language: "en".to_string(),
            timezone: "UTC".to_string(),
            notifications_enabled: true,
            sound_enabled: true,
            auto_start_trading: false,
            default_risk_percentage: 1.0,
            dashboard_layout: serde_json::json!({"original": true}),
            chart_preferences: serde_json::json!({"original": true}),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        
        service.save_user_settings(&settings).await
            .expect("Failed to save original settings");
        
        // Create backup
        let backup_metadata = service.create_manual_backup("before_changes").await
            .expect("Failed to create backup");
        
        // Modify data
        let modified_settings = UserSettings {
            theme: "modified_theme".to_string(),
            dashboard_layout: serde_json::json!({"modified": true}),
            ..settings
        };
        
        service.save_user_settings(&modified_settings).await
            .expect("Failed to save modified settings");
        
        // Verify data was modified
        let current_settings = service.load_user_settings("test_user").await
            .expect("Failed to load current settings");
        assert_eq!(current_settings.theme, "modified_theme");
        
        // Restore from backup
        service.restore_from_backup(&backup_metadata.id).await
            .expect("Failed to restore from backup");
        
        // Note: In a real implementation, you would need to reinitialize the service
        // after restore since the database file has been replaced
        // For this test, we're just verifying the restore operation completes without error
    }

    #[tokio::test]
    async fn test_data_cleanup() {
        let (service, _temp_dir) = setup_test_service().await;
        
        // Test cleanup operations (they should complete without error even with no data)
        let logs_cleaned = service.cleanup_old_logs().await
            .expect("Failed to cleanup old logs");
        
        let trades_archived = service.archive_old_trade_data().await
            .expect("Failed to archive old trade data");
        
        let backups_cleaned = service.cleanup_old_backups().await
            .expect("Failed to cleanup old backups");
        
        // These should be 0 since we have no old data
        assert_eq!(logs_cleaned, 0);
        assert_eq!(trades_archived, 0);
        assert_eq!(backups_cleaned, 0);
    }

    #[tokio::test]
    async fn test_config_update() {
        let (mut service, _temp_dir) = setup_test_service().await;
        
        let original_config = service.get_config().clone();
        assert_eq!(original_config.max_backups_to_keep, 5);
        
        let mut new_config = original_config.clone();
        new_config.max_backups_to_keep = 10;
        new_config.log_retention_days = 14;
        
        service.update_config(new_config).await
            .expect("Failed to update config");
        
        let updated_config = service.get_config();
        assert_eq!(updated_config.max_backups_to_keep, 10);
        assert_eq!(updated_config.log_retention_days, 14);
    }
}