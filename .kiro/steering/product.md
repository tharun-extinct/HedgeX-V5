# HedgeX Product Overview

HedgeX is a high-frequency trading (HFT) desktop application for NIFTY 50 stocks using the Zerodha Kite API. The application focuses on local data processing and strategy execution to ensure data privacy and security.

## Core Features

- **High-Frequency Trading Engine**: Fast order placement via Zerodha Kite API
- **Local Processing**: All data processing and strategy execution happens locally on user's machine
- **Desktop Application**: Cross-platform desktop app built with Tauri
- **User Authentication**: Session management with secure token storage
- **Persistent Settings**: Encrypted storage of API keys and strategy parameters
- **Real-time Data**: WebSocket integration for live market data
- **Strategy Management**: Configurable trading strategies with risk management

## Target Users

- Individual traders focusing on NIFTY 50 stocks
- Users requiring local data processing for privacy/security
- Traders using Zerodha Kite API for order execution

## Security & Privacy

- All API credentials are encrypted and stored locally
- No data is sent to external servers except Zerodha API
- Local HTTPS server with self-signed certificate for secure communication
- Session-based authentication with token management

## Trading Focus

- NIFTY 50 stocks exclusively
- High-frequency trading strategies
- Risk management with configurable parameters
- Volume-based trading thresholds
- Stop-loss and take-profit automation