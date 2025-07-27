pub mod crypto;
pub mod logger;
pub mod enhanced_logger;
pub mod database_utils;
pub mod error_recovery;
pub mod performance_monitor;

#[cfg(test)]
mod tests {
    pub mod error_recovery_tests;
    pub mod performance_monitor_tests;
}

// Re-export utilities for easier access
pub use crypto::{CryptoService, EnhancedCryptoService, Encryption, hash_password, verify_password};
pub use logger::Logger;
pub use enhanced_logger::EnhancedLogger;
pub use error_recovery::{ErrorRecoveryManager, CircuitBreaker, ExponentialBackoff, HealthCheckManager, HealthCheck, HealthStatus};
pub use performance_monitor::{PerformanceMonitor, PerformanceMetrics, RequestTimer, PerformanceAlert, AlertThreshold};
