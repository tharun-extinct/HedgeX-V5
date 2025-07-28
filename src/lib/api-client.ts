import { invoke } from '@tauri-apps/api/core';

// Error types for better error handling
export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends ApiError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'NETWORK_ERROR', undefined, context);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'AUTH_ERROR', 401, context);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, context);
    this.name = 'ValidationError';
  }
}

export class TradingError extends ApiError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'TRADING_ERROR', undefined, context);
    this.name = 'TradingError';
  }
}

// Response wrapper for consistent API responses
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  context?: Record<string, any>;
}

// Retry configuration
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'SERVICE_UNAVAILABLE']
};

// API client with error handling and retry logic
export class ApiClient {
  private retryConfig: RetryConfig;

  constructor(retryConfig: Partial<RetryConfig> = {}) {
    this.retryConfig = { ...defaultRetryConfig, ...retryConfig };
  }

  // Generic invoke wrapper with error handling
  async invoke<T = any>(
    command: string,
    args?: Record<string, any>,
    options: { timeout?: number; retries?: boolean } = {}
  ): Promise<T> {
    const { timeout = 30000, retries = true } = options;

    const executeCommand = async (): Promise<T> => {
      try {
        // Add timeout wrapper
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new NetworkError('Request timeout', { command, timeout }));
          }, timeout);
        });

        const commandPromise = invoke(command, args);
        const result = await Promise.race([commandPromise, timeoutPromise]);

        // Handle different response formats
        if (typeof result === 'object' && result !== null && 'success' in result) {
          const apiResponse = result as ApiResponse<T>;
          if (!apiResponse.success) {
            throw this.createErrorFromResponse(apiResponse, command, args);
          }
          return apiResponse.data as T;
        }

        return result as T;
      } catch (error) {
        // Convert Tauri errors to our error types
        if (error instanceof Error) {
          throw this.convertTauriError(error, command, args);
        }
        throw error;
      }
    };

    if (retries) {
      return this.executeWithRetry(executeCommand, command, args);
    } else {
      return executeCommand();
    }
  }

  // Execute command with retry logic
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    command: string,
    args?: Record<string, any>
  ): Promise<T> {
    let lastError: Error;
    let delay = this.retryConfig.baseDelay;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on the last attempt
        if (attempt === this.retryConfig.maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(error as ApiError)) {
          break;
        }

        // Wait before retry with exponential backoff
        await this.sleep(Math.min(delay, this.retryConfig.maxDelay));
        delay *= this.retryConfig.backoffMultiplier;

        console.warn(`Retrying command ${command} (attempt ${attempt + 1}/${this.retryConfig.maxRetries})`, {
          error: (error as Error).message,
          args
        });
      }
    }

    throw lastError!;
  }

  // Check if error should be retried
  private isRetryableError(error: ApiError): boolean {
    return this.retryConfig.retryableErrors.includes(error.code || '');
  }

  // Convert Tauri errors to our error types
  private convertTauriError(error: Error, command: string, args?: Record<string, any>): ApiError {
    const context = { command, args };

    // Check error message patterns to determine error type
    const message = error.message.toLowerCase();

    if (message.includes('authentication') || message.includes('unauthorized') || message.includes('invalid credentials')) {
      return new AuthenticationError(error.message, context);
    }

    if (message.includes('validation') || message.includes('invalid input') || message.includes('bad request')) {
      return new ValidationError(error.message, context);
    }

    if (message.includes('trading') || message.includes('order') || message.includes('position')) {
      return new TradingError(error.message, context);
    }

    if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return new NetworkError(error.message, context);
    }

    // Default to generic API error
    return new ApiError(error.message, 'UNKNOWN_ERROR', undefined, context);
  }

  // Create error from API response
  private createErrorFromResponse(response: ApiResponse, command: string, args?: Record<string, any>): ApiError {
    const context = { command, args, ...response.context };
    const message = response.error || 'Unknown API error';
    const code = response.code || 'API_ERROR';

    switch (code) {
      case 'AUTH_ERROR':
        return new AuthenticationError(message, context);
      case 'VALIDATION_ERROR':
        return new ValidationError(message, context);
      case 'TRADING_ERROR':
        return new TradingError(message, context);
      case 'NETWORK_ERROR':
        return new NetworkError(message, context);
      default:
        return new ApiError(message, code, undefined, context);
    }
  }

  // Utility function for delays
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Authentication methods
  async login(credentials: { username: string; password: string }) {
    return this.invoke<string>('login', credentials);
  }

  async logout(token: string) {
    return this.invoke<boolean>('logout', { token });
  }

  async validateSession(token: string) {
    return this.invoke<string>('validate_session', { token });
  }

  async createUser(userData: {
    fullName: string;
    email: string;
    username: string;
    password: string;
  }) {
    return this.invoke<ApiResponse>('create_user', userData);
  }

  // Trading methods
  async startTrading() {
    return this.invoke<boolean>('start_trading', undefined, { retries: false });
  }

  async stopTrading() {
    return this.invoke<boolean>('stop_trading', undefined, { retries: false });
  }

  async emergencyStop() {
    return this.invoke<boolean>('emergency_stop', undefined, { retries: false, timeout: 5000 });
  }

  async placeQuickOrder(order: {
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
  }) {
    return this.invoke<{ success: boolean; order_id: string }>('place_quick_order', order, { retries: false });
  }

  async cancelOrder(orderId: string) {
    return this.invoke<boolean>('cancel_order', { orderId }, { retries: false });
  }

  async closePosition(symbol: string) {
    return this.invoke<boolean>('close_position', { symbol }, { retries: false });
  }

  // Market data methods
  async getMarketData() {
    return this.invoke<any[]>('get_market_data');
  }

  async getPositions() {
    return this.invoke<any[]>('get_positions');
  }

  async getOrders() {
    return this.invoke<any[]>('get_orders');
  }

  async getRecentTrades() {
    return this.invoke<any[]>('get_recent_trades');
  }

  // Strategy methods
  async getStrategies() {
    return this.invoke<ApiResponse>('get_strategies');
  }

  async createStrategy(strategy: {
    name: string;
    description?: string;
    max_trades_per_day: number;
    risk_percentage: number;
    stop_loss_percentage: number;
    take_profit_percentage: number;
    volume_threshold: number;
  }) {
    return this.invoke<ApiResponse>('create_strategy', strategy);
  }

  async updateStrategy(strategyId: string, updates: Partial<{
    name: string;
    description: string;
    max_trades_per_day: number;
    risk_percentage: number;
    stop_loss_percentage: number;
    take_profit_percentage: number;
    volume_threshold: number;
  }>) {
    return this.invoke<ApiResponse>('update_strategy', strategyId, updates);
  }

  async enableStrategy(strategyId: string) {
    return this.invoke<ApiResponse>('enable_strategy', strategyId);
  }

  async disableStrategy(strategyId: string) {
    return this.invoke<ApiResponse>('disable_strategy', strategyId);
  }

  async deleteStrategy(strategyId: string) {
    return this.invoke<ApiResponse>('delete_strategy', strategyId);
  }

  // Stock selection methods
  async getNifty50Stocks() {
    return this.invoke<ApiResponse>('get_nifty_50_stocks');
  }

  async getStockSelections() {
    return this.invoke<ApiResponse>('get_stock_selections');
  }

  async addStockSelection(symbol: string, exchange: string = 'NSE') {
    return this.invoke<ApiResponse>('add_stock_selection', symbol, exchange);
  }

  async removeStockSelection(symbol: string) {
    return this.invoke<ApiResponse>('remove_stock_selection', symbol);
  }

  async bulkAddStockSelections(symbols: string[], exchange: string = 'NSE') {
    return this.invoke<ApiResponse>('bulk_add_stock_selections', symbols, exchange);
  }

  async bulkRemoveStockSelections(symbols: string[]) {
    return this.invoke<ApiResponse>('bulk_remove_stock_selections', symbols);
  }

  // Analytics methods
  async getSystemLogs(limit?: number, offset?: number) {
    return this.invoke<ApiResponse>('get_system_logs', { limit, offset });
  }

  async getTradeHistory(limit?: number, offset?: number) {
    return this.invoke<ApiResponse>('get_trade_history', { limit, offset });
  }

  async getAnalyticsPerformanceMetrics(timeframe?: string) {
    return this.invoke<ApiResponse>('get_analytics_performance_metrics', { timeframe });
  }

  async getAnalyticsStrategyPerformance(timeframe?: string) {
    return this.invoke<ApiResponse>('get_analytics_strategy_performance', { timeframe });
  }

  async getInstrumentPerformance(timeframe?: string) {
    return this.invoke<ApiResponse>('get_instrument_performance', { timeframe });
  }

  // WebSocket methods
  async getWebSocketStatus() {
    return this.invoke<{
      status: string;
      last_connected?: string;
      error?: string;
      subscriptions?: string[];
    }>('get_websocket_status');
  }

  async connectWebSocket() {
    return this.invoke<boolean>('connect_websocket');
  }

  async disconnectWebSocket() {
    return this.invoke<boolean>('disconnect_websocket');
  }

  async reconnectWebSocket() {
    return this.invoke<boolean>('reconnect_websocket');
  }

  async subscribeToInstruments(tokens: number[]) {
    return this.invoke<boolean>('subscribe_to_instruments', tokens);
  }

  async unsubscribeFromInstruments(tokens: number[]) {
    return this.invoke<boolean>('unsubscribe_from_instruments', tokens);
  }

  // API credentials methods
  async storeApiCredentials(userId: string, credentials: {
    api_key: string;
    api_secret: string;
    access_token?: string;
    access_token_expiry?: string;
  }) {
    return this.invoke<boolean>('store_api_credentials', { userId, credentials });
  }

  async getApiCredentials(userId: string) {
    return this.invoke<{
      api_key: string;
      api_secret: string;
      access_token?: string;
      access_token_expiry?: string;
    }>('get_api_credentials', { userId });
  }

  // Profile methods
  async getProfile() {
    return this.invoke<any>('get_profile');
  }

  async getUserInfo(userId: string) {
    return this.invoke<{
      id: string;
      username: string;
      created_at: string;
      last_login?: string;
    }>('get_user_info', { userId });
  }
}

// Create singleton instance
export const apiClient = new ApiClient();