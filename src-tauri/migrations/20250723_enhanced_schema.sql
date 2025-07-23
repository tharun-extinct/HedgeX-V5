-- Enhanced schema additions for HedgeX iteration
-- This migration adds tables for real-time market data, orders, and performance metrics

-- Real-time market data cache
CREATE TABLE IF NOT EXISTS market_data_cache (
    symbol TEXT PRIMARY KEY,
    ltp REAL NOT NULL,
    volume INTEGER NOT NULL,
    bid REAL NOT NULL,
    ask REAL NOT NULL,
    change_percent REAL DEFAULT 0.0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Order tracking
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kite_order_id TEXT,
    symbol TEXT NOT NULL,
    exchange TEXT NOT NULL DEFAULT 'NSE',
    order_type TEXT NOT NULL CHECK(order_type IN ('MARKET', 'LIMIT', 'SL', 'SL-M')),
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('BUY', 'SELL')),
    quantity INTEGER NOT NULL,
    price REAL,
    trigger_price REAL,
    status TEXT NOT NULL CHECK(status IN ('OPEN', 'COMPLETE', 'CANCELLED', 'REJECTED', 'TRIGGER_PENDING')),
    status_message TEXT,
    filled_quantity INTEGER DEFAULT 0,
    pending_quantity INTEGER DEFAULT 0,
    average_price REAL DEFAULT 0.0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Performance metrics
CREATE TABLE IF NOT EXISTS performance_metrics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    date DATE NOT NULL,
    total_trades INTEGER NOT NULL DEFAULT 0,
    profitable_trades INTEGER NOT NULL DEFAULT 0,
    total_pnl REAL NOT NULL DEFAULT 0.0,
    max_drawdown REAL NOT NULL DEFAULT 0.0,
    win_rate REAL NOT NULL DEFAULT 0.0,
    average_profit REAL NOT NULL DEFAULT 0.0,
    average_loss REAL NOT NULL DEFAULT 0.0,
    largest_win REAL NOT NULL DEFAULT 0.0,
    largest_loss REAL NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, date)
);

-- Session tokens for authentication
CREATE TABLE IF NOT EXISTS session_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT true,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Trading sessions for tracking engine state
CREATE TABLE IF NOT EXISTS trading_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'STOPPED', 'ERROR', 'EMERGENCY_STOP')),
    total_trades INTEGER DEFAULT 0,
    total_pnl REAL DEFAULT 0.0,
    error_message TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- WebSocket connection tracking
CREATE TABLE IF NOT EXISTS websocket_connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    connection_type TEXT NOT NULL CHECK(connection_type IN ('MARKET_DATA', 'ORDER_UPDATES')),
    status TEXT NOT NULL CHECK(status IN ('CONNECTED', 'DISCONNECTED', 'ERROR', 'RECONNECTING')),
    last_ping TIMESTAMP,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Enhanced indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_kite_order_id ON orders(kite_order_id);

CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data_cache(symbol);
CREATE INDEX IF NOT EXISTS idx_market_data_updated_at ON market_data_cache(updated_at);

CREATE INDEX IF NOT EXISTS idx_performance_user_date ON performance_metrics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_performance_date ON performance_metrics(date);

CREATE INDEX IF NOT EXISTS idx_session_tokens_user_id ON session_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_session_tokens_expires_at ON session_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_session_tokens_active ON session_tokens(is_active);

CREATE INDEX IF NOT EXISTS idx_trading_sessions_user_id ON trading_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_sessions_status ON trading_sessions(status);
CREATE INDEX IF NOT EXISTS idx_trading_sessions_started_at ON trading_sessions(started_at);

CREATE INDEX IF NOT EXISTS idx_websocket_user_id ON websocket_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_websocket_status ON websocket_connections(status);
CREATE INDEX IF NOT EXISTS idx_websocket_type ON websocket_connections(connection_type);