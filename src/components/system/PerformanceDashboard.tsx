import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  MemoryStick, 
  Network, 
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw
} from 'lucide-react';
import { ErrorAlert } from '../common/ErrorAlert';
import { useError } from '../../contexts/ErrorContext';

interface PerformanceMetrics {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  request_rate: number;
  error_rate: number;
  response_time_avg: number;
  response_time_p95: number;
  response_time_p99: number;
  timestamp: string;
}

interface HealthCheck {
  healthy: boolean;
  message: string;
  timestamp: string;
}

interface SystemHealth {
  overall_status: string;
  checks: {
    database: HealthCheck;
    api: HealthCheck;
    websocket: HealthCheck;
  };
}

interface CircuitBreakerStatus {
  state: string;
  failure_count: number;
  timestamp: string;
}

interface ErrorRecoveryStatus {
  circuit_breakers: {
    kite_api: CircuitBreakerStatus;
    database: CircuitBreakerStatus;
  };
}

export const PerformanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [recovery, setRecovery] = useState<ErrorRecoveryStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { handleError } = useError();

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      const [metricsResponse, healthResponse, recoveryResponse] = await Promise.all([
        invoke<{ success: boolean; data: PerformanceMetrics; error?: string }>('get_performance_metrics'),
        invoke<{ success: boolean; data: SystemHealth; error?: string }>('get_system_health'),
        invoke<{ success: boolean; data: ErrorRecoveryStatus; error?: string }>('get_error_recovery_status'),
      ]);

      if (metricsResponse.success) {
        setMetrics(metricsResponse.data);
      } else {
        handleError(metricsResponse.error || 'Failed to fetch performance metrics');
      }

      if (healthResponse.success) {
        setHealth(healthResponse.data);
      } else {
        handleError(healthResponse.error || 'Failed to fetch system health');
      }

      if (recoveryResponse.success) {
        setRecovery(recoveryResponse.data);
      } else {
        handleError(recoveryResponse.error || 'Failed to fetch error recovery status');
      }

      setLastUpdated(new Date());
    } catch (error) {
      handleError(error as Error, { context: 'performance_dashboard' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const resetCircuitBreaker = async (serviceName: string) => {
    try {
      const response = await invoke<{ success: boolean; message: string; error?: string }>(
        'reset_circuit_breaker',
        { serviceName }
      );

      if (response.success) {
        // Refresh data after reset
        await fetchData();
      } else {
        handleError(response.error || 'Failed to reset circuit breaker');
      }
    } catch (error) {
      handleError(error as Error, { context: 'reset_circuit_breaker', service: serviceName });
    }
  };

  const getUsageColor = (usage: number, type: 'cpu' | 'memory' | 'disk' | 'error_rate') => {
    if (type === 'error_rate') {
      if (usage > 5) return 'text-red-600';
      if (usage > 2) return 'text-yellow-600';
      return 'text-green-600';
    }
    
    if (usage > 80) return 'text-red-600';
    if (usage > 60) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getUsageBgColor = (usage: number, type: 'cpu' | 'memory' | 'disk' | 'error_rate') => {
    if (type === 'error_rate') {
      if (usage > 5) return 'bg-red-100';
      if (usage > 2) return 'bg-yellow-100';
      return 'bg-green-100';
    }
    
    if (usage > 80) return 'bg-red-100';
    if (usage > 60) return 'bg-yellow-100';
    return 'bg-green-100';
  };

  const formatResponseTime = (time: number) => {
    if (time < 1000) return `${time.toFixed(1)}ms`;
    return `${(time / 1000).toFixed(2)}s`;
  };

  if (isLoading && !metrics) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Loading performance data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Performance</h1>
          <p className="text-gray-600">Monitor system health and performance metrics</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {lastUpdated && (
            <div className="flex items-center text-sm text-gray-500">
              <Clock className="w-4 h-4 mr-1" />
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
          
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* System Health Overview */}
      {health && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            System Health
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(health.checks).map(([service, check]) => (
              <div
                key={service}
                className={`p-4 rounded-lg border ${
                  check.healthy ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium capitalize">{service}</span>
                  {check.healthy ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <p className={`text-sm ${check.healthy ? 'text-green-700' : 'text-red-700'}`}>
                  {check.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* CPU Usage */}
          <div className={`bg-white rounded-lg shadow p-6 ${getUsageBgColor(metrics.cpu_usage, 'cpu')}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Cpu className="w-8 h-8 text-blue-600 mr-3" />
                <div>
                  <h3 className="font-semibold">CPU Usage</h3>
                  <p className="text-sm text-gray-600">Current utilization</p>
                </div>
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">
              <span className={getUsageColor(metrics.cpu_usage, 'cpu')}>
                {metrics.cpu_usage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(metrics.cpu_usage, 100)}%` }}
              />
            </div>
          </div>

          {/* Memory Usage */}
          <div className={`bg-white rounded-lg shadow p-6 ${getUsageBgColor(metrics.memory_usage, 'memory')}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <MemoryStick className="w-8 h-8 text-green-600 mr-3" />
                <div>
                  <h3 className="font-semibold">Memory Usage</h3>
                  <p className="text-sm text-gray-600">RAM utilization</p>
                </div>
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">
              <span className={getUsageColor(metrics.memory_usage, 'memory')}>
                {metrics.memory_usage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(metrics.memory_usage, 100)}%` }}
              />
            </div>
          </div>

          {/* Disk Usage */}
          <div className={`bg-white rounded-lg shadow p-6 ${getUsageBgColor(metrics.disk_usage, 'disk')}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <HardDrive className="w-8 h-8 text-purple-600 mr-3" />
                <div>
                  <h3 className="font-semibold">Disk Usage</h3>
                  <p className="text-sm text-gray-600">Storage utilization</p>
                </div>
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">
              <span className={getUsageColor(metrics.disk_usage, 'disk')}>
                {metrics.disk_usage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(metrics.disk_usage, 100)}%` }}
              />
            </div>
          </div>

          {/* Error Rate */}
          <div className={`bg-white rounded-lg shadow p-6 ${getUsageBgColor(metrics.error_rate, 'error_rate')}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <AlertTriangle className="w-8 h-8 text-red-600 mr-3" />
                <div>
                  <h3 className="font-semibold">Error Rate</h3>
                  <p className="text-sm text-gray-600">Request failures</p>
                </div>
              </div>
            </div>
            <div className="text-3xl font-bold mb-2">
              <span className={getUsageColor(metrics.error_rate, 'error_rate')}>
                {metrics.error_rate.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center text-sm text-gray-600">
              {metrics.error_rate > 2 ? (
                <TrendingUp className="w-4 h-4 mr-1 text-red-500" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-1 text-green-500" />
              )}
              {metrics.request_rate.toFixed(1)} req/s
            </div>
          </div>
        </div>
      )}

      {/* Response Time Metrics */}
      {metrics && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Network className="w-5 h-5 mr-2" />
            Response Time Metrics
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {formatResponseTime(metrics.response_time_avg)}
              </div>
              <div className="text-sm text-gray-600">Average</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 mb-1">
                {formatResponseTime(metrics.response_time_p95)}
              </div>
              <div className="text-sm text-gray-600">95th Percentile</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 mb-1">
                {formatResponseTime(metrics.response_time_p99)}
              </div>
              <div className="text-sm text-gray-600">99th Percentile</div>
            </div>
          </div>
        </div>
      )}

      {/* Circuit Breaker Status */}
      {recovery && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Error Recovery Status
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(recovery.circuit_breakers).map(([service, breaker]) => (
              <div
                key={service}
                className={`p-4 rounded-lg border ${
                  breaker.state === 'Closed' 
                    ? 'border-green-200 bg-green-50' 
                    : breaker.state === 'Open'
                    ? 'border-red-200 bg-red-50'
                    : 'border-yellow-200 bg-yellow-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium capitalize">{service.replace('_', ' ')}</span>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      breaker.state === 'Closed' 
                        ? 'bg-green-100 text-green-800' 
                        : breaker.state === 'Open'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {breaker.state}
                    </span>
                    
                    {breaker.state === 'Open' && (
                      <button
                        onClick={() => resetCircuitBreaker(service)}
                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="text-sm text-gray-600">
                  Failures: {breaker.failure_count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};