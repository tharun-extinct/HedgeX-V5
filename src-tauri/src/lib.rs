// Modules
pub mod api;
pub mod db;
pub mod error;
pub mod models;
pub mod services;
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

// Command handlers using the new authentication service
#[tauri::command]
async fn create_user(
    _full_name: String,
    _email: String,
    username: String,
    password: String,
    state: tauri::State<'_, AppState>
) -> Result<serde_json::Value, String> {
    use crate::services::auth_service::RegisterRequest;
    
    let register_request = RegisterRequest {
        username: username.clone(),
        password,
    };
    
    // Use the authentication service
    let auth_service = state.app_service.get_auth_service();
    
    match auth_service.register(register_request).await {
        Ok(user) => {
            // Create a login session for the new user
            let login_request = crate::services::auth_service::LoginRequest {
                username: username.clone(),
                password: user.id.clone(), // Temporary - we'll need to handle this properly
            };
            
            // For now, return success without auto-login
            Ok(serde_json::json!({
                "success": true,
                "message": "User created successfully",
                "user_id": user.id
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "message": e.to_string()
            }))
        }
    }
}

#[tauri::command]
async fn login(
    username: String, 
    password: String, 
    state: tauri::State<'_, AppState>
) -> Result<String, String> {
    use crate::services::auth_service::LoginRequest;
    
    let login_request = LoginRequest {
        username,
        password,
    };
    
    // Use the authentication service
    let auth_service = state.app_service.get_auth_service();
    
    match auth_service.login(login_request).await {
        Ok(session) => {
            // Return the session token
            Ok(session.token)
        }
        Err(e) => {
            Err(e.to_string())
        }
    }
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

#[tauri::command]
async fn get_market_data(state: tauri::State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    // Get market data from WebSocket manager
    let market_data = state.websocket_manager.get_all_cached_market_data().await;
    
    // Convert to JSON
    let data: Vec<serde_json::Value> = market_data
        .values()
        .map(|md| {
            serde_json::json!({
                "symbol": md.symbol,
                "instrument_token": md.instrument_token,
                "ltp": md.ltp.to_string(),
                "volume": md.volume,
                "bid": md.bid.to_string(),
                "ask": md.ask.to_string(),
                "timestamp": md.timestamp.to_rfc3339(),
                "change": md.change.map(|c| c.to_string()),
                "change_percent": md.change_percent.map(|c| c.to_string()),
            })
        })
        .collect();
    
    Ok(data)
}

// Application state that will be shared across commands
struct AppState {
    app_service: Arc<services::AppService>,
    kite_client: Arc<api::KiteClient>,
    ticker_client: Arc<Mutex<api::KiteTickerClient>>,
    websocket_manager: Arc<services::WebSocketManager>,
    // Legacy fields for backward compatibility
    db: Arc<Mutex<db::Database>>,
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
                // Initialize enhanced app service
                let app_service = match services::AppService::new(&app_dir).await {
                    Ok(service) => {
                        println!("AppService initialized successfully");
                        Arc::new(service)
                    },
                    Err(e) => {
                        eprintln!("Failed to initialize AppService: {}", e);
                        std::process::exit(1);
                    }
                };
                
                // Initialize Kite API client
                let kite_client = Arc::new(api::KiteClient::new());
                
                // Initialize ticker client
                let ticker_client = Arc::new(Mutex::new(api::KiteTickerClient::new()));
                
                // Get references for backward compatibility
                let db = app_service.get_database_service().get_database();
                let logger = app_service.get_logger();
                
                // Log startup
                {
                    let logger_guard = logger.lock().await;
                    let _ = logger_guard.info("HedgeX application started with enhanced services", None).await;
                }
                
                // Get WebSocket manager
                let websocket_manager = app_service.get_websocket_manager();
                
                // Create and manage application state
                let state = AppState {
                    app_service,
                    kite_client,
                    ticker_client,
                    websocket_manager,
                    // Legacy fields for backward compatibility
                    db: Arc::new(Mutex::new(
                        db::Database::new(&app_dir).await.expect("Failed to create legacy DB reference")
                    )),
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
            get_market_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
