import { apiClient, ApiError } from './api-client';

// Types for real-time data
export interface MarketDataUpdate {
  symbol: string;
  instrument_token: number;
  ltp: number;
  volume: number;
  bid: number;
  ask: number;
  ohlc?: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  timestamp: string;
  change?: number;
  change_percent?: number;
}

export interface PositionUpdate {
  symbol: string;
  exchange: string;
  quantity: number;
  average_price: number;
  current_price: number;
  pnl: number;
  pnl_percentage: number;
  trade_type: 'Buy' | 'Sell';
  last_updated: string;
}

export interface OrderUpdate {
  id: string;
  symbol: string;
  exchange: string;
  order_type: string;
  trade_type: 'Buy' | 'Sell';
  quantity: number;
  price?: number;
  filled_quantity: number;
  pending_quantity: number;
  status: 'Pending' | 'Executed' | 'Cancelled' | 'Rejected';
  updated_at: string;
}

export interface ConnectionStatus {
  status: 'connected' | 'disconnected' | 'connecting' | 'failed';
  last_connected?: string;
  error?: string;
  subscriptions?: string[];
  message_rate?: string;
}

// Event types for subscribers
export type RealTimeEvent = 
  | { type: 'market_data'; data: MarketDataUpdate }
  | { type: 'position_update'; data: PositionUpdate }
  | { type: 'order_update'; data: OrderUpdate }
  | { type: 'connection_status'; data: ConnectionStatus }
  | { type: 'error'; data: { message: string; code?: string } };

// Subscriber callback type
export type RealTimeSubscriber = (event: RealTimeEvent) => void;

// Real-time service class
export class RealTimeService {
  private subscribers: Set<RealTimeSubscriber> = new Set();
  private marketDataCache: Map<string, MarketDataUpdate> = new Map();
  private positionsCache: Map<string, PositionUpdate> = new Map();
  private ordersCache: Map<string, OrderUpdate> = new Map();
  private connectionStatus: ConnectionStatus = { status: 'disconnected' };
  
  private updateInterval: NodeJS.Timeout | null = null;
  private connectionCheckInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  
  // Configuration
  private config = {
    updateInterval: 1000, // 1 second
    connectionCheckInterval: 5000, // 5 seconds
    maxRetries: 3,
    retryDelay: 2000
  };

  constructor() {
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
  }

  // Start the real-time service
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    try {
      // Check initial connection status
      await this.checkConnectionStatus();
      
      // Start update intervals
      this.startUpdateIntervals();
      
      // Set up event listeners
      this.setupEventListeners();
      
      console.log('Real-time service started');
    } catch (error) {
      console.error('Failed to start real-time service:', error);
      this.notifySubscribers({
        type: 'error',
        data: {
          message: 'Failed to start real-time service',
          code: 'SERVICE_START_ERROR'
        }
      });
    }
  }

  // Stop the real-time service
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    // Clear intervals
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    
    // Remove event listeners
    this.removeEventListeners();
    
    // Clear caches
    this.marketDataCache.clear();
    this.positionsCache.clear();
    this.ordersCache.clear();
    
    console.log('Real-time service stopped');
  }

  // Subscribe to real-time updates
  subscribe(callback: RealTimeSubscriber): () => void {
    this.subscribers.add(callback);
    
    // Send current cached data to new subscriber
    this.sendCachedDataToSubscriber(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // Get current market data
  getMarketData(): MarketDataUpdate[] {
    return Array.from(this.marketDataCache.values());
  }

  // Get current positions
  getPositions(): PositionUpdate[] {
    return Array.from(this.positionsCache.values());
  }

  // Get current orders
  getOrders(): OrderUpdate[] {
    return Array.from(this.ordersCache.values());
  }

  // Get connection status
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  // Force refresh all data
  async refresh(): Promise<void> {
    try {
      await Promise.all([
        this.updateMarketData(),
        this.updatePositions(),
        this.updateOrders(),
        this.checkConnectionStatus()
      ]);
    } catch (error) {
      console.error('Failed to refresh data:', error);
      this.notifySubscribers({
        type: 'error',
        data: {
          message: 'Failed to refresh data',
          code: 'REFRESH_ERROR'
        }
      });
    }
  }

  // Connect to WebSocket
  async connect(): Promise<void> {
    try {
      await apiClient.connectWebSocket();
      await this.checkConnectionStatus();
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      throw error;
    }
  }

  // Disconnect from WebSocket
  async disconnect(): Promise<void> {
    try {
      await apiClient.disconnectWebSocket();
      await this.checkConnectionStatus();
    } catch (error) {
      console.error('Failed to disconnect WebSocket:', error);
      throw error;
    }
  }

  // Reconnect WebSocket
  async reconnect(): Promise<void> {
    try {
      await apiClient.reconnectWebSocket();
      await this.checkConnectionStatus();
    } catch (error) {
      console.error('Failed to reconnect WebSocket:', error);
      throw error;
    }
  }

  // Trading operations
  async placeQuickOrder(order: {
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
  }): Promise<{ success: boolean; order_id: string }> {
    return apiClient.placeQuickOrder(order);
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    return apiClient.cancelOrder(orderId);
  }

  async closePosition(symbol: string): Promise<boolean> {
    return apiClient.closePosition(symbol);
  }

  async startTrading(): Promise<boolean> {
    return apiClient.startTrading();
  }

  async stopTrading(): Promise<boolean> {
    return apiClient.stopTrading();
  }

  async emergencyStop(): Promise<boolean> {
    return apiClient.emergencyStop();
  }

  // Private methods

  private startUpdateIntervals(): void {
    // Main update interval for market data, positions, and orders
    this.updateInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await Promise.all([
          this.updateMarketData(),
          this.updatePositions(),
          this.updateOrders()
        ]);
      } catch (error) {
        console.error('Update interval error:', error);
      }
    }, this.config.updateInterval);

    // Connection status check interval
    this.connectionCheckInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.checkConnectionStatus();
      } catch (error) {
        console.error('Connection check error:', error);
      }
    }, this.config.connectionCheckInterval);
  }

  private async updateMarketData(): Promise<void> {
    try {
      const data = await apiClient.getMarketData();
      
      if (Array.isArray(data)) {
        const updates: MarketDataUpdate[] = data.map(item => ({
          symbol: item.symbol,
          instrument_token: item.instrument_token,
          ltp: parseFloat(item.ltp),
          volume: item.volume,
          bid: parseFloat(item.bid),
          ask: parseFloat(item.ask),
          ohlc: item.ohlc ? {
            open: parseFloat(item.ohlc.open),
            high: parseFloat(item.ohlc.high),
            low: parseFloat(item.ohlc.low),
            close: parseFloat(item.ohlc.close)
          } : undefined,
          timestamp: item.timestamp,
          change: item.change ? parseFloat(item.change) : undefined,
          change_percent: item.change_percent ? parseFloat(item.change_percent) : undefined
        }));

        // Update cache and notify subscribers
        updates.forEach(update => {
          const previous = this.marketDataCache.get(update.symbol);
          this.marketDataCache.set(update.symbol, update);
          
          // Only notify if data actually changed
          if (!previous || this.hasMarketDataChanged(previous, update)) {
            this.notifySubscribers({
              type: 'market_data',
              data: update
            });
          }
        });
      }
    } catch (error) {
      if (error instanceof ApiError) {
        console.warn('Market data update failed:', error.message);
      } else {
        console.error('Market data update error:', error);
      }
    }
  }

  private async updatePositions(): Promise<void> {
    try {
      const data = await apiClient.getPositions();
      
      if (Array.isArray(data)) {
        const updates: PositionUpdate[] = data.map(item => ({
          symbol: item.symbol,
          exchange: item.exchange,
          quantity: item.quantity,
          average_price: item.average_price,
          current_price: item.current_price,
          pnl: item.pnl,
          pnl_percentage: item.pnl_percentage,
          trade_type: item.trade_type,
          last_updated: item.last_updated || new Date().toISOString()
        }));

        // Update cache and notify subscribers
        updates.forEach(update => {
          const previous = this.positionsCache.get(update.symbol);
          this.positionsCache.set(update.symbol, update);
          
          // Only notify if data actually changed
          if (!previous || this.hasPositionChanged(previous, update)) {
            this.notifySubscribers({
              type: 'position_update',
              data: update
            });
          }
        });

        // Remove positions that are no longer present
        const currentSymbols = new Set(updates.map(u => u.symbol));
        for (const [symbol] of this.positionsCache) {
          if (!currentSymbols.has(symbol)) {
            this.positionsCache.delete(symbol);
          }
        }
      }
    } catch (error) {
      if (error instanceof ApiError) {
        console.warn('Positions update failed:', error.message);
      } else {
        console.error('Positions update error:', error);
      }
    }
  }

  private async updateOrders(): Promise<void> {
    try {
      const data = await apiClient.getOrders();
      
      if (Array.isArray(data)) {
        const updates: OrderUpdate[] = data.map(item => ({
          id: item.id,
          symbol: item.symbol,
          exchange: item.exchange,
          order_type: item.order_type,
          trade_type: item.trade_type,
          quantity: item.quantity,
          price: item.price,
          filled_quantity: item.filled_quantity || 0,
          pending_quantity: item.pending_quantity || item.quantity,
          status: item.status,
          updated_at: item.updated_at || new Date().toISOString()
        }));

        // Update cache and notify subscribers
        updates.forEach(update => {
          const previous = this.ordersCache.get(update.id);
          this.ordersCache.set(update.id, update);
          
          // Only notify if data actually changed
          if (!previous || this.hasOrderChanged(previous, update)) {
            this.notifySubscribers({
              type: 'order_update',
              data: update
            });
          }
        });

        // Remove orders that are no longer present
        const currentIds = new Set(updates.map(u => u.id));
        for (const [id] of this.ordersCache) {
          if (!currentIds.has(id)) {
            this.ordersCache.delete(id);
          }
        }
      }
    } catch (error) {
      if (error instanceof ApiError) {
        console.warn('Orders update failed:', error.message);
      } else {
        console.error('Orders update error:', error);
      }
    }
  }

  private async checkConnectionStatus(): Promise<void> {
    try {
      const status = await apiClient.getWebSocketStatus();
      
      const newStatus: ConnectionStatus = {
        status: status.status as ConnectionStatus['status'],
        last_connected: status.last_connected,
        error: status.error,
        subscriptions: status.subscriptions,
        message_rate: (status as any).message_rate
      };

      // Only notify if status changed
      if (this.hasConnectionStatusChanged(this.connectionStatus, newStatus)) {
        this.connectionStatus = newStatus;
        this.notifySubscribers({
          type: 'connection_status',
          data: newStatus
        });
      }
    } catch (error) {
      const errorStatus: ConnectionStatus = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      if (this.hasConnectionStatusChanged(this.connectionStatus, errorStatus)) {
        this.connectionStatus = errorStatus;
        this.notifySubscribers({
          type: 'connection_status',
          data: errorStatus
        });
      }
    }
  }

  private notifySubscribers(event: RealTimeEvent): void {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Subscriber callback error:', error);
      }
    });
  }

  private sendCachedDataToSubscriber(callback: RealTimeSubscriber): void {
    try {
      // Send connection status
      callback({
        type: 'connection_status',
        data: this.connectionStatus
      });

      // Send cached market data
      this.marketDataCache.forEach(data => {
        callback({
          type: 'market_data',
          data
        });
      });

      // Send cached positions
      this.positionsCache.forEach(data => {
        callback({
          type: 'position_update',
          data
        });
      });

      // Send cached orders
      this.ordersCache.forEach(data => {
        callback({
          type: 'order_update',
          data
        });
      });
    } catch (error) {
      console.error('Error sending cached data to subscriber:', error);
    }
  }

  // Change detection methods
  private hasMarketDataChanged(prev: MarketDataUpdate, curr: MarketDataUpdate): boolean {
    return prev.ltp !== curr.ltp ||
           prev.volume !== curr.volume ||
           prev.bid !== curr.bid ||
           prev.ask !== curr.ask ||
           prev.timestamp !== curr.timestamp;
  }

  private hasPositionChanged(prev: PositionUpdate, curr: PositionUpdate): boolean {
    return prev.quantity !== curr.quantity ||
           prev.current_price !== curr.current_price ||
           prev.pnl !== curr.pnl ||
           prev.last_updated !== curr.last_updated;
  }

  private hasOrderChanged(prev: OrderUpdate, curr: OrderUpdate): boolean {
    return prev.status !== curr.status ||
           prev.filled_quantity !== curr.filled_quantity ||
           prev.pending_quantity !== curr.pending_quantity ||
           prev.updated_at !== curr.updated_at;
  }

  private hasConnectionStatusChanged(prev: ConnectionStatus, curr: ConnectionStatus): boolean {
    return prev.status !== curr.status ||
           prev.error !== curr.error ||
           prev.last_connected !== curr.last_connected;
  }

  // Event listeners for browser events
  private setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      window.addEventListener('beforeunload', this.handleBeforeUnload);
    }
  }

  private removeEventListeners(): void {
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      // Page is hidden, reduce update frequency
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = setInterval(async () => {
          if (!this.isRunning) return;
          
          try {
            await this.updateMarketData();
          } catch (error) {
            console.error('Background update error:', error);
          }
        }, this.config.updateInterval * 5); // 5x slower when hidden
      }
    } else {
      // Page is visible, restore normal frequency
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.startUpdateIntervals();
      }
      
      // Refresh data when page becomes visible
      this.refresh();
    }
  }

  private handleBeforeUnload(): void {
    this.stop();
  }
}

// Create singleton instance
export const realTimeService = new RealTimeService();

// Types are already exported above in the file