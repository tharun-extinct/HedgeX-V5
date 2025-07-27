#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::enhanced_logger::EnhancedLogger;
    use crate::db::Database;
    use std::sync::Arc;
    use tokio::sync::Mutex;
    use tempfile::TempDir;
    use std::time::Duration;

    async fn create_test_logger() -> Arc<EnhancedLogger> {
        let temp_dir = TempDir::new().unwrap();
        let db = Arc::new(Mutex::new(
            Database::new(temp_dir.path()).await.unwrap()
        ));
        Arc::new(
            EnhancedLogger::new(db, None, temp_dir.path()).await.unwrap()
        )
    }

    #[tokio::test]
    async fn test_circuit_breaker_closed_state() {
        let logger = create_test_logger().await;
        let circuit_breaker = CircuitBreaker::new(3, Duration::from_secs(1), 2, logger);
        
        assert_eq!(circuit_breaker.get_state().await, CircuitBreakerState::Closed);
        assert_eq!(circuit_breaker.get_failure_count().await, 0);
    }

    #[tokio::test]
    async fn test_circuit_breaker_success() {
        let logger = create_test_logger().await;
        let circuit_breaker = CircuitBreaker::new(3, Duration::from_secs(1), 2, logger);
        
        let result = circuit_breaker.execute(async { Ok::<i32, String>(42) }).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
        assert_eq!(circuit_breaker.get_failure_count().await, 0);
    }

    #[tokio::test]
    async fn test_circuit_breaker_failure() {
        let logger = create_test_logger().await;
        let circuit_breaker = CircuitBreaker::new(3, Duration::from_secs(1), 2, logger);
        
        let result = circuit_breaker.execute(async { Err::<i32, String>("test error".to_string()) }).await;
        assert!(result.is_err());
        assert_eq!(circuit_breaker.get_failure_count().await, 1);
        assert_eq!(circuit_breaker.get_state().await, CircuitBreakerState::Closed);
    }

    #[tokio::test]
    async fn test_circuit_breaker_opens_after_threshold() {
        let logger = create_test_logger().await;
        let circuit_breaker = CircuitBreaker::new(2, Duration::from_secs(1), 2, logger);
        
        // First failure
        let _ = circuit_breaker.execute(async { Err::<i32, String>("error 1".to_string()) }).await;
        assert_eq!(circuit_breaker.get_state().await, CircuitBreakerState::Closed);
        
        // Second failure - should open the circuit
        let _ = circuit_breaker.execute(async { Err::<i32, String>("error 2".to_string()) }).await;
        assert_eq!(circuit_breaker.get_state().await, CircuitBreakerState::Open);
        
        // Third call should be blocked
        let result = circuit_breaker.execute(async { Ok::<i32, String>(42) }).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Circuit breaker is open"));
    }

    #[tokio::test]
    async fn test_exponential_backoff_success() {
        let logger = create_test_logger().await;
        let backoff = ExponentialBackoff::new(
            Duration::from_millis(10),
            Duration::from_millis(100),
            2.0,
            3,
        );
        
        let result = backoff.execute(
            || async { Ok::<i32, String>(42) },
            logger,
        ).await;
        
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
    }

    #[tokio::test]
    async fn test_exponential_backoff_retry() {
        let logger = create_test_logger().await;
        let backoff = ExponentialBackoff::new(
            Duration::from_millis(10),
            Duration::from_millis(100),
            2.0,
            2,
        );
        
        let mut call_count = 0;
        let result = backoff.execute(
            || {
                call_count += 1;
                async move {
                    if call_count < 2 {
                        Err::<i32, String>("temporary error".to_string())
                    } else {
                        Ok(42)
                    }
                }
            },
            logger,
        ).await;
        
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
        assert_eq!(call_count, 2);
    }

    #[tokio::test]
    async fn test_exponential_backoff_max_retries() {
        let logger = create_test_logger().await;
        let backoff = ExponentialBackoff::new(
            Duration::from_millis(10),
            Duration::from_millis(100),
            2.0,
            2,
        );
        
        let mut call_count = 0;
        let result = backoff.execute(
            || {
                call_count += 1;
                async move { Err::<i32, String>("persistent error".to_string()) }
            },
            logger,
        ).await;
        
        assert!(result.is_err());
        assert_eq!(call_count, 3); // Initial call + 2 retries
    }

    #[tokio::test]
    async fn test_error_recovery_manager() {
        let logger = create_test_logger().await;
        let manager = ErrorRecoveryManager::new(logger);
        
        // Test getting circuit breaker
        let breaker1 = manager.get_circuit_breaker("test_service").await;
        let breaker2 = manager.get_circuit_breaker("test_service").await;
        
        // Should return the same instance
        assert!(Arc::ptr_eq(&breaker1, &breaker2));
        
        // Test status
        let status = manager.get_circuit_breaker_status().await;
        assert!(status.contains_key("test_service"));
    }

    #[tokio::test]
    async fn test_error_recovery_manager_execute() {
        let logger = create_test_logger().await;
        let manager = ErrorRecoveryManager::new(logger);
        
        let result = manager.execute_with_circuit_breaker(
            "test_service",
            async { Ok::<i32, String>(42) }
        ).await;
        
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
    }

    #[tokio::test]
    async fn test_error_recovery_manager_reset() {
        let logger = create_test_logger().await;
        let manager = ErrorRecoveryManager::new(logger);
        
        // Create a circuit breaker
        let _breaker = manager.get_circuit_breaker("test_service").await;
        
        // Reset it
        let result = manager.reset_circuit_breaker("test_service").await;
        assert!(result.is_ok());
        
        // Try to reset non-existent breaker
        let result = manager.reset_circuit_breaker("non_existent").await;
        assert!(result.is_err());
    }

    // Mock health check for testing
    struct MockHealthCheck {
        name: String,
        healthy: bool,
    }

    #[async_trait::async_trait]
    impl HealthCheck for MockHealthCheck {
        async fn check(&self) -> Result<HealthStatus> {
            Ok(HealthStatus {
                healthy: self.healthy,
                message: if self.healthy { "OK".to_string() } else { "Failed".to_string() },
                details: None,
                timestamp: chrono::Utc::now(),
            })
        }

        fn name(&self) -> &str {
            &self.name
        }
    }

    #[tokio::test]
    async fn test_health_check_manager() {
        let logger = create_test_logger().await;
        let manager = HealthCheckManager::new(logger);
        
        // Register health checks
        manager.register_check(Box::new(MockHealthCheck {
            name: "test_healthy".to_string(),
            healthy: true,
        })).await;
        
        manager.register_check(Box::new(MockHealthCheck {
            name: "test_unhealthy".to_string(),
            healthy: false,
        })).await;
        
        // Run all checks
        let results = manager.run_all_checks().await;
        assert_eq!(results.len(), 2);
        assert!(results.get("test_healthy").unwrap().healthy);
        assert!(!results.get("test_unhealthy").unwrap().healthy);
        
        // Run specific check
        let result = manager.run_check("test_healthy").await;
        assert!(result.is_ok());
        assert!(result.unwrap().healthy);
        
        // Run non-existent check
        let result = manager.run_check("non_existent").await;
        assert!(result.is_err());
    }
}