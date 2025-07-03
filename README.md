# HedgeX

A high-frequency trading (HFT) application for NIFTY 50 stocks using the Zerodha Kite API.

## Overview

HedgeX is a standalone desktop application that enables advanced trading strategies for the Indian stock market, specifically focusing on NIFTY 50 stocks. All data processing and strategy execution happen locally on the user's machine, ensuring data privacy and security.

## Features

- **High-Frequency Trading Engine**: Fast order placement via Zerodha Kite API
- **Local Processing**: All data processing and strategy execution happens locally
- **Full Desktop Application**: Built with Tauri, React, and Rust
- **User Authentication**: Simple session management with secure token storage
- **Persistent Settings**: Securely encrypted storage of API keys and strategy parameters
- **Zerodha Kite API Integration**: WebSocket for live data and REST for order management

## Tech Stack

- **Frontend**: React with TypeScript, Tailwind CSS, and Shadcn UI
- **Backend**: Rust with Axum and Tokio
- **Database**: SQLite with sqlx
- **API Client**: Reqwest for Zerodha Kite API
- **Authentication**: ring, argon2, base64 for secure key management
- **Packaging**: Tauri for cross-platform desktop application

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [Rust](https://www.rust-lang.org/tools/install)
- [Zerodha Kite API credentials](https://kite.trade/)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/hedgex.git
cd hedgex
```

2. Install dependencies
```bash
npm install
```

3. Run the development server
```bash
npm run tauri dev
```

4. Build for production
```bash
npm run tauri build
```

## Project Structure

```
hedgex/
├── src/                     # Frontend React code
│   ├── components/          # React components
│   │   ├── ui/              # UI components (Shadcn UI)
│   │   └── layouts/         # Layout components
│   ├── pages/               # Page components
│   ├── lib/                 # Utilities and helpers
│   └── App.tsx              # Main application component
├── src-tauri/               # Rust backend code
│   ├── src/                 # Rust source files
│   │   ├── api/             # Zerodha Kite API integration
│   │   ├── db/              # SQLite database operations
│   │   ├── models/          # Data models
│   │   ├── trading/         # Trading engine logic
│   │   └── utils/           # Utility functions
│   ├── migrations/          # SQLite migrations
│   └── Cargo.toml           # Rust dependencies
└── README.md                # Project documentation
```

## Configuration

### API Keys

To use HedgeX, you need to configure your Zerodha Kite API credentials in the settings interface. The application securely stores these credentials locally.

### Strategy Configuration

HedgeX allows configuration of various trading parameters:
- Stock selection from NIFTY 50
- Trading thresholds
- Volume limits
- Risk management settings

## Security

- All API credentials are encrypted and stored locally
- No data is sent to external servers
- Local HTTPS server with self-signed certificate for secure communication

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

Trading in financial markets involves risk. HedgeX is a tool for algorithmic trading and does not guarantee profits. Use at your own risk and consult with a financial advisor before making investment decisions.
