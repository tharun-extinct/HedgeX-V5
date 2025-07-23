-- Add market data cache table for WebSocket manager
CREATE TABLE IF NOT EXISTS market_data_cache (
    symbol TEXT PRIMARY KEY,
    instrument_token INTEGER NOT NULL,
    ltp REAL NOT NULL,
    volume INTEGER NOT NULL,
    bid REAL NOT NULL,
    ask REAL NOT NULL,
    open_price REAL,
    high_price REAL,
    low_price REAL,
    close_price REAL,
    change_value REAL,
    change_percent REAL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_market_data_cache_instrument_token ON market_data_cache(instrument_token);
CREATE INDEX IF NOT EXISTS idx_market_data_cache_updated_at ON market_data_cache(updated_at);