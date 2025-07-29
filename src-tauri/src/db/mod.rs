use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite, Executor, migrate::Migrator};
use std::path::{Path, PathBuf};
use anyhow::{Result, Context};
use std::fs as std_fs;
use tracing::{info, warn, error, debug};
use crate::error::{HedgeXError, Result as HedgeXResult};

/// Enhanced database connection pool for SQLite with migration support
pub struct Database {
    pub pool: Pool<Sqlite>,
    pub migrator: Option<Migrator>,
}

impl Clone for Database {
    fn clone(&self) -> Self {
        Self {
            pool: self.pool.clone(),
            migrator: None, // Migrator doesn't need to be cloned for most use cases
        }
    }
}

impl std::fmt::Debug for Database {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Database")
            .field("pool", &"Pool<Sqlite>")
            .field("migrator", &self.migrator.is_some())
            .finish()
    }
}

/// Database configuration options
#[derive(Debug, Clone)]
pub struct DatabaseConfig {
    pub max_connections: u32,
    pub connection_timeout_secs: u64,
    pub idle_timeout_secs: u64,
    pub enable_wal_mode: bool,
    pub enable_foreign_keys: bool,
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            max_connections: 10,
            connection_timeout_secs: 30,
            idle_timeout_secs: 600, // 10 minutes
            enable_wal_mode: true,
            enable_foreign_keys: true,
        }
    }
}

impl Database {
    /// Initialize a new database connection with default configuration
    pub async fn new(app_data_dir: &Path) -> Result<Self> {
        Self::new_with_config(app_data_dir, DatabaseConfig::default()).await
    }
    
    /// Initialize a new database connection with custom configuration
    pub async fn new_with_config(app_data_dir: &Path, config: DatabaseConfig) -> Result<Self> {
        debug!("Initializing database with config: {:?}", config);
        
        // Ensure the data directory exists using std::fs (non-async)
        if !app_data_dir.exists() {
            std_fs::create_dir_all(app_data_dir)
                .context("Failed to create app data directory")?;
            info!("Created directory: {:?}", app_data_dir);
        }

        let db_path = app_data_dir.join("hedgex.db");
        
        // Check if database file exists
        let db_exists = db_path.exists();
        
        // Build SQLite connection string with optimizations
        let mut db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());
        
        if config.enable_wal_mode {
            db_url.push_str("&journal_mode=WAL");
        }
        if config.enable_foreign_keys {
            db_url.push_str("&foreign_keys=on");
        }
        
        // Add performance optimizations
        db_url.push_str("&synchronous=NORMAL&cache_size=-64000&temp_store=memory");

        info!("Using database at: {}", db_path.to_string_lossy());
        debug!("Database URL: {}", db_url);
        info!("Database exists: {}", db_exists);

        // Create connection pool with enhanced configuration
        let pool = SqlitePoolOptions::new()
            .max_connections(config.max_connections)
            .acquire_timeout(std::time::Duration::from_secs(config.connection_timeout_secs))
            .idle_timeout(std::time::Duration::from_secs(config.idle_timeout_secs))
            .test_before_acquire(true)
            .connect(&db_url)
            .await
            .context("Failed to connect to SQLite database")?;

        info!("Database connection pool created successfully");

        // Initialize migrator
        let migrator = Self::initialize_migrator().await?;

        // Run migrations if migrator is available
        if let Some(ref m) = migrator {
            info!("Running database migrations...");
            m.run(&pool).await
                .map_err(|e| anyhow::anyhow!("Failed to run database migrations: {}", e))?;
            info!("Database migrations completed successfully");
        } else {
            warn!("No migrator found, using fallback schema creation");
            // Fallback: Create database schema manually if migrations can't be found
            let schema = include_str!("../../migrations/20250703_initial_schema.sql");
            pool.execute(schema)
                .await
                .context("Failed to create database schema manually")?;
            info!("Created database schema manually (no migrations found)");
        }

        // Verify database integrity
        Self::verify_database_integrity(&pool).await?;

        Ok(Self { pool, migrator })
    }
    
    /// Initialize the migration system
    async fn initialize_migrator() -> Result<Option<Migrator>> {
        // Try to find migrations in different locations
        let migration_paths: Vec<PathBuf> = vec![
            PathBuf::from("./migrations"),                 // Root project dir
            PathBuf::from("./src-tauri/migrations"),       // Src-tauri dir
            PathBuf::from("../migrations"),                // One level up (for debug builds)
            PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default()).join("migrations"), // Cargo manifest dir
        ];

        // Try each migration path until one works
        for path in migration_paths {
            if path.exists() {
                debug!("Found migrations at: {:?}", path);
                match Migrator::new(&*path).await {
                    Ok(m) => {
                        info!("Migration system initialized from: {:?}", path);
                        return Ok(Some(m));
                    },
                    Err(e) => {
                        warn!("Failed to create migrator from path {:?}: {}", path, e);
                        continue;
                    }
                }
            }
        }
        
        warn!("No migration directory found");
        Ok(None)
    }
    
    /// Verify database integrity and basic functionality
    async fn verify_database_integrity(pool: &Pool<Sqlite>) -> Result<()> {
        debug!("Verifying database integrity...");
        
        // Check if we can perform basic operations
        let result: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
            .fetch_one(pool)
            .await
            .context("Failed to query database tables")?;
            
        info!("Database integrity verified. Found {} tables", result.0);
        
        // Run PRAGMA integrity_check
        let integrity: (String,) = sqlx::query_as("PRAGMA integrity_check")
            .fetch_one(pool)
            .await
            .context("Failed to run integrity check")?;
            
        if integrity.0 != "ok" {
            error!("Database integrity check failed: {}", integrity.0);
            return Err(anyhow::anyhow!("Database integrity check failed: {}", integrity.0));
        }
        
        debug!("Database integrity check passed");
        Ok(())
    }

    /// Get a connection from the pool
    pub fn get_pool(&self) -> &Pool<Sqlite> {
        &self.pool
    }
    
    /// Get the migrator if available
    pub fn get_migrator(&self) -> Option<&Migrator> {
        self.migrator.as_ref()
    }
    
    /// Run pending migrations
    pub async fn run_migrations(&self) -> HedgeXResult<()> {
        if let Some(migrator) = &self.migrator {
            info!("Running pending migrations...");
            migrator.run(&self.pool).await
                .map_err(|e| HedgeXError::DatabaseError(sqlx::Error::Migrate(Box::new(e))))?;
            info!("Migrations completed successfully");
        } else {
            warn!("No migrator available to run migrations");
        }
        Ok(())
    }
    
    /// Get database statistics
    pub async fn get_stats(&self) -> HedgeXResult<DatabaseStats> {
        let pool_stats = self.pool.size();
        
        // Get database file size
        let db_size: (i64,) = sqlx::query_as("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| HedgeXError::DatabaseError(e))?;
            
        // Get table counts
        let table_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
            .fetch_one(&self.pool)
            .await
            .map_err(|e| HedgeXError::DatabaseError(e))?;
            
        Ok(DatabaseStats {
            pool_size: pool_stats,
            database_size_bytes: db_size.0,
            table_count: table_count.0,
        })
    }
    
    /// Perform database maintenance operations
    pub async fn maintenance(&self) -> HedgeXResult<()> {
        info!("Starting database maintenance...");
        
        // Analyze tables for query optimization
        sqlx::query("ANALYZE")
            .execute(&self.pool)
            .await
            .map_err(|e| HedgeXError::DatabaseError(e))?;
            
        // Vacuum database to reclaim space (only if not in WAL mode during active use)
        sqlx::query("VACUUM")
            .execute(&self.pool)
            .await
            .map_err(|e| HedgeXError::DatabaseError(e))?;
            
        info!("Database maintenance completed");
        Ok(())
    }
    
    /// Close the database connection pool gracefully
    pub async fn close(self) {
        info!("Closing database connection pool...");
        self.pool.close().await;
        info!("Database connection pool closed");
    }
}

/// Database statistics for monitoring
#[derive(Debug, Clone)]
pub struct DatabaseStats {
    pub pool_size: u32,
    pub database_size_bytes: i64,
    pub table_count: i64,
}

// Error type for database operations
#[derive(Debug, thiserror::Error)]
pub enum DatabaseError {
    #[error("SQLx error: {0}")]
    Sqlx(#[from] sqlx::Error),

    #[error("Database initialization error: {0}")]
    Init(String),

    #[error("Database query error: {0}")]
    Query(String),

    #[error("Record not found")]
    NotFound,
}
