# Technology Stack & Build System

## Architecture
- **Frontend**: React 18 with TypeScript
- **Backend**: Rust with Tauri framework
- **Database**: SQLite with sqlx for migrations
- **Desktop Framework**: Tauri 2.x for cross-platform desktop application

## Frontend Stack
- **React**: 18.3.1 with TypeScript
- **Routing**: React Router DOM 7.6.3
- **State Management**: Zustand 5.0.6 for global state
- **UI Framework**: Tailwind CSS 3.3.3 with custom design system
- **Component Library**: Radix UI primitives + Shadcn UI components
- **Icons**: Lucide React + Radix UI icons
- **Charts**: Recharts 3.0.2 for trading analytics
- **Build Tool**: Vite 6.0.3

## Backend Stack
- **Runtime**: Tokio async runtime
- **Web Framework**: Axum 0.7 for HTTP/WebSocket handling
- **Database**: SQLite with sqlx 0.7 for type-safe queries
- **HTTP Client**: Reqwest 0.11 with rustls-tls for Zerodha API
- **Cryptography**: ring 0.17 + argon2 0.5 for secure credential storage
- **Serialization**: serde + serde_json for data handling
- **Logging**: tracing + tracing-subscriber for structured logging
- **Error Handling**: thiserror + anyhow for error management

## Development Commands

### Frontend Development
```bash
npm run dev          # Start Vite dev server on port 1420
npm run build        # Build frontend for production
npm run preview      # Preview production build
```

### Tauri Development
```bash
npm run tauri dev    # Start full Tauri development (frontend + backend)
npm run tauri build  # Build production desktop application
```

### Alternative Development (Windows)
```bash
start-dev.bat        # Windows batch script with port checking
start-dev.ps1        # PowerShell script with advanced error handling
```

### Backend Only (Rust)
```bash
cd src-tauri
cargo run            # Run backend only
cargo check          # Check Rust code without building
cargo clean          # Clean build artifacts
```

## Build Configuration
- **Vite Config**: Fixed port 1420, HMR on 1421, ignores src-tauri directory
- **Tauri Config**: Window size 1280x720, minimum 800x600, centered
- **TypeScript**: Strict mode enabled, ES2020 target
- **Tailwind**: Custom design system with HSL color variables

## Development Ports
- **Frontend**: 1420 (Vite dev server)
- **HMR**: 1421 (Hot module replacement)
- **Backend**: Embedded in Tauri process

## Database
- **Migrations**: Located in `migrations/` and `src-tauri/migrations/`
- **Schema**: Users, API credentials, trading strategies, stock selection, trades, system logs
- **Indexes**: Optimized for user queries, trade history, and logging