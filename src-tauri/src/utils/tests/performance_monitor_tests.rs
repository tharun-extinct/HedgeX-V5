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
    async fn test_performance_monitor_creation() {
        let logger = create_test_logger().await;
        let monitor = PerformanceMonitor::new(logger);
        
        assert!(monitor.is_monitoring_enabled());
        assert!(monitor.get_current_metrics().await.is_none());
    }

    #[tokio::test]
    async fn test_request_timer() {
        let timer = RequestTimer::start("test_operation".to_string());
        let timer = timer.with_context("user_id".to_string(), json!("test_user"));
        
        // Simulate some work
        tokio::time::sleep(Duration::from_millis(10)).await;
        
        let (duration, operation, context) = timer.finish();
        
        assert!(duration >= Duration::from_millis(10));
        assert_eq!(operation, "test_operation");
        assert_eq!(context.get("user_id").unwrap(), &json!("test_user"));
    }

    #[tokio::test]
    async fn test_performance_monitor_record_request() {
        let logger = create_test_logger().await;
        let monitor = PerformanceMonitor::new(logger);
        
        let timer = RequestTimer::start("test_request".to_string());
        tokio::time::sleep(Duration::from_millis(10)).await;
        
        monitor.record_request(timer).await;
        
        // Request count should be incremented
        // Note: In a real test, you'd need access to internal counters
        // This is a simplified test
    }

    #[tokio::test]
    async fn test_performance_monitor_record_error() {
        let logger = create_test_logger().await;
        let monitor = PerformanceMonitor::new(logger);
        
        let error = HedgeXError::ValidationError("Test error".to_string());
        let context = Some(HashMap::from([
            ("component".to_string(), json!("test")),
        ]));
        
        monitor.record_error(&error, context).await;
        
        // Error count should be incremented
        // Note: In a real test, you'd need access to internal counters
    }

    #[tokio::test]
    async fn test_alert_threshold() {
        let logger = create_test_logger().await;
        let monitor = PerformanceMonitor::new(logger);
        
        let threshold = AlertThreshold {
            metric_name: "cpu_usage".to_string(),
            threshold: 80.0,
            comparison: AlertComparison::GreaterThan,
            duration: Duration::from_secs(60),
            enabled: true,
        };
        
        monitor.add_alert_threshold(threshold).await;
        
        // In a real implementation, you'd test that alerts are triggered
        // when thresholds are exceeded
    }

    #[tokio::test]
    async fn test_performance_metrics_serialization() {
        let metrics = PerformanceMetrics {
            timestamp: chrono::Utc::now(),
            cpu_usage: 45.2,
            memory_usage: 67.8,
            disk_usage: 23.1,
            network_latency: Some(12.5),
            active_connections: 10,
            request_rate: 15.3,
            error_rate: 0.8,
            response_time_avg: 145.3,
            response_time_p95: 287.6,
            response_time_p99: 456.2,
        };
        
        let serialized = serde_json::to_string(&metrics).unwrap();
        let deserialized: PerformanceMetrics = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(metrics.cpu_usage, deserialized.cpu_usage);
        assert_eq!(metrics.memory_usage, deserialized.memory_usage);
        assert_eq!(metrics.request_rate, deserialized.request_rate);
    }

    #[tokio::test]
    async fn test_performance_alert_serialization() {
        let alert = PerformanceAlert {
            id: "test_alert".to_string(),
            metric_name: "cpu_usage".to_string(),
            current_value: 85.0,
            threshold: 80.0,
            message: "CPU usage is high".to_string(),
            severity: AlertSeverity::High,
            timestamp: chrono::Utc::now(),
            resolved: false,
        };
        
        let serialized = serde_json::to_string(&alert).unwrap();
        let deserialized: PerformanceAlert = serde_json::from_str(&serialized).unwrap();
        
        assert_eq!(alert.id, deserialized.id);
        assert_eq!(alert.current_value, deserialized.current_value);
        assert_eq!(alert.resolved, deserialized.resolved);
    }

    #[tokio::test]
    async fn test_monitoring_enable_disable() {
        let logger = create_test_logger().await;
        let monitor = PerformanceMonitor::new(logger);
        
        assert!(monitor.is_monitoring_enabled());
        
        monitor.set_monitoring_enabled(false);
        assert!(!monitor.is_monitoring_enabled());
        
        monitor.set_monitoring_enabled(true);
        assert!(monitor.is_monitoring_enabled());
    }

    #[tokio::test]
    async fn test_alert_severity_determination() {
        // Test CPU usage alert severity
        let severity = PerformanceMonitor::determine_alert_severity("cpu_usage", 160.0, 80.0);
        assert!(matches!(severity, AlertSeverity::Critical));
        
        let severity = PerformanceMonitor::determine_alert_severity("cpu_usage", 120.0, 80.0);
        assert!(matches!(severity, AlertSeverity::High));
        
        let severity = PerformanceMonitor::determine_alert_severity("cpu_usage", 96.0, 80.0);
        assert!(matches!(severity, AlertSeverity::Medium));
        
        let severity = PerformanceMonitor::determine_alert_severity("cpu_usage", 85.0, 80.0);
        assert!(matches!(severity, AlertSeverity::Low));
        
        // Test error rate alert severity
        let severity = PerformanceMonitor::determine_alert_severity("error_rate", 15.0, 5.0);
        assert!(matches!(severity, AlertSeverity::Critical));
        
        let severity = PerformanceMonitor::determine_alert_severity("error_rate", 7.0, 5.0);
        assert!(matches!(severity, AlertSeverity::High));
        
        let severity = PerformanceMonitor::determine_alert_severity("error_rate", 3.0, 2.0);
        assert!(matches!(severity, AlertSeverity::Medium));
        
        let severity = PerformanceMonitor::determine_alert_severity("error_rate", 1.0, 2.0);
        assert!(matches!(severity, AlertSeverity::Low));
    }

    #[tokio::test]
    async fn test_metric_value_extraction() {
        let metrics = PerformanceMetrics {
            timestamp: chrono::Utc::now(),
            cpu_usage: 45.2,
            memory_usage: 67.8,
            disk_usage: 23.1,
            network_latency: Some(12.5),
            active_connections: 10,
            request_rate: 15.3,
            error_rate: 0.8,
            response_time_avg: 145.3,
            response_time_p95: 287.6,
            response_time_p99: 456.2,
        };
        
        assert_eq!(PerformanceMonitor::get_metric_value(&metrics, "cpu_usage"), 45.2);
        assert_eq!(PerformanceMonitor::get_metric_value(&metrics, "memory_usage"), 67.8);
        assert_eq!(PerformanceMonitor::get_metric_value(&metrics, "request_rate"), 15.3);
        assert_eq!(PerformanceMonitor::get_metric_value(&metrics, "unknown_metric"), 0.0);
    }

    #[tokio::test]
    async fn test_alert_comparison() {
        let greater_than = AlertComparison::GreaterThan;
        let less_than = AlertComparison::LessThan;
        let equals = AlertComparison::Equals;
        
        // Test serialization/deserialization
        let serialized = serde_json::to_string(&greater_than).unwrap();
        let deserialized: AlertComparison = serde_json::from_str(&serialized).unwrap();
        assert!(matches!(deserialized, AlertComparison::GreaterThan));
        
        let serialized = serde_json::to_string(&less_than).unwrap();
        let deserialized: AlertComparison = serde_json::from_str(&serialized).unwrap();
        assert!(matches!(deserialized, AlertComparison::LessThan));
        
        let serialized = serde_json::to_string(&equals).unwrap();
        let deserialized: AlertComparison = serde_json::from_str(&serialized).unwrap();
        assert!(matches!(deserialized, AlertComparison::Equals));
    }
}