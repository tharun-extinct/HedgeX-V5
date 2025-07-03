// Modules
pub mod api;
pub mod db;
pub mod models;
pub mod trading;
pub mod utils;

use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::Manager;
use anyhow::Result;
use uuid::Uuid;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::SaltString;
use argon2::password_hash::rand_core::OsRng;
use sqlx::Row;

// Helper structs for SQLx queries
#[derive(Debug)]
struct ExistingUser {
    pub id: String,
}

#[derive(Debug)]
struct UserRecord {
    pub id: String,
    pub password_hash: String,
}

// Command handlers
#[tauri::command]
async fn create_user(
    _full_name: String,
    _email: String,
    username: String,
    password: String,
    state: tauri::State<'_, AppState>
) -> Result<serde_json::Value, String> {
    // Check if username already exists
    let db = state.db.lock().await;
    
    // Check if the username already exists
    let existing_user = sqlx::query("SELECT id FROM users WHERE username = ?")
        .bind(&username)
        .fetch_optional(db.get_pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if existing_user.is_some() {
        return Ok(serde_json::json!({
            "success": false,
            "message": "Username already exists"
        }));
    }

    // Hash the password using Argon2
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Password hashing error: {}", e))?
        .to_string();

    // Generate a new UUID for the user
    let user_id = Uuid::new_v4().to_string();

    // Insert the new user into the database
    sqlx::query(
        "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, datetime('now'))"
    )
    .bind(&user_id)
    .bind(&username)
    .bind(password_hash)
    .execute(db.get_pool())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    // Log user creation
    let logger = state.logger.lock().await;
    let _ = logger.info(&format!("New user created: {}", username), Some(&user_id)).await;

    Ok(serde_json::json!({
        "success": true,
        "message": "User created successfully"
    }))
}

#[tauri::command]
async fn login(
    username: String, 
    password: String, 
    state: tauri::State<'_, AppState>
) -> Result<String, String> {
    // Get database access
    let db = state.db.lock().await;

    // Find the user
    let user_record = sqlx::query("SELECT id, password_hash FROM users WHERE username = ?")
        .bind(&username)
        .fetch_optional(db.get_pool())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    // Check if user exists
    let (user_id, password_hash) = match user_record {
        Some(row) => {
            let id: String = row.try_get("id").map_err(|e| format!("Database error: {}", e))?;
            let hash: String = row.try_get("password_hash").map_err(|e| format!("Database error: {}", e))?;
            (id, hash)
        },
        None => return Err("Invalid username or password".to_string()),
    };

    // Verify password
    let parsed_hash = PasswordHash::new(&password_hash)
        .map_err(|_| "Invalid stored password hash".to_string())?;
    
    if Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_err() {
        return Err("Invalid username or password".to_string());
    }

    // Update last login timestamp
    sqlx::query(
        "UPDATE users SET last_login = datetime('now') WHERE id = ?"
    )
    .bind(user_id.clone())
    .execute(db.get_pool())
    .await
    .map_err(|e| format!("Failed to update login timestamp: {}", e))?;

    // Log the successful login
    let logger = state.logger.lock().await;
    let _ = logger.info(&format!("User logged in: {}", username), Some(&user_id)).await;

    // In a real implementation, we would generate a proper session token
    // For now, just return the user ID as the session token
    Ok(user_id)
}

#[tauri::command]
async fn get_profile(_state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    // In a real implementation, we would:
    // 1. Verify the user is authenticated
    // 2. Retrieve profile data
    
    let profile = serde_json::json!({
        "username": "demo_user",
        "email": "demo@example.com",
        "created_at": "2025-07-03T12:00:00Z",
        "plan": "Premium"
    });
    
    Ok(profile)
}

#[tauri::command]
async fn save_api_credentials(
    _api_key: String,
    _api_secret: String,
    _state: tauri::State<'_, AppState>
) -> Result<bool, String> {
    // In a real implementation, we would:
    // 1. Encrypt the API secret
    // 2. Store credentials in database
    
    Ok(true)
}

#[tauri::command]
async fn get_stock_list(_state: tauri::State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    // In a real implementation, we would:
    // 1. Retrieve NIFTY 50 stocks from Zerodha or database
    
    let stocks = vec![
        serde_json::json!({
            "symbol": "RELIANCE",
            "name": "Reliance Industries Ltd",
            "is_active": true
        }),
        serde_json::json!({
            "symbol": "TCS",
            "name": "Tata Consultancy Services Ltd",
            "is_active": false
        }),
        // More stocks would be added here
    ];
    
    Ok(stocks)
}

#[tauri::command]
async fn get_strategy_params(_state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    // In a real implementation, we would:
    // 1. Retrieve strategy parameters from database
    
    let strategy = serde_json::json!({
        "name": "Default Strategy",
        "max_trades_per_day": 10,
        "risk_percentage": 1.0,
        "stop_loss_percentage": 0.5,
        "take_profit_percentage": 1.5,
        "volume_threshold": 100000
    });
    
    Ok(strategy)
}

#[tauri::command]
async fn save_strategy_params(
    _params: serde_json::Value,
    _state: tauri::State<'_, AppState>
) -> Result<bool, String> {
    // In a real implementation, we would:
    // 1. Validate parameters
    // 2. Save to database
    // 3. Update trading engine
    
    Ok(true)
}

#[tauri::command]
async fn start_trading(_state: tauri::State<'_, AppState>) -> Result<bool, String> {
    // In a real implementation, we would:
    // 1. Initialize and start the trading engine
    
    Ok(true)
}

#[tauri::command]
async fn stop_trading(_state: tauri::State<'_, AppState>) -> Result<bool, String> {
    // In a real implementation, we would:
    // 1. Stop the trading engine
    // 2. Close open positions if needed
    
    Ok(true)
}

#[tauri::command]
async fn get_recent_trades(_state: tauri::State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    // In a real implementation, we would:
    // 1. Retrieve recent trades from database
    
    let trades = vec![
        serde_json::json!({
            "id": "1",
            "symbol": "RELIANCE",
            "trade_type": "BUY",
            "quantity": 10,
            "price": 2500.0,
            "status": "EXECUTED",
            "executed_at": "2025-07-03T09:30:00Z"
        }),
        serde_json::json!({
            "id": "2",
            "symbol": "TCS",
            "trade_type": "SELL",
            "quantity": 5,
            "price": 3700.0,
            "status": "EXECUTED",
            "executed_at": "2025-07-03T10:15:00Z"
        }),
        // More trades would be added here
    ];
    
    Ok(trades)
}

// Application state that will be shared across commands
struct AppState {
    db: Arc<Mutex<db::Database>>,
    kite_client: Arc<api::KiteClient>,
    ticker_client: Arc<Mutex<api::KiteTickerClient>>,
    logger: Arc<Mutex<utils::Logger>>,
    app_path: PathBuf,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize tracing for structured logging
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .init();
    
    // Run the Tauri application
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Get app data directory
            let app_handle = app.handle();
            let app_dir = app.path().app_data_dir().expect("Failed to get app data directory");
            
            println!("App data directory: {:?}", app_dir);
            
            // Ensure the directory exists with proper permissions
            std::fs::create_dir_all(&app_dir).expect("Failed to create app data directory");
            
            // Initialize components in a separate async block
            let app_handle_clone = app_handle.clone();
            tauri::async_runtime::block_on(async move {
                // Initialize database with better error handling
                let db = match db::Database::new(&app_dir).await {
                    Ok(db) => {
                        println!("Database initialized successfully");
                        Arc::new(Mutex::new(db))
                    },
                    Err(e) => {
                        eprintln!("Failed to initialize database: {}", e);
                        if let Some(source) = e.source() {
                            eprintln!("Caused by: {}", source);
                        }
                        std::process::exit(1);
                    }
                };
                
                // Initialize Kite API client
                let kite_client = Arc::new(api::KiteClient::new());
                
                // Initialize ticker client
                let ticker_client = Arc::new(Mutex::new(api::KiteTickerClient::new()));
                
                // Initialize logger
                let logger = Arc::new(Mutex::new(utils::Logger::new(db.clone(), None)));
                
                // Log startup
                {
                    let logger_guard = logger.lock().await;
                    let _ = logger_guard.info("HedgeX application started", None).await;
                }
                
                // Create and manage application state
                let state = AppState {
                    db,
                    kite_client,
                    ticker_client,
                    logger,
                    app_path: app_dir,
                };
                
                app_handle_clone.manage(state);
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_user,
            login,
            get_profile,
            save_api_credentials,
            get_stock_list,
            get_strategy_params,
            save_strategy_params,
            start_trading,
            stop_trading,
            get_recent_trades,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
