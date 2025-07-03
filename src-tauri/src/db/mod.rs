use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite, Executor};
use std::path::{Path, PathBuf};
use anyhow::{Result, Context};
use std::fs as std_fs;

/// Database connection pool for SQLite
pub struct Database {
    pub pool: Pool<Sqlite>,
}

impl Database {
    /// Initialize a new database connection
    pub async fn new(app_data_dir: &Path) -> Result<Self> {
        // Ensure the data directory exists using std::fs (non-async)
        if !app_data_dir.exists() {
            std_fs::create_dir_all(app_data_dir)
                .context("Failed to create app data directory")?;
            println!("Created directory: {:?}", app_data_dir);
        }

        let db_path = app_data_dir.join("hedgex.db");
        
        // Check if database file exists
        let db_exists = db_path.exists();
        
        // Ensure SQLite URI has the correct format with ?mode=rwc
        let db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());

        println!("Using database at: {}", db_path.to_string_lossy());
        println!("Database URL: {}", db_url);
        println!("Database exists: {}", db_exists);

        // Create connection pool
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&db_url)
            .await
            .context("Failed to connect to SQLite database")?;

        // Try to find migrations in different locations
        let migration_paths: Vec<PathBuf> = vec![
            PathBuf::from("./migrations"),                 // Root project dir
            PathBuf::from("./src-tauri/migrations"),       // Src-tauri dir
            PathBuf::from("../migrations"),                // One level up (for debug builds)
            PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default()).join("migrations"), // Cargo manifest dir
        ];

        let mut migrator = None;
        
        // Try each migration path until one works
        for path in migration_paths {
            if path.exists() {
                println!("Found migrations at: {:?}", path);
                match sqlx::migrate::Migrator::new(&*path).await {
                    Ok(m) => {
                        migrator = Some(m);
                        break;
                    },
                    Err(e) => {
                        println!("Failed to create migrator from path {:?}: {}", path, e);
                        continue;
                    }
                }
            }
        }

        // Run migrations if found
        match migrator {
            Some(m) => {
                m.run(&pool).await.context("Failed to run database migrations")?;
                println!("Database migrations completed successfully");
            },
            None => {
                // Fallback: Create database schema manually if migrations can't be found
                let schema = include_str!("../../migrations/20250703_initial_schema.sql");
                pool.execute(schema)
                    .await
                    .context("Failed to create database schema manually")?;
                println!("Created database schema manually (no migrations found)");
            }
        }

        Ok(Self { pool })
    }

    /// Get a connection from the pool
    pub fn get_pool(&self) -> &Pool<Sqlite> {
        &self.pool
    }
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
