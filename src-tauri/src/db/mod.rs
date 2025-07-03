use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};
use std::path::Path;
use anyhow::Result;
use tokio::fs;

/// Database connection pool for SQLite
pub struct Database {
    pub pool: Pool<Sqlite>,
}

impl Database {
    /// Initialize a new database connection
    pub async fn new(app_data_dir: &Path) -> Result<Self> {
        // Ensure the data directory exists
        if !app_data_dir.exists() {
            fs::create_dir_all(app_data_dir).await?;
        }

        let db_path = app_data_dir.join("hedgex.db");
        let db_url = format!("sqlite:{}", db_path.to_string_lossy());

        // Create connection pool
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&db_url)
            .await?;

        // Run migrations to set up tables
        sqlx::migrate!("./migrations").run(&pool).await?;

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
