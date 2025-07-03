-- Schema for HedgeX database
-- This migration creates all the necessary tables for the application

-- User authentication
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- API credentials (encrypted)
CREATE TABLE IF NOT EXISTS api_credentials (
    user_id TEXT PRIMARY KEY,
    api_key TEXT NOT NULL,
    api_secret TEXT NOT NULL, -- Stored encrypted
    access_token TEXT,
    access_token_expiry TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Trading strategy parameters
CREATE TABLE IF NOT EXISTS strategy_params (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT false,
    max_trades_per_day INTEGER NOT NULL DEFAULT 10,
    risk_percentage REAL NOT NULL DEFAULT 1.0,
    stop_loss_percentage REAL NOT NULL DEFAULT 0.5,
    take_profit_percentage REAL NOT NULL DEFAULT 1.5,
    volume_threshold INTEGER NOT NULL DEFAULT 100000,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Stock selection for trading
CREATE TABLE IF NOT EXISTS stock_selection (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    exchange TEXT NOT NULL DEFAULT 'NSE',
    is_active BOOLEAN NOT NULL DEFAULT true,
    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, symbol)
);

-- Trades executed by the system
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    exchange TEXT NOT NULL,
    order_id TEXT,
    trade_type TEXT NOT NULL CHECK(trade_type IN ('Buy', 'Sell')),
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Pending', 'Executed', 'Cancelled', 'Failed')),
    executed_at TIMESTAMP NOT NULL,
    strategy_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (strategy_id) REFERENCES strategy_params(id) ON DELETE CASCADE
);

-- System logs for auditing and debugging
CREATE TABLE IF NOT EXISTS system_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    log_level INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    context TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
CREATE INDEX IF NOT EXISTS idx_trades_executed_at ON trades(executed_at);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(log_level);
