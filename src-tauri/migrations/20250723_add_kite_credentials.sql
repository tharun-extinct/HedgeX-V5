-- Add Kite API credentials table
CREATE TABLE IF NOT EXISTS kite_credentials (
    user_id TEXT PRIMARY KEY,
    api_key TEXT NOT NULL,
    api_secret TEXT NOT NULL,
    access_token TEXT,
    access_token_expiry TIMESTAMP
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_kite_credentials_user_id ON kite_credentials(user_id);

-- Add table for storing Kite API rate limit tracking
CREATE TABLE IF NOT EXISTS kite_rate_limits (
    endpoint TEXT PRIMARY KEY,
    last_call TIMESTAMP NOT NULL,
    calls_remaining INTEGER NOT NULL DEFAULT 100,
    reset_time TIMESTAMP NOT NULL
);

-- Add table for caching market data
CREATE TABLE IF NOT EXISTS market_data_cache (
    symbol TEXT PRIMARY KEY,
    exchange TEXT NOT NULL,
    last_price REAL NOT NULL,
    volume INTEGER NOT NULL,
    bid REAL NOT NULL,
    ask REAL NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add index for market data cache
CREATE INDEX IF NOT EXISTS idx_market_data_cache_symbol ON market_data_cache(symbol);
CREATE INDEX IF NOT EXISTS idx_market_data_cache_exchange ON market_data_cache(exchange);

-- Add table for tracking API requests for debugging
CREATE TABLE IF NOT EXISTS kite_api_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    error_message TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add index for API requests
CREATE INDEX IF NOT EXISTS idx_kite_api_requests_endpoint ON kite_api_requests(endpoint);
CREATE INDEX IF NOT EXISTS idx_kite_api_requests_timestamp ON kite_api_requests(timestamp);