-- Add strategy performance tracking tables

-- Performance metrics for strategies
CREATE TABLE IF NOT EXISTS strategy_performance (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    strategy_id TEXT NOT NULL,
    date DATE NOT NULL,
    total_trades INTEGER NOT NULL DEFAULT 0,
    profitable_trades INTEGER NOT NULL DEFAULT 0,
    total_pnl REAL NOT NULL DEFAULT 0.0,
    max_drawdown REAL NOT NULL DEFAULT 0.0,
    win_rate REAL NOT NULL DEFAULT 0.0,
    profit_factor REAL NOT NULL DEFAULT 0.0,
    sharpe_ratio REAL NOT NULL DEFAULT 0.0,
    average_trade_duration INTEGER NOT NULL DEFAULT 0, -- in minutes
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (strategy_id) REFERENCES strategy_params(id) ON DELETE CASCADE,
    UNIQUE(user_id, strategy_id, date)
);

-- Add missing columns to strategy_params table
ALTER TABLE strategy_params ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE strategy_params ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_strategy_performance_user_id ON strategy_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_performance_strategy_id ON strategy_performance(strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_performance_date ON strategy_performance(date);
CREATE INDEX IF NOT EXISTS idx_strategy_params_user_id ON strategy_params(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_params_enabled ON strategy_params(enabled);
CREATE INDEX IF NOT EXISTS idx_stock_selection_user_id ON stock_selection(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_selection_is_active ON stock_selection(is_active);