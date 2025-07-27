import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  Bug, 
  Zap,
  Search,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';

interface SystemLog {
  id: string;
  user_id?: string;
  log_level: number;
  message: string;
  created_at: string;
  context?: string;
}

interface LogFilters {
  level?: number;
  search?: string;
  date_from?: string;
  date_to?: string;
}

interface LogViewerProps {
  onExport?: (logs: SystemLog[]) => void;
}

const LogViewer: React.FC<LogViewerProps> = ({ onExport }) => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SystemLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LogFilters>({});
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(50);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, filters]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 5000); // Refresh every 5 seconds
      setRefreshInterval(interval);
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [autoRefresh]);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Call backend API to get logs
      const response = await invoke<{ success: boolean; data: SystemLog[]; error?: string }>('get_system_logs', {
        limit: 1000,
        offset: 0
      });
      
      if (response.success && response.data) {
        setLogs(response.data);
      } else {
        setError(response.error || 'Failed to fetch logs');
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      setError('Failed to load system logs. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...logs];

    // Apply level filter
    if (filters.level !== undefined) {
      filtered = filtered.filter(log => log.log_level === filters.level);
    }

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchTerm) ||
        (log.context && log.context.toLowerCase().includes(searchTerm))
      );
    }

    // Apply date filters
    if (filters.date_from) {
      filtered = filtered.filter(log => 
        new Date(log.created_at) >= new Date(filters.date_from!)
      );
    }

    if (filters.date_to) {
      filtered = filtered.filter(log => 
        new Date(log.created_at) <= new Date(filters.date_to!)
      );
    }

    // Sort by created_at descending (newest first)
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setFilteredLogs(filtered);
    setTotalPages(Math.ceil(filtered.length / itemsPerPage));
    setCurrentPage(1);
  };

  const handleFilterChange = (key: keyof LogFilters, value: string | number) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === 'all' || value === '' ? undefined : value
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const handleExport = () => {
    if (onExport) {
      onExport(filteredLogs);
    } else {
      // Default export functionality
      exportLogsToCSV(filteredLogs);
    }
  };

  const exportLogsToCSV = (logs: SystemLog[]) => {
    const headers = ['Timestamp', 'Level', 'Message', 'User ID', 'Context'];
    const csvContent = [
      headers.join(','),
      ...logs.map(log => [
        new Date(log.created_at).toISOString(),
        getLogLevelInfo(log.log_level).name,
        `"${log.message.replace(/"/g, '""')}"`, // Escape quotes in CSV
        log.user_id || '',
        log.context ? `"${log.context.replace(/"/g, '""')}"` : ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `system_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(prev => !prev);
  };

  // Pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLogs = filteredLogs.slice(startIndex, endIndex);

  const getLogLevelInfo = (level: number) => {
    switch (level) {
      case 1: // Error
        return {
          name: 'ERROR',
          icon: <AlertCircle className="w-4 h-4" />,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      case 2: // Warn
        return {
          name: 'WARN',
          icon: <AlertTriangle className="w-4 h-4" />,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200'
        };
      case 3: // Info
        return {
          name: 'INFO',
          icon: <Info className="w-4 h-4" />,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        };
      case 4: // Debug
        return {
          name: 'DEBUG',
          icon: <Bug className="w-4 h-4" />,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200'
        };
      case 5: // Trace
        return {
          name: 'TRACE',
          icon: <Zap className="w-4 h-4" />,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
      default:
        return {
          name: 'UNKNOWN',
          icon: <Info className="w-4 h-4" />,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
    }
  };

  const getLogLevelCounts = () => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    filteredLogs.forEach(log => {
      if (counts[log.log_level as keyof typeof counts] !== undefined) {
        counts[log.log_level as keyof typeof counts]++;
      }
    });
    return counts;
  };

  const logCounts = getLogLevelCounts();

  if (isLoading && logs.length === 0) {
    return (
      <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
            <span className="ml-3 text-slate-600">Loading system logs...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold text-slate-900">System Logs</CardTitle>
            <CardDescription className="text-slate-600">
              Real-time system logs with filtering and search capabilities
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant={autoRefresh ? "default" : "outline"} 
              onClick={toggleAutoRefresh} 
              size="sm"
              className={autoRefresh ? "bg-green-600 hover:bg-green-700" : ""}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto' : 'Manual'}
            </Button>
            <Button variant="outline" onClick={clearFilters} size="sm">
              Clear Filters
            </Button>
            <Button variant="outline" onClick={handleExport} size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl mb-6 flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span>{error}</span>
          </div>
        )}

        {/* Log Level Summary */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[1, 2, 3, 4, 5].map(level => {
            const levelInfo = getLogLevelInfo(level);
            return (
              <div 
                key={level}
                className={`p-3 rounded-lg border ${levelInfo.bgColor} ${levelInfo.borderColor} cursor-pointer hover:shadow-md transition-all`}
                onClick={() => handleFilterChange('level', filters.level === level ? '' : level)}
              >
                <div className={`flex items-center space-x-2 ${levelInfo.color}`}>
                  {levelInfo.icon}
                  <span className="font-medium text-sm">{levelInfo.name}</span>
                </div>
                <div className="text-lg font-bold text-slate-900 mt-1">
                  {logCounts[level as keyof typeof logCounts]}
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Log Level</label>
            <Select value={filters.level?.toString() || ''} onValueChange={(value) => handleFilterChange('level', value ? parseInt(value) : '')}>
              <SelectTrigger>
                <SelectValue placeholder="All levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value="1">ERROR</SelectItem>
                <SelectItem value="2">WARN</SelectItem>
                <SelectItem value="3">INFO</SelectItem>
                <SelectItem value="4">DEBUG</SelectItem>
                <SelectItem value="5">TRACE</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search logs..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">From Date</label>
            <Input
              type="datetime-local"
              value={filters.date_from || ''}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To Date</label>
            <Input
              type="datetime-local"
              value={filters.date_to || ''}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
            />
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-slate-600">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredLogs.length)} of {filteredLogs.length} logs
          </div>
          <Button variant="outline" onClick={fetchLogs} size="sm" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Log Entries */}
        <div className="space-y-2">
          {currentLogs.length > 0 ? (
            currentLogs.map((log) => {
              const levelInfo = getLogLevelInfo(log.log_level);
              return (
                <div 
                  key={log.id} 
                  className={`p-4 rounded-lg border ${levelInfo.bgColor} ${levelInfo.borderColor} hover:shadow-md transition-all`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`flex items-center space-x-2 ${levelInfo.color} min-w-0 flex-shrink-0`}>
                      {levelInfo.icon}
                      <span className="font-medium text-sm">{levelInfo.name}</span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-slate-500">
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                        {log.user_id && (
                          <div className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
                            User: {log.user_id.substring(0, 8)}...
                          </div>
                        )}
                      </div>
                      
                      <div className="text-slate-900 font-medium mb-2 break-words">
                        {log.message}
                      </div>
                      
                      {log.context && (
                        <div className="text-sm text-slate-600 bg-slate-100 p-2 rounded font-mono break-all">
                          {log.context}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Filter className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No logs found matching the current filters</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LogViewer;