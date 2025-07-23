pub mod app_service;
pub mod database_service;
pub mod enhanced_database_service;
pub mod auth_service;
pub mod kite_service;
pub mod websocket_manager;
#[cfg(test)]
mod auth_service_test;
#[cfg(test)]
mod websocket_manager_test;

// Re-export services for easier access
pub use app_service::AppService;
pub use database_service::DatabaseService;
pub use enhanced_database_service::EnhancedDatabaseService;
pub use auth_service::AuthService;
pub use kite_service::KiteService;
pub use websocket_manager::{WebSocketManager, MarketData, SubscriptionMode, ConnectionStatus};