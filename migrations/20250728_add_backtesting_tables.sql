-- Add backtesting tables for historical data and results

-- Historical price data storage
CREATE TABLE IF NOT EXISTS historical_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    exchange TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume INTEGER NOT NULL,
    timeframe TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, exchange, timestamp, timeframe)
);

-- Backtest runs
CREATE TABLE IF NOT EXISTS backtest_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    strategy_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    exchange TEXT NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    timeframe TEXT NOT NULL,
    initial_capital REAL NOT NULL,
    data_source TEXT NOT NULL,
    total_trades INTEGER NOT NULL DEFAULT 0,
    winning_trades INTEGER NOT NULL DEFAULT 0,
    losing_trades INTEGER NOT NULL DEFAULT 0,
    final_pnl REAL NOT NULL DEFAULT 0.0,
    max_drawdown REAL NOT NULL DEFAULT 0.0,
    sharpe_ratio REAL NOT NULL DEFAULT 0.0,
    win_rate REAL NOT NULL DEFAULT 0.0,
    profit_factor REAL NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (strategy_id) REFERENCES strategy_params(id) ON DELETE CASCADE
);

-- Backtest trades
CREATE TABLE IF NOT EXISTS backtest_trades (
    id TEXT PRIMARY KEY,
    backtest_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    trade_type TEXT NOT NULL CHECK(trade_type IN ('Buy', 'Sell')),
    entry_time TIMESTAMP NOT NULL,
    entry_price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    exit_time TIMESTAMP,
    exit_price REAL,
    pnl REAL,
    exit_reason TEXT,
    FOREIGN KEY (backtest_id) REFERENCES backtest_runs(id) ON DELETE CASCADE
);

-- Backtest equity curve
CREATE TABLE IF NOT EXISTS backtest_equity_curve (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backtest_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    equity REAL NOT NULL,
    FOREIGN KEY (backtest_id) REFERENCES backtest_runs(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_historical_data_symbol_exchange ON historical_data(symbol, exchange);
CREATE INDEX IF NOT EXISTS idx_historical_data_timestamp ON historical_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_historical_data_timeframe ON historical_data(timeframe);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_user_id ON backtest_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_strategy_id ON backtest_runs(strategy_id);
CREATE INDEX IF NOT EXISTS idx_backtest_runs_created_at ON backtest_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_backtest_trades_backtest_id ON backtest_trades(backtest_id);
CREATE INDEX IF NOT EXISTS idx_backtest_trades_entry_time ON backtest_trades(entry_time);
CREATE INDEX IF NOT EXISTS idx_backtest_equity_curve_backtest_id ON backtest_equity_curve(backtest_id);
CREATE INDEX IF NOT EXISTS idx_backtest_equity_curve_timestamp ON backtest_equity_curve(timestamp);