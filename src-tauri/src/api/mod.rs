pub mod kite_client;
pub mod middleware;
pub mod kite_routes;
pub mod websocket_routes;
pub mod ticker;
// pub mod http_server;
pub mod kite_historical;
#[cfg(test)]
mod http_server_test;
#[cfg(test)]
mod http_server_integration;

// Re-export important types
pub use kite_client::{KiteApiClient, KiteClient};
pub use kite_routes::kite_routes;
pub use websocket_routes::websocket_routes;
pub use ticker::KiteTickerClient;
// pub use http_server::{HttpServerState, create_server};
pub use kite_historical::KiteHistoricalClient;