use crate::error::{HedgeXError, Result};
use crate::utils::enhanced_logger::EnhancedLogger;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{RwLock, Mutex};
use tokio::time::sleep;
use tracing::{error, warn, info, debug, instrument};
use serde_json::{json, Value};
use std::collections::HashMap;
use chrono::Utc;

/// Circuit breaker states
#[derive(Debug, Clone, PartialEq)]
pub enum CircuitBreakerState {
    Closed,
    Open,
    HalfOpen,
}

/// Circuit breaker for error recovery
#[derive(Debug)]
pub struct CircuitBreaker {
    state: Arc<RwLock<CircuitBreakerState>>,
    failure_count: Arc<RwLock<u32>>,
    last_failure_time: Arc<RwLock<Option<Instant>>>,
    failure_threshold: u32,
    recovery_timeout: Duration,
    half_open_max_calls: u32,
    half_open_calls: Arc<RwLock<u32>>,
    logger: Arc<EnhancedLogger>,
}

impl CircuitBreaker {
    /// Create a new circuit breaker
    pub fn new(
        failure_threshold: u32,
        recovery_timeout: Duration,
        half_open_max_calls: u32,
        logger: Arc<EnhancedLogger>,
    ) -> Self {
        Self {
            state: Arc::new(RwLock::new(CircuitBreakerState::Closed)),
            failure_count: Arc::new(RwLock::new(0)),
            last_failure_time: Arc::new(RwLock::new(None)),
            failure_threshold,
            recovery_timeout,
            half_open_max_calls,
            half_open_calls: Arc::new(RwLock::new(0)),
            logger,
        }
    }

    /// Execute a function with circuit breaker protection
    #[instrument(skip(self, operation))]
    pub async fn execute<F, T, E>(&self, operation: F) -> Result<T>
    where
        F: std::future::Future<Output = std::result::Result<T, E>>,
        E: Into<HedgeXError>,
    {
        // Check if circuit breaker allows execution
        if !self.can_execute().await {
            let error_msg = "Circuit breaker is open - operation blocked";
            self.logger.error_structured(
                error_msg,
                Some("circuit_breaker"),
                HashMap::from([
                    ("state".to_string(), json!("open")),
                    ("failure_count".to_string(), json!(*self.failure_count.read().await)),
                ])
            ).await.ok();
            
            return Err(HedgeXError::ExternalServiceError(error_msg.to_string()));
        }

        // Execute the operation
        match operation.await {
            Ok(result) => {
                self.on_success().await;
                Ok(result)
            }
            Err(e) => {
                let hedgex_error = e.into();
                self.on_failure().await;
                Err(hedgex_error)
            }
        }
    }

    /// Check if the circuit breaker allows execution
    async fn can_execute(&self) -> bool {
        let state = self.state.read().await;
        match *state {
            CircuitBreakerState::Closed => true,
            CircuitBreakerState::Open => {
                // Check if recovery timeout has passed
                if let Some(last_failure) = *self.last_failure_time.read().await {
                    if last_failure.elapsed() >= self.recovery_timeout {
                        drop(state);
                        self.transition_to_half_open().await;
                        true
                    } else {
                        false
                    }
                } else {
                    false
                }
            }
            CircuitBreakerState::HalfOpen => {
                let calls = *self.half_open_calls.read().await;
                calls < self.half_open_max_calls
            }
        }
    }

    /// Handle successful operation
    async fn on_success(&self) {
        let mut state = self.state.write().await;
        match *state {
            CircuitBreakerState::HalfOpen => {
                *state = CircuitBreakerState::Closed;
                *self.failure_count.write().await = 0;
                *self.half_open_calls.write().await = 0;
                
                self.logger.info_structured(
                    "Circuit breaker transitioned to closed state",
                    Some("circuit_breaker"),
                    HashMap::from([("state".to_string(), json!("closed"))])
                ).await.ok();
            }
            CircuitBreakerState::Closed => {
                *self.failure_count.write().await = 0;
            }
            _ => {}
        }
    }

    /// Handle failed operation
    async fn on_failure(&self) {
        let mut failure_count = self.failure_count.write().await;
        *failure_count += 1;
        *self.last_failure_time.write().await = Some(Instant::now());

        if *failure_count >= self.failure_threshold {
            let mut state = self.state.write().await;
            if *state == CircuitBreakerState::Closed {
                *state = CircuitBreakerState::Open;
                
                self.logger.error_structured(
                    "Circuit breaker opened due to failure threshold exceeded",
                    Some("circuit_breaker"),
                    HashMap::from([
                        ("state".to_string(), json!("open")),
                        ("failure_count".to_string(), json!(*failure_count)),
                        ("threshold".to_string(), json!(self.failure_threshold)),
                    ])
                ).await.ok();
            }
        }
    }

    /// Transition to half-open state
    async fn transition_to_half_open(&self) {
        let mut state = self.state.write().await;
        *state = CircuitBreakerState::HalfOpen;
        *self.half_open_calls.write().await = 0;
        
        self.logger.info_structured(
            "Circuit breaker transitioned to half-open state",
            Some("circuit_breaker"),
            HashMap::from([("state".to_string(), json!("half_open"))])
        ).await.ok();
    }

    /// Get current state
    pub async fn get_state(&self) -> CircuitBreakerState {
        self.state.read().await.clone()
    }

    /// Get failure count
    pub async fn get_failure_count(&self) -> u32 {
        *self.failure_count.read().await
    }
}

/// Exponential backoff strategy for retries
#[derive(Debug, Clone)]
pub struct ExponentialBackoff {
    initial_delay: Duration,
    max_delay: Duration,
    multiplier: f64,
    max_retries: u32,
}

impl ExponentialBackoff {
    /// Create a new exponential backoff strategy
    pub fn new(
        initial_delay: Duration,
        max_delay: Duration,
        multiplier: f64,
        max_retries: u32,
    ) -> Self {
        Self {
            initial_delay,
            max_delay,
            multiplier,
            max_retries,
        }
    }

    /// Default configuration for API calls
    pub fn default_api() -> Self {
        Self::new(
            Duration::from_millis(100),
            Duration::from_secs(30),
            2.0,
            5,
        )
    }

    /// Default configuration for database operations
    pub fn default_database() -> Self {
        Self::new(
            Duration::from_millis(50),
            Duration::from_secs(5),
            1.5,
            3,
        )
    }

    /// Execute operation with exponential backoff retry
    #[instrument(skip(self, operation, logger))]
    pub async fn execute<F, T, E, Fut>(
        &self,
        operation: F,
        logger: Arc<EnhancedLogger>,
    ) -> Result<T>
    where
        F: Fn() -> Fut,
        Fut: std::future::Future<Output = std::result::Result<T, E>>,
        E: Into<HedgeXError> + std::fmt::Debug,
    {
        let mut delay = self.initial_delay;
        let mut last_error = None;

        for attempt in 0..=self.max_retries {
            if attempt > 0 {
                logger.warning_structured(
                    &format!("Retrying operation (attempt {}/{})", attempt + 1, self.max_retries + 1),
                    Some("retry"),
                    HashMap::from([
                        ("attempt".to_string(), json!(attempt + 1)),
                        ("max_attempts".to_string(), json!(self.max_retries + 1)),
                        ("delay_ms".to_string(), json!(delay.as_millis())),
                    ])
                ).await.ok();

                sleep(delay).await;
                delay = std::cmp::min(
                    Duration::from_millis((delay.as_millis() as f64 * self.multiplier) as u64),
                    self.max_delay,
                );
            }

            match operation().await {
                Ok(result) => {
                    if attempt > 0 {
                        logger.info_structured(
                            &format!("Operation succeeded after {} retries", attempt),
                            Some("retry"),
                            HashMap::from([
                                ("successful_attempt".to_string(), json!(attempt + 1)),
                                ("total_attempts".to_string(), json!(attempt + 1)),
                            ])
                        ).await.ok();
                    }
                    return Ok(result);
                }
                Err(e) => {
                    let hedgex_error = e.into();
                    last_error = Some(hedgex_error);
                    
                    if attempt < self.max_retries {
                        logger.warning_structured(
                            &format!("Operation failed, will retry: {:?}", last_error.as_ref().unwrap()),
                            Some("retry"),
                            HashMap::from([
                                ("attempt".to_string(), json!(attempt + 1)),
                                ("error".to_string(), json!(format!("{:?}", last_error.as_ref().unwrap()))),
                            ])
                        ).await.ok();
                    }
                }
            }
        }

        let final_error = last_error.unwrap_or_else(|| {
            HedgeXError::InternalError("Retry operation failed without error".to_string())
        });

        logger.error_structured(
            &format!("Operation failed after {} attempts", self.max_retries + 1),
            Some("retry"),
            HashMap::from([
                ("total_attempts".to_string(), json!(self.max_retries + 1)),
                ("final_error".to_string(), json!(format!("{:?}", final_error))),
            ])
        ).await.ok();

        Err(final_error)
    }
}

/// Error recovery manager that coordinates different recovery strategies
pub struct ErrorRecoveryManager {
    circuit_breakers: Arc<RwLock<HashMap<String, Arc<CircuitBreaker>>>>,
    logger: Arc<EnhancedLogger>,
}

impl ErrorRecoveryManager {
    /// Create a new error recovery manager
    pub fn new(logger: Arc<EnhancedLogger>) -> Self {
        Self {
            circuit_breakers: Arc::new(RwLock::new(HashMap::new())),
            logger,
        }
    }

    /// Get or create a circuit breaker for a service
    pub async fn get_circuit_breaker(&self, service_name: &str) -> Arc<CircuitBreaker> {
        let mut breakers = self.circuit_breakers.write().await;
        
        if let Some(breaker) = breakers.get(service_name) {
            breaker.clone()
        } else {
            let breaker = Arc::new(CircuitBreaker::new(
                5, // failure threshold
                Duration::from_secs(60), // recovery timeout
                3, // half-open max calls
                self.logger.clone(),
            ));
            
            breakers.insert(service_name.to_string(), breaker.clone());
            
            self.logger.info_structured(
                &format!("Created circuit breaker for service: {}", service_name),
                Some("error_recovery"),
                HashMap::from([("service".to_string(), json!(service_name))])
            ).await.ok();
            
            breaker
        }
    }

    /// Execute operation with circuit breaker protection
    pub async fn execute_with_circuit_breaker<F, T, E>(
        &self,
        service_name: &str,
        operation: F,
    ) -> Result<T>
    where
        F: std::future::Future<Output = std::result::Result<T, E>>,
        E: Into<HedgeXError>,
    {
        let circuit_breaker = self.get_circuit_breaker(service_name).await;
        circuit_breaker.execute(operation).await
    }

    /// Execute operation with both circuit breaker and retry logic
    pub async fn execute_with_recovery<F, T, E, Fut>(
        &self,
        service_name: &str,
        operation: F,
        backoff: ExponentialBackoff,
    ) -> Result<T>
    where
        F: Fn() -> Fut + Send + Sync,
        Fut: std::future::Future<Output = std::result::Result<T, E>> + Send,
        E: Into<HedgeXError> + std::fmt::Debug + Send,
        T: Send,
    {
        let circuit_breaker = self.get_circuit_breaker(service_name).await;
        let logger = self.logger.clone();
        
        backoff.execute(
            || async {
                circuit_breaker.execute(operation()).await
            },
            logger,
        ).await
    }

    /// Get status of all circuit breakers
    pub async fn get_circuit_breaker_status(&self) -> HashMap<String, Value> {
        let breakers = self.circuit_breakers.read().await;
        let mut status = HashMap::new();
        
        for (service, breaker) in breakers.iter() {
            let state = breaker.get_state().await;
            let failure_count = breaker.get_failure_count().await;
            
            status.insert(
                service.clone(),
                json!({
                    "state": format!("{:?}", state),
                    "failure_count": failure_count,
                    "timestamp": Utc::now().to_rfc3339(),
                })
            );
        }
        
        status
    }

    /// Reset a specific circuit breaker
    pub async fn reset_circuit_breaker(&self, service_name: &str) -> Result<()> {
        let mut breakers = self.circuit_breakers.write().await;
        
        if breakers.contains_key(service_name) {
            // Remove the old breaker, which will cause a new one to be created on next access
            breakers.remove(service_name);
            
            self.logger.info_structured(
                &format!("Reset circuit breaker for service: {}", service_name),
                Some("error_recovery"),
                HashMap::from([("service".to_string(), json!(service_name))])
            ).await?;
            
            Ok(())
        } else {
            Err(HedgeXError::NotFoundError(format!(
                "Circuit breaker not found for service: {}",
                service_name
            )))
        }
    }
}

/// Health check manager for monitoring system components
pub struct HealthCheckManager {
    logger: Arc<EnhancedLogger>,
    checks: Arc<RwLock<HashMap<String, Box<dyn HealthCheck + Send + Sync>>>>,
}

/// Trait for health checks
#[async_trait::async_trait]
pub trait HealthCheck {
    async fn check(&self) -> Result<HealthStatus>;
    fn name(&self) -> &str;
}

/// Health status result
#[derive(Debug, Clone, Serialize)]
pub struct HealthStatus {
    pub healthy: bool,
    pub message: String,
    pub details: Option<Value>,
    pub timestamp: DateTime<Utc>,
}

impl HealthCheckManager {
    /// Create a new health check manager
    pub fn new(logger: Arc<EnhancedLogger>) -> Self {
        Self {
            logger,
            checks: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a health check
    pub async fn register_check(&self, check: Box<dyn HealthCheck + Send + Sync>) {
        let name = check.name().to_string();
        let mut checks = self.checks.write().await;
        checks.insert(name.clone(), check);
        
        self.logger.info_structured(
            &format!("Registered health check: {}", name),
            Some("health_check"),
            HashMap::from([("check_name".to_string(), json!(name))])
        ).await.ok();
    }

    /// Run all health checks
    pub async fn run_all_checks(&self) -> HashMap<String, HealthStatus> {
        let checks = self.checks.read().await;
        let mut results = HashMap::new();
        
        for (name, check) in checks.iter() {
            let status = match check.check().await {
                Ok(status) => status,
                Err(e) => HealthStatus {
                    healthy: false,
                    message: format!("Health check failed: {}", e),
                    details: Some(json!({"error": e.to_string()})),
                    timestamp: Utc::now(),
                },
            };
            
            results.insert(name.clone(), status);
        }
        
        results
    }

    /// Run a specific health check
    pub async fn run_check(&self, name: &str) -> Result<HealthStatus> {
        let checks = self.checks.read().await;
        
        if let Some(check) = checks.get(name) {
            check.check().await
        } else {
            Err(HedgeXError::NotFoundError(format!(
                "Health check not found: {}",
                name
            )))
        }
    }
}

use serde::Serialize;
use chrono::DateTime;