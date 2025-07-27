use crate::error::{HedgeXError, Result};
use crate::utils::enhanced_logger::EnhancedLogger;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{RwLock, Mutex};
use tokio::time::{interval, sleep};
use tracing::{error, warn, info, debug, instrument};
use serde_json::{json, Value};
use std::collections::{HashMap, VecDeque};
use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use std::sync::atomic::{AtomicU64, AtomicBool, Ordering};

/// Performance metrics for system monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub timestamp: DateTime<Utc>,
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub disk_usage: f64,
    pub network_latency: Option<f64>,
    pub active_connections: u32,
    pub request_rate: f64,
    pub error_rate: f64,
    pub response_time_avg: f64,
    pub response_time_p95: f64,
    pub response_time_p99: f64,
}

/// Performance alert configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertThreshold {
    pub metric_name: String,
    pub threshold: f64,
    pub comparison: AlertComparison,
    pub duration: Duration,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertComparison {
    GreaterThan,
    LessThan,
    Equals,
}

/// Performance alert
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceAlert {
    pub id: String,
    pub metric_name: String,
    pub current_value: f64,
    pub threshold: f64,
    pub message: String,
    pub severity: AlertSeverity,
    pub timestamp: DateTime<Utc>,
    pub resolved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertSeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// Request timing tracker
#[derive(Debug)]
pub struct RequestTimer {
    start_time: Instant,
    operation: String,
    context: HashMap<String, Value>,
}

impl RequestTimer {
    /// Start timing a request
    pub fn start(operation: String) -> Self {
        Self {
            start_time: Instant::now(),
            operation,
            context: HashMap::new(),
        }
    }

    /// Add context to the timer
    pub fn with_context(mut self, key: String, value: Value) -> Self {
        self.context.insert(key, value);
        self
    }

    /// Finish timing and return duration
    pub fn finish(self) -> (Duration, String, HashMap<String, Value>) {
        let duration = self.start_time.elapsed();
        (duration, self.operation, self.context)
    }
}

/// Performance monitor for tracking system metrics
pub struct PerformanceMonitor {
    logger: Arc<EnhancedLogger>,
    metrics_history: Arc<RwLock<VecDeque<PerformanceMetrics>>>,
    request_times: Arc<RwLock<VecDeque<(DateTime<Utc>, Duration, String)>>>,
    alert_thresholds: Arc<RwLock<Vec<AlertThreshold>>>,
    active_alerts: Arc<RwLock<HashMap<String, PerformanceAlert>>>,
    monitoring_enabled: Arc<AtomicBool>,
    request_count: Arc<AtomicU64>,
    error_count: Arc<AtomicU64>,
    max_history_size: usize,
}

impl PerformanceMonitor {
    /// Create a new performance monitor
    pub fn new(logger: Arc<EnhancedLogger>) -> Self {
        Self {
            logger,
            metrics_history: Arc::new(RwLock::new(VecDeque::new())),
            request_times: Arc::new(RwLock::new(VecDeque::new())),
            alert_thresholds: Arc::new(RwLock::new(Vec::new())),
            active_alerts: Arc::new(RwLock::new(HashMap::new())),
            monitoring_enabled: Arc::new(AtomicBool::new(true)),
            request_count: Arc::new(AtomicU64::new(0)),
            error_count: Arc::new(AtomicU64::new(0)),
            max_history_size: 1000,
        }
    }

    /// Start the performance monitoring loop
    pub async fn start_monitoring(&self) -> Result<()> {
        let logger = self.logger.clone();
        let metrics_history = self.metrics_history.clone();
        let alert_thresholds = self.alert_thresholds.clone();
        let active_alerts = self.active_alerts.clone();
        let monitoring_enabled = self.monitoring_enabled.clone();
        let request_times = self.request_times.clone();
        let request_count = self.request_count.clone();
        let error_count = self.error_count.clone();
        let max_history_size = self.max_history_size;

        tokio::spawn(async move {
            let mut interval = interval(Duration::from_secs(30)); // Collect metrics every 30 seconds
            
            logger.info("Performance monitoring started", Some("performance")).await.ok();

            loop {
                interval.tick().await;

                if !monitoring_enabled.load(Ordering::Relaxed) {
                    continue;
                }

                // Collect current metrics
                let metrics = Self::collect_system_metrics(
                    &request_times,
                    &request_count,
                    &error_count,
                ).await;

                // Store metrics
                {
                    let mut history = metrics_history.write().await;
                    history.push_back(metrics.clone());
                    
                    // Keep only the last N metrics
                    while history.len() > max_history_size {
                        history.pop_front();
                    }
                }

                // Check alert thresholds
                Self::check_alert_thresholds(
                    &metrics,
                    &alert_thresholds,
                    &active_alerts,
                    &logger,
                ).await;

                // Log performance metrics
                logger.info_structured(
                    "Performance metrics collected",
                    Some("performance"),
                    HashMap::from([
                        ("cpu_usage".to_string(), json!(metrics.cpu_usage)),
                        ("memory_usage".to_string(), json!(metrics.memory_usage)),
                        ("response_time_avg".to_string(), json!(metrics.response_time_avg)),
                        ("request_rate".to_string(), json!(metrics.request_rate)),
                        ("error_rate".to_string(), json!(metrics.error_rate)),
                    ])
                ).await.ok();
            }
        });

        Ok(())
    }

    /// Collect current system metrics
    async fn collect_system_metrics(
        request_times: &Arc<RwLock<VecDeque<(DateTime<Utc>, Duration, String)>>>,
        request_count: &Arc<AtomicU64>,
        error_count: &Arc<AtomicU64>,
    ) -> PerformanceMetrics {
        let now = Utc::now();
        let one_minute_ago = now - chrono::Duration::minutes(1);

        // Calculate request metrics from the last minute
        let (avg_response_time, p95_response_time, p99_response_time, recent_requests) = {
            let times = request_times.read().await;
            let recent: Vec<Duration> = times
                .iter()
                .filter(|(timestamp, _, _)| *timestamp > one_minute_ago)
                .map(|(_, duration, _)| *duration)
                .collect();

            let count = recent.len();
            if count == 0 {
                (0.0, 0.0, 0.0, 0)
            } else {
                let mut sorted = recent.clone();
                sorted.sort();

                let avg = recent.iter().sum::<Duration>().as_millis() as f64 / count as f64;
                let p95_idx = (count as f64 * 0.95) as usize;
                let p99_idx = (count as f64 * 0.99) as usize;
                
                let p95 = if p95_idx < count {
                    sorted[p95_idx].as_millis() as f64
                } else {
                    avg
                };
                
                let p99 = if p99_idx < count {
                    sorted[p99_idx].as_millis() as f64
                } else {
                    avg
                };

                (avg, p95, p99, count)
            }
        };

        // Calculate rates
        let total_requests = request_count.load(Ordering::Relaxed);
        let total_errors = error_count.load(Ordering::Relaxed);
        let request_rate = recent_requests as f64 / 60.0; // requests per second
        let error_rate = if total_requests > 0 {
            (total_errors as f64 / total_requests as f64) * 100.0
        } else {
            0.0
        };

        // Get system metrics (simplified - in a real implementation, you'd use system APIs)
        let cpu_usage = Self::get_cpu_usage().await;
        let memory_usage = Self::get_memory_usage().await;
        let disk_usage = Self::get_disk_usage().await;

        PerformanceMetrics {
            timestamp: now,
            cpu_usage,
            memory_usage,
            disk_usage,
            network_latency: None, // Could be implemented with ping tests
            active_connections: 0, // Would need to track actual connections
            request_rate,
            error_rate,
            response_time_avg: avg_response_time,
            response_time_p95: p95_response_time,
            response_time_p99: p99_response_time,
        }
    }

    /// Get CPU usage (simplified implementation)
    async fn get_cpu_usage() -> f64 {
        // In a real implementation, you'd use system APIs like sysinfo crate
        // For now, return a mock value
        rand::random::<f64>() * 100.0
    }

    /// Get memory usage (simplified implementation)
    async fn get_memory_usage() -> f64 {
        // In a real implementation, you'd use system APIs
        rand::random::<f64>() * 100.0
    }

    /// Get disk usage (simplified implementation)
    async fn get_disk_usage() -> f64 {
        // In a real implementation, you'd check actual disk usage
        rand::random::<f64>() * 100.0
    }

    /// Check alert thresholds and trigger alerts
    async fn check_alert_thresholds(
        metrics: &PerformanceMetrics,
        thresholds: &Arc<RwLock<Vec<AlertThreshold>>>,
        active_alerts: &Arc<RwLock<HashMap<String, PerformanceAlert>>>,
        logger: &Arc<EnhancedLogger>,
    ) {
        let thresholds = thresholds.read().await;
        let mut alerts = active_alerts.write().await;

        for threshold in thresholds.iter() {
            if !threshold.enabled {
                continue;
            }

            let current_value = Self::get_metric_value(metrics, &threshold.metric_name);
            let should_alert = match threshold.comparison {
                AlertComparison::GreaterThan => current_value > threshold.threshold,
                AlertComparison::LessThan => current_value < threshold.threshold,
                AlertComparison::Equals => (current_value - threshold.threshold).abs() < 0.001,
            };

            let alert_key = format!("{}_{}", threshold.metric_name, threshold.threshold);

            if should_alert {
                if !alerts.contains_key(&alert_key) {
                    // New alert
                    let alert = PerformanceAlert {
                        id: uuid::Uuid::new_v4().to_string(),
                        metric_name: threshold.metric_name.clone(),
                        current_value,
                        threshold: threshold.threshold,
                        message: format!(
                            "Performance alert: {} is {} (threshold: {})",
                            threshold.metric_name,
                            current_value,
                            threshold.threshold
                        ),
                        severity: Self::determine_alert_severity(&threshold.metric_name, current_value, threshold.threshold),
                        timestamp: Utc::now(),
                        resolved: false,
                    };

                    logger.error_structured(
                        &alert.message,
                        Some("performance_alert"),
                        HashMap::from([
                            ("alert_id".to_string(), json!(alert.id)),
                            ("metric".to_string(), json!(alert.metric_name)),
                            ("current_value".to_string(), json!(current_value)),
                            ("threshold".to_string(), json!(threshold.threshold)),
                            ("severity".to_string(), json!(format!("{:?}", alert.severity))),
                        ])
                    ).await.ok();

                    alerts.insert(alert_key, alert);
                }
            } else if let Some(alert) = alerts.get_mut(&alert_key) {
                // Resolve existing alert
                if !alert.resolved {
                    alert.resolved = true;
                    
                    logger.info_structured(
                        &format!("Performance alert resolved: {}", alert.message),
                        Some("performance_alert"),
                        HashMap::from([
                            ("alert_id".to_string(), json!(alert.id)),
                            ("metric".to_string(), json!(alert.metric_name)),
                            ("current_value".to_string(), json!(current_value)),
                        ])
                    ).await.ok();
                }
            }
        }
    }

    /// Get metric value by name
    fn get_metric_value(metrics: &PerformanceMetrics, metric_name: &str) -> f64 {
        match metric_name {
            "cpu_usage" => metrics.cpu_usage,
            "memory_usage" => metrics.memory_usage,
            "disk_usage" => metrics.disk_usage,
            "request_rate" => metrics.request_rate,
            "error_rate" => metrics.error_rate,
            "response_time_avg" => metrics.response_time_avg,
            "response_time_p95" => metrics.response_time_p95,
            "response_time_p99" => metrics.response_time_p99,
            _ => 0.0,
        }
    }

    /// Determine alert severity based on metric and value
    fn determine_alert_severity(metric_name: &str, current_value: f64, threshold: f64) -> AlertSeverity {
        let ratio = current_value / threshold;
        
        match metric_name {
            "cpu_usage" | "memory_usage" | "disk_usage" => {
                if ratio > 2.0 { AlertSeverity::Critical }
                else if ratio > 1.5 { AlertSeverity::High }
                else if ratio > 1.2 { AlertSeverity::Medium }
                else { AlertSeverity::Low }
            }
            "error_rate" => {
                if current_value > 10.0 { AlertSeverity::Critical }
                else if current_value > 5.0 { AlertSeverity::High }
                else if current_value > 2.0 { AlertSeverity::Medium }
                else { AlertSeverity::Low }
            }
            "response_time_avg" | "response_time_p95" | "response_time_p99" => {
                if current_value > 5000.0 { AlertSeverity::Critical }
                else if current_value > 2000.0 { AlertSeverity::High }
                else if current_value > 1000.0 { AlertSeverity::Medium }
                else { AlertSeverity::Low }
            }
            _ => AlertSeverity::Medium,
        }
    }

    /// Record a request timing
    #[instrument(skip(self))]
    pub async fn record_request(&self, timer: RequestTimer) {
        let (duration, operation, context) = timer.finish();
        
        // Increment request counter
        self.request_count.fetch_add(1, Ordering::Relaxed);
        
        // Store request timing
        {
            let mut times = self.request_times.write().await;
            times.push_back((Utc::now(), duration, operation.clone()));
            
            // Keep only recent requests (last hour)
            let one_hour_ago = Utc::now() - chrono::Duration::hours(1);
            while let Some((timestamp, _, _)) = times.front() {
                if *timestamp < one_hour_ago {
                    times.pop_front();
                } else {
                    break;
                }
            }
        }

        // Log slow requests
        if duration > Duration::from_millis(1000) {
            self.logger.warning_structured(
                &format!("Slow request detected: {} took {}ms", operation, duration.as_millis()),
                Some("performance"),
                {
                    let mut data = HashMap::from([
                        ("operation".to_string(), json!(operation)),
                        ("duration_ms".to_string(), json!(duration.as_millis())),
                    ]);
                    data.extend(context);
                    data
                }
            ).await.ok();
        }
    }

    /// Record an error
    pub async fn record_error(&self, error: &HedgeXError, context: Option<HashMap<String, Value>>) {
        self.error_count.fetch_add(1, Ordering::Relaxed);
        
        let mut data = HashMap::from([
            ("error_type".to_string(), json!(format!("{:?}", error))),
            ("error_message".to_string(), json!(error.to_string())),
        ]);
        
        if let Some(ctx) = context {
            data.extend(ctx);
        }
        
        self.logger.error_structured(
            &format!("Error recorded: {}", error),
            Some("performance"),
            data
        ).await.ok();
    }

    /// Add alert threshold
    pub async fn add_alert_threshold(&self, threshold: AlertThreshold) {
        let mut thresholds = self.alert_thresholds.write().await;
        thresholds.push(threshold.clone());
        
        self.logger.info_structured(
            &format!("Added alert threshold for {}", threshold.metric_name),
            Some("performance"),
            HashMap::from([
                ("metric".to_string(), json!(threshold.metric_name)),
                ("threshold".to_string(), json!(threshold.threshold)),
                ("comparison".to_string(), json!(format!("{:?}", threshold.comparison))),
            ])
        ).await.ok();
    }

    /// Get current performance metrics
    pub async fn get_current_metrics(&self) -> Option<PerformanceMetrics> {
        let history = self.metrics_history.read().await;
        history.back().cloned()
    }

    /// Get metrics history
    pub async fn get_metrics_history(&self, limit: Option<usize>) -> Vec<PerformanceMetrics> {
        let history = self.metrics_history.read().await;
        let limit = limit.unwrap_or(100);
        
        history.iter()
            .rev()
            .take(limit)
            .cloned()
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect()
    }

    /// Get active alerts
    pub async fn get_active_alerts(&self) -> Vec<PerformanceAlert> {
        let alerts = self.active_alerts.read().await;
        alerts.values()
            .filter(|alert| !alert.resolved)
            .cloned()
            .collect()
    }

    /// Get all alerts (including resolved)
    pub async fn get_all_alerts(&self) -> Vec<PerformanceAlert> {
        let alerts = self.active_alerts.read().await;
        alerts.values().cloned().collect()
    }

    /// Clear resolved alerts
    pub async fn clear_resolved_alerts(&self) {
        let mut alerts = self.active_alerts.write().await;
        alerts.retain(|_, alert| !alert.resolved);
        
        self.logger.info("Cleared resolved performance alerts", Some("performance")).await.ok();
    }

    /// Enable/disable monitoring
    pub fn set_monitoring_enabled(&self, enabled: bool) {
        self.monitoring_enabled.store(enabled, Ordering::Relaxed);
    }

    /// Check if monitoring is enabled
    pub fn is_monitoring_enabled(&self) -> bool {
        self.monitoring_enabled.load(Ordering::Relaxed)
    }
}

use uuid;
use rand;