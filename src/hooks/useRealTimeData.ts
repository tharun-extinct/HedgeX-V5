import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  realTimeService, 
  RealTimeEvent, 
  MarketDataUpdate, 
  PositionUpdate, 
  OrderUpdate, 
  ConnectionStatus 
} from '../lib/realtime-service';
import { useAuth } from '../contexts/AuthContext';
import { useError } from '../contexts/ErrorContext';

// Hook for real-time market data
export const useMarketData = () => {
  const [marketData, setMarketData] = useState<MarketDataUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useAuth();
  const { handleError } = useError();

  useEffect(() => {
    if (!isAuthenticated) {
      setMarketData([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribe = realTimeService.subscribe((event: RealTimeEvent) => {
      if (event.type === 'market_data') {
        setMarketData(prev => {
          const updated = [...prev];
          const index = updated.findIndex(item => item.symbol === event.data.symbol);
          
          if (index >= 0) {
            updated[index] = event.data;
          } else {
            updated.push(event.data);
          }
          
          return updated;
        });
        setIsLoading(false);
      } else if (event.type === 'error') {
        handleError(event.data.message, { code: event.data.code });
        setIsLoading(false);
      }
    });

    // Start service if not already running
    realTimeService.start().catch(error => {
      handleError(error.message || 'Failed to start real-time service');
      setIsLoading(false);
    });

    // Get initial data
    const initialData = realTimeService.getMarketData();
    if (initialData.length > 0) {
      setMarketData(initialData);
      setIsLoading(false);
    }

    return unsubscribe;
  }, [isAuthenticated, handleError]);

  const refresh = useCallback(async () => {
    try {
      await realTimeService.refresh();
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Failed to refresh market data');
    }
  }, [handleError]);

  return {
    marketData,
    isLoading,
    refresh
  };
};

// Hook for real-time positions
export const usePositions = () => {
  const [positions, setPositions] = useState<PositionUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useAuth();
  const { handleError } = useError();

  useEffect(() => {
    if (!isAuthenticated) {
      setPositions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribe = realTimeService.subscribe((event: RealTimeEvent) => {
      if (event.type === 'position_update') {
        setPositions(prev => {
          const updated = [...prev];
          const index = updated.findIndex(item => item.symbol === event.data.symbol);
          
          if (index >= 0) {
            updated[index] = event.data;
          } else {
            updated.push(event.data);
          }
          
          return updated;
        });
        setIsLoading(false);
      } else if (event.type === 'error') {
        handleError(event.data.message, { code: event.data.code });
        setIsLoading(false);
      }
    });

    // Start service if not already running
    realTimeService.start().catch(error => {
      handleError(error.message || 'Failed to start real-time service');
      setIsLoading(false);
    });

    // Get initial data
    const initialData = realTimeService.getPositions();
    if (initialData.length > 0) {
      setPositions(initialData);
      setIsLoading(false);
    }

    return unsubscribe;
  }, [isAuthenticated, handleError]);

  const refresh = useCallback(async () => {
    try {
      await realTimeService.refresh();
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Failed to refresh positions');
    }
  }, [handleError]);

  return {
    positions,
    isLoading,
    refresh
  };
};

// Hook for real-time orders
export const useOrders = () => {
  const [orders, setOrders] = useState<OrderUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useAuth();
  const { handleError } = useError();

  useEffect(() => {
    if (!isAuthenticated) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribe = realTimeService.subscribe((event: RealTimeEvent) => {
      if (event.type === 'order_update') {
        setOrders(prev => {
          const updated = [...prev];
          const index = updated.findIndex(item => item.id === event.data.id);
          
          if (index >= 0) {
            updated[index] = event.data;
          } else {
            updated.push(event.data);
          }
          
          return updated;
        });
        setIsLoading(false);
      } else if (event.type === 'error') {
        handleError(event.data.message, { code: event.data.code });
        setIsLoading(false);
      }
    });

    // Start service if not already running
    realTimeService.start().catch(error => {
      handleError(error.message || 'Failed to start real-time service');
      setIsLoading(false);
    });

    // Get initial data
    const initialData = realTimeService.getOrders();
    if (initialData.length > 0) {
      setOrders(initialData);
      setIsLoading(false);
    }

    return unsubscribe;
  }, [isAuthenticated, handleError]);

  const refresh = useCallback(async () => {
    try {
      await realTimeService.refresh();
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Failed to refresh orders');
    }
  }, [handleError]);

  return {
    orders,
    isLoading,
    refresh
  };
};

// Hook for WebSocket connection status
export const useConnectionStatus = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ status: 'disconnected' });
  const { isAuthenticated } = useAuth();
  const { handleError } = useError();

  useEffect(() => {
    if (!isAuthenticated) {
      setConnectionStatus({ status: 'disconnected' });
      return;
    }

    const unsubscribe = realTimeService.subscribe((event: RealTimeEvent) => {
      if (event.type === 'connection_status') {
        setConnectionStatus(event.data);
      } else if (event.type === 'error') {
        handleError(event.data.message, { code: event.data.code });
      }
    });

    // Start service if not already running
    realTimeService.start().catch(error => {
      handleError(error.message || 'Failed to start real-time service');
    });

    // Get initial status
    const initialStatus = realTimeService.getConnectionStatus();
    setConnectionStatus(initialStatus);

    return unsubscribe;
  }, [isAuthenticated, handleError]);

  const connect = useCallback(async () => {
    try {
      await realTimeService.connect();
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Failed to connect');
      throw error;
    }
  }, [handleError]);

  const disconnect = useCallback(async () => {
    try {
      await realTimeService.disconnect();
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Failed to disconnect');
      throw error;
    }
  }, [handleError]);

  const reconnect = useCallback(async () => {
    try {
      await realTimeService.reconnect();
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Failed to reconnect');
      throw error;
    }
  }, [handleError]);

  return {
    connectionStatus,
    connect,
    disconnect,
    reconnect
  };
};

// Combined hook for all real-time data
export const useRealTimeData = () => {
  const marketData = useMarketData();
  const positions = usePositions();
  const orders = useOrders();
  const connectionStatus = useConnectionStatus();
  const { isAuthenticated } = useAuth();

  const isLoading = marketData.isLoading || positions.isLoading || orders.isLoading;

  const refresh = useCallback(async () => {
    await Promise.all([
      marketData.refresh(),
      positions.refresh(),
      orders.refresh()
    ]);
  }, [marketData.refresh, positions.refresh, orders.refresh]);

  // Stop service when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      realTimeService.stop();
    }
  }, [isAuthenticated]);

  return {
    marketData: marketData.marketData,
    positions: positions.positions,
    orders: orders.orders,
    connectionStatus: connectionStatus.connectionStatus,
    isLoading,
    refresh,
    connect: connectionStatus.connect,
    disconnect: connectionStatus.disconnect,
    reconnect: connectionStatus.reconnect
  };
};

// Hook for trading operations with real-time feedback
export const useTradingOperations = () => {
  const { handleError, addSuccess } = useError();
  const [isLoading, setIsLoading] = useState(false);

  const placeQuickOrder = useCallback(async (order: {
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
  }) => {
    setIsLoading(true);
    try {
      const result = await realTimeService.placeQuickOrder(order);
      addSuccess(`${order.action} order placed successfully for ${order.symbol}`);
      
      // Refresh data to get updated positions/orders
      await realTimeService.refresh();
      
      return result;
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Failed to place order');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [handleError, addSuccess]);

  const cancelOrder = useCallback(async (orderId: string) => {
    setIsLoading(true);
    try {
      await realTimeService.cancelOrder(orderId);
      addSuccess('Order cancelled successfully');
      
      // Refresh data to get updated orders
      await realTimeService.refresh();
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Failed to cancel order');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [handleError, addSuccess]);

  const closePosition = useCallback(async (symbol: string) => {
    setIsLoading(true);
    try {
      await realTimeService.closePosition(symbol);
      addSuccess(`Position closed successfully for ${symbol}`);
      
      // Refresh data to get updated positions
      await realTimeService.refresh();
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Failed to close position');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [handleError, addSuccess]);

  const startTrading = useCallback(async () => {
    setIsLoading(true);
    try {
      await realTimeService.startTrading();
      addSuccess('Trading started successfully');
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Failed to start trading');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [handleError, addSuccess]);

  const stopTrading = useCallback(async () => {
    setIsLoading(true);
    try {
      await realTimeService.stopTrading();
      addSuccess('Trading stopped successfully');
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Failed to stop trading');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [handleError, addSuccess]);

  const emergencyStop = useCallback(async () => {
    setIsLoading(true);
    try {
      await realTimeService.emergencyStop();
      addSuccess('Emergency stop executed successfully');
    } catch (error) {
      handleError(error instanceof Error ? error.message : 'Emergency stop failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [handleError, addSuccess]);

  return {
    placeQuickOrder,
    cancelOrder,
    closePosition,
    startTrading,
    stopTrading,
    emergencyStop,
    isLoading
  };
};

// Hook for performance monitoring
export const usePerformanceMonitoring = () => {
  const [metrics, setMetrics] = useState({
    updateLatency: 0,
    messageRate: 0,
    connectionUptime: 0,
    errorRate: 0
  });
  
  const updateLatencyRef = useRef<number[]>([]);
  const errorCountRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    const unsubscribe = realTimeService.subscribe((event: RealTimeEvent) => {
      const now = Date.now();
      
      if (event.type === 'market_data') {
        // Calculate update latency
        const eventTime = new Date(event.data.timestamp).getTime();
        const latency = now - eventTime;
        
        updateLatencyRef.current.push(latency);
        if (updateLatencyRef.current.length > 100) {
          updateLatencyRef.current.shift(); // Keep only last 100 measurements
        }
        
        const avgLatency = updateLatencyRef.current.reduce((sum, l) => sum + l, 0) / updateLatencyRef.current.length;
        
        setMetrics(prev => ({
          ...prev,
          updateLatency: avgLatency,
          connectionUptime: now - startTimeRef.current
        }));
      } else if (event.type === 'error') {
        errorCountRef.current++;
        
        setMetrics(prev => ({
          ...prev,
          errorRate: errorCountRef.current / ((now - startTimeRef.current) / 1000) // errors per second
        }));
      } else if (event.type === 'connection_status') {
        if (event.data.status === 'connected') {
          startTimeRef.current = now;
          errorCountRef.current = 0;
        }
        
        // Extract message rate if available
        if (event.data.message_rate) {
          const rate = parseFloat(event.data.message_rate.split('/')[0]);
          setMetrics(prev => ({
            ...prev,
            messageRate: rate
          }));
        }
      }
    });

    return unsubscribe;
  }, []);

  return metrics;
};