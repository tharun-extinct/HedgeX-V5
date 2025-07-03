<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# HedgeX Project

This is a high-frequency trading (HFT) application built with Tauri + React for frontend and Rust for backend. The application integrates with Zerodha Kite API for trading NIFTY 50 stocks.

## Technologies
- Frontend: React with Tailwind CSS and Shadcn UI in a Tauri application
- Backend: Rust with Axum and Tokio
- Database: SQLite with sqlx
- API Client: Reqwest for Zerodha Kite API
- Authentication: ring, argon2, base64 for secure local key and session management

## Features
- High-frequency trading engine for NIFTY 50 stocks
- Local data processing and strategy execution
- User authentication with simple session management
- Persistent settings storage in SQLite
- Zerodha Kite API integration with WebSockets and REST API
- Settings interface for API keys, stock selection, and strategy tuning

When providing code suggestions, prioritize:
1. Performance optimization for high-frequency trading
2. Secure handling of API keys and credentials
3. Proper error handling and logging
4. Clean, modular architecture
5. Type safety and data validation
