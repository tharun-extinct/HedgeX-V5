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
async fn get_stock_list(state: tauri::State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    let user_id = "demo_user"; // TODO: Get from auth context
    
    // Get NIFTY 50 stocks
    let nifty_stocks = state.strategy_service.get_nifty_50_stocks();
    
    // Get user's active stock selections
    let active_selections = match state.strategy_service.get_active_stock_selections(user_id).await {
        Ok(selections) => selections,
        Err(_) => Vec::new(), // If error, assume no active selections
    };
    
    // Create a set of active symbols for quick lookup
    let active_symbols: std::collections::HashSet<String> = active_selections
        .into_iter()
        .map(|s| s.symbol)
        .collect();
    
    // Convert to JSON format with active status
    let stocks: Vec<serde_json::Value> = nifty_stocks
        .into_iter()
        .map(|(symbol, name)| {
            serde_json::json!({
                "symbol": symbol,
                "name": name,
                "is_active": active_symbols.contains(&symbol)
            })
        })
        .collect();
    
    Ok(stocks)
}

// Strategy management commands
#[tauri::command]
async fn get_strategies(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let user_id = "demo_user"; // TODO: Get from auth context
    
    match state.strategy_service.get_strategies(user_id).await {
        Ok(strategies) => {
            Ok(serde_json::json!({
                "success": true,
                "data": strategies
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "error": e.to_string()
            }))
        }
    }
}

#[tauri::command]
async fn create_strategy(
    name: String,
    description: Option<String>,
    max_trades_per_day: i32,
    risk_percentage: f64,
    stop_loss_percentage: f64,
    take_profit_percentage: f64,
    volume_threshold: i64,
    state: tauri::State<'_, AppState>
) -> Result<serde_json::Value, String> {
    let user_id = "demo_user"; // TODO: Get from auth context
    
    let request = services::CreateStrategyRequest {
        name,
        description,
        max_trades_per_day,
        risk_percentage,
        stop_loss_percentage,
        take_profit_percentage,
        volume_threshold,
    };
    
    match state.strategy_service.create_strategy(user_id, request).await {
        Ok(strategy) => {
            Ok(serde_json::json!({
                "success": true,
                "data": strategy
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "error": e.to_string()
            }))
        }
    }
}

#[tauri::command]
async fn update_strategy(
    strategy_id: String,
    name: Option<String>,
    description: Option<String>,
    max_trades_per_day: Option<i32>,
    risk_percentage: Option<f64>,
    stop_loss_percentage: Option<f64>,
    take_profit_percentage: Option<f64>,
    volume_threshold: Option<i64>,
    state: tauri::State<'_, AppState>
) -> Result<serde_json::Value, String> {
    let user_id = "demo_user"; // TODO: Get from auth context
    
    let request = services::UpdateStrategyRequest {
        name,
        description,
        max_trades_per_day,
        risk_percentage,
        stop_loss_percentage,
        take_profit_percentage,
        volume_threshold,
    };
    
    match state.strategy_service.update_strategy(user_id, &strategy_id, request).await {
        Ok(strategy) => {
            Ok(serde_json::json!({
                "success": true,
                "data": strategy
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "error": e.to_string()
            }))
        }
    }
}

#[tauri::command]
async fn enable_strategy(
    strategy_id: String,
    state: tauri::State<'_, AppState>
) -> Result<serde_json::Value, String> {
    let user_id = "demo_user"; // TODO: Get from auth context
    
    match state.strategy_service.enable_strategy(user_id, &strategy_id).await {
        Ok(_) => {
            Ok(serde_json::json!({
                "success": true,
                "message": "Strategy enabled successfully"
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "error": e.to_string()
            }))
        }
    }
}

#[tauri::command]
async fn disable_strategy(
    strategy_id: String,
    state: tauri::State<'_, AppState>
) -> Result<serde_json::Value, String> {
    let user_id = "demo_user"; // TODO: Get from auth context
    
    match state.strategy_service.disable_strategy(user_id, &strategy_id).await {
        Ok(_) => {
            Ok(serde_json::json!({
                "success": true,
                "message": "Strategy disabled successfully"
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "error": e.to_string()
            }))
        }
    }
}

#[tauri::command]
async fn delete_strategy(
    strategy_id: String,
    state: tauri::State<'_, AppState>
) -> Result<serde_json::Value, String> {
    let user_id = "demo_user"; // TODO: Get from auth context
    
    match state.strategy_service.delete_strategy(user_id, &strategy_id).await {
        Ok(_) => {
            Ok(serde_json::json!({
                "success": true,
                "message": "Strategy deleted successfully"
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "error": e.to_string()
            }))
        }
    }
}

#[tauri::command]
async fn get_nifty_50_stocks(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let stocks = state.strategy_service.get_nifty_50_stocks();
    
    Ok(serde_json::json!({
        "success": true,
        "data": stocks
    }))
}

#[tauri::command]
async fn get_stock_selections(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let user_id = "demo_user"; // TODO: Get from auth context
    
    match state.strategy_service.get_stock_selections(user_id).await {
        Ok(selections) => {
            Ok(serde_json::json!({
                "success": true,
                "data": selections
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "error": e.to_string()
            }))
        }
    }
}

#[tauri::command]
async fn add_stock_selection(
    symbol: String,
    exchange: Option<String>,
    state: tauri::State<'_, AppState>
) -> Result<serde_json::Value, String> {
    let user_id = "demo_user"; // TODO: Get from auth context
    let exchange = exchange.unwrap_or_else(|| "NSE".to_string());
    
    match state.strategy_service.add_stock_selection(user_id, &symbol, &exchange).await {
        Ok(selection) => {
            Ok(serde_json::json!({
                "success": true,
                "data": selection
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "error": e.to_string()
            }))
        }
    }
}

#[tauri::command]
async fn remove_stock_selection(
    symbol: String,
    state: tauri::State<'_, AppState>
) -> Result<serde_json::Value, String> {
    let user_id = "demo_user"; // TODO: Get from auth context
    
    match state.strategy_service.remove_stock_selection(user_id, &symbol).await {
        Ok(_) => {
            Ok(serde_json::json!({
                "success": true,
                "message": "Stock selection removed successfully"
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "error": e.to_string()
            }))
        }
    }
}

#[tauri::command]
async fn bulk_add_stock_selections(
    symbols: Vec<String>,
    exchange: Option<String>,
    state: tauri::State<'_, AppState>
) -> Result<serde_json::Value, String> {
    let user_id = "demo_user"; // TODO: Get from auth context
    let exchange = exchange.unwrap_or_else(|| "NSE".to_string());
    
    match state.strategy_service.bulk_add_stock_selections(user_id, symbols, &exchange).await {
        Ok(selections) => {
            Ok(serde_json::json!({
                "success": true,
                "data": selections
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "error": e.to_string()
            }))
        }
    }
}

#[tauri::command]
async fn bulk_remove_stock_selections(
    symbols: Vec<String>,
    state: tauri::State<'_, AppState>
) -> Result<serde_json::Value, String> {
    let user_id = "demo_user"; // TODO: Get from auth context
    
    match state.strategy_service.bulk_remove_stock_selections(user_id, symbols).await {
        Ok(_) => {
            Ok(serde_json::json!({
                "success": true,
                "message": "Stock selections removed successfully"
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "error": e.to_string()
            }))
        }
    }
}

#[tauri::command]
async fn get_strategy_performance(
    strategy_id: String,
    days: Option<i32>,
    state: tauri::State<'_, AppState>
) -> Result<serde_json::Value, String> {
    let user_id = "demo_user"; // TODO: Get from auth context
    
    match state.strategy_service.get_strategy_performance(user_id, &strategy_id, days).await {
        Ok(performance) => {
            Ok(serde_json::json!({
                "success": true,
                "data": performance
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "error": e.to_string()
            }))
        }
    }
}

#[tauri::command]
async fn get_strategy_stats(
    strategy_id: String,
    state: tauri::State<'_, AppState>
) -> Result<serde_json::Value, String> {
    let user_id = "demo_user"; // TODO: Get from auth context
    
    match state.strategy_service.get_strategy_stats(user_id, &strategy_id).await {
        Ok(stats) => {
            Ok(serde_json::json!({
                "success": true,
                "data": stats
            }))
        }
        Err(e) => {
            Ok(serde_json::json!({
                "success": false,
                "error": e.to_string()
            }))
        }
    }
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
pub struct AppState {
    app_service: Arc<services::AppService>,
    kite_client: Arc<api::KiteClient>,
    ticker_client: Arc<Mutex<api::KiteTickerClient>>,
    websocket_manager: Arc<services::WebSocketManager>,
    strategy_service: Arc<services::StrategyService>,
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
                let kite_client = Arc::new(api::KiteClient::new("dummy_api_key").unwrap());
                
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
                
                // Initialize strategy service
                let strategy_service = match services::StrategyService::new(app_service.get_enhanced_database_service()).await {
                    Ok(service) => {
                        println!("StrategyService initialized successfully");
                        Arc::new(service)
                    },
                    Err(e) => {
                        eprintln!("Failed to initialize StrategyService: {}", e);
                        std::process::exit(1);
                    }
                };
                
                // Create and manage application state
                let state = AppState {
                    app_service,
                    kite_client,
                    ticker_client,
                    websocket_manager,
                    strategy_service,
                    // Legacy fields for backward compatibility
                    db: Arc::new(Mutex::new(
                        db::Database::new(&app_dir).await.expect("Failed to create legacy DB reference")
                    )),
                    logger,
                    app_path: app_dir,
                };
                
                app_handle_clone.manage(state);
                
                // Start HTTP server for API endpoints
                let http_server_state = api::HttpServerState::new(Arc::clone(&app_service));
                let http_app = api::create_server(http_server_state);
                
                // Start the HTTP server on port 3001
                tokio::spawn(async move {
                    let listener = tokio::net::TcpListener::bind("127.0.0.1:3001")
                        .await
                        .expect("Failed to bind HTTP server");
                    
                    println!("HTTP API server running on http://127.0.0.1:3001");
                    
                    if let Err(e) = axum::serve(listener, http_app).await {
                        eprintln!("HTTP server error: {}", e);
                    }
                });
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_user,
            login,
            get_profile,
            save_api_credentials,
            get_stock_list,
            start_trading,
            stop_trading,
            get_recent_trades,
            get_market_data,
            // Strategy management commands
            get_strategies,
            create_strategy,
            update_strategy,
            enable_strategy,
            disable_strategy,
            delete_strategy,
            get_nifty_50_stocks,
            get_stock_selections,
            add_stock_selection,
            remove_stock_selection,
            bulk_add_stock_selections,
            bulk_remove_stock_selections,
            get_strategy_performance,
            get_strategy_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
