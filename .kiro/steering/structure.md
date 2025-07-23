# Project Structure & Organization

## Root Directory Structure
```
hedgex/
├── src/                     # Frontend React application
├── src-tauri/               # Rust backend application
├── migrations/              # Database migrations (SQLite)
├── public/                  # Static assets (icons, images)
├── .kiro/                   # Kiro AI assistant configuration
├── .github/                 # GitHub workflows and templates
├── node_modules/            # Node.js dependencies
└── [config files]          # Build and configuration files
```

## Frontend Structure (`src/`)
```
src/
├── components/              # Reusable React components
│   └── ui/                  # Shadcn UI components (buttons, dialogs, etc.)
├── layouts/                 # Layout components (DashboardLayout)
├── pages/                   # Page components (LoginPage, DashboardPage, etc.)
├── lib/                     # Utilities and helper functions
├── assets/                  # Frontend assets (images, fonts)
├── App.tsx                  # Main application component with routing
├── main.tsx                 # React application entry point
├── App.css                  # Application-specific styles
├── index.css                # Global styles and Tailwind imports
└── vite-env.d.ts           # Vite TypeScript definitions
```

## Backend Structure (`src-tauri/`)
```
src-tauri/
├── src/                     # Rust source code
│   ├── api/                 # Zerodha Kite API integration
│   ├── db/                  # SQLite database operations
│   ├── models/              # Data models and structures
│   ├── trading/             # Trading engine logic
│   ├── utils/               # Utility functions
│   ├── main.rs              # Application entry point
│   └── lib.rs               # Library definitions
├── migrations/              # Database migration files
├── capabilities/            # Tauri security capabilities
├── icons/                   # Application icons
├── target/                  # Rust build artifacts
├── Cargo.toml               # Rust dependencies and metadata
└── tauri.conf.json         # Tauri application configuration
```

## Key Pages & Components

### Authentication Flow
- `LoginPage` - User login interface
- `SignupPage` - User registration interface
- `AuthContext` - Global authentication state management

### Main Application Pages
- `DashboardPage` - Trading overview and real-time data
- `StrategiesPage` - Trading strategy configuration
- `TradesPage` - Trade history and management
- `AnalyticsPage` - Performance analytics and charts
- `SettingsPage` - Application and API configuration
- `ProfilePage` - User profile management

### Layout System
- `DashboardLayout` - Main application layout with navigation
- Protected routes using React Router DOM
- Responsive design with Tailwind CSS

## Configuration Files

### Build & Development
- `package.json` - Node.js dependencies and scripts
- `vite.config.ts` - Vite bundler configuration
- `tsconfig.json` - TypeScript compiler options
- `tailwind.config.js` - Tailwind CSS customization
- `postcss.config.js` - PostCSS configuration

### Development Scripts
- `start-dev.bat` - Windows batch development script
- `start-dev.ps1` - PowerShell development script with error handling

## Database Organization
- `migrations/20250703_initial_schema.sql` - Initial database schema
- Tables: users, api_credentials, strategy_params, stock_selection, trades, system_logs
- Indexes optimized for trading queries and user data

## Naming Conventions
- **React Components**: PascalCase (e.g., `DashboardPage`, `LoginForm`)
- **Files**: PascalCase for components, camelCase for utilities
- **Directories**: lowercase with hyphens or camelCase
- **Database**: snake_case for tables and columns
- **Rust**: snake_case for functions, PascalCase for structs/enums

## Import Organization
- External libraries first
- Internal components and utilities
- Relative imports last
- CSS imports at the end