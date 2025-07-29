# HedgeX - High-Frequency Trading Platform

HedgeX is a sophisticated desktop trading application designed for high-frequency trading (HFT) of NIFTY 50 stocks using the Zerodha Kite API. Built with modern technologies, it emphasizes local data processing, security, and performance.

## 🚀 Features

- **High-Frequency Trading Engine**: Fast order execution with sub-100ms latency
- **Local Data Processing**: All data processing happens locally for maximum privacy
- **Real-time Market Data**: WebSocket integration for live price feeds
- **Strategy Management**: Configurable trading strategies with risk management
- **Backtesting Engine**: Test strategies against historical data
- **Secure Credential Storage**: Encrypted API key storage with argon2 hashing
- **Cross-platform Desktop App**: Built with Tauri for Windows, macOS, and Linux
- **Modern UI**: React-based interface with Tailwind CSS

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Radix UI** + **Shadcn UI** components
- **Zustand** for state management
- **React Router DOM** for navigation
- **Recharts** for data visualization
- **Vite** for build tooling

### Backend
- **Rust** with Tauri framework
- **Axum** for HTTP server
- **SQLite** with sqlx for database operations
- **Tokio** async runtime
- **WebSocket** for real-time data
- **Ring** + **Argon2** for cryptography

## 📋 Prerequisites

Before installing HedgeX, ensure you have the following installed:

### System Requirements
- **Operating System**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **Memory**: Minimum 4GB RAM (8GB recommended)
- **Storage**: 500MB free space
- **Network**: Stable internet connection for market data

### Development Requirements (if building from source)
- **Node.js**: Version 18 or higher
- **Rust**: Latest stable version (1.70+)
- **Git**: For cloning the repository

## 🛠️ Installation

### Option 1: Download Pre-built Binary (Recommended)

1. Go to the [Releases](https://github.com/your-repo/hedgex/releases) page
2. Download the latest version for your operating system:
   - Windows: `HedgeX-Setup.exe`
   - macOS: `HedgeX.dmg`
   - Linux: `HedgeX.AppImage`
3. Run the installer and follow the setup wizard

### Option 2: Build from Source

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-repo/hedgex.git
   cd hedgex
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the application**
   ```bash
   npm run tauri build
   ```

4. **Find the built application**
   - Windows: `src-tauri/target/release/bundle/msi/HedgeX_0.1.0_x64_en-US.msi`
   - macOS: `src-tauri/target/release/bundle/dmg/HedgeX_0.1.0_x64.dmg`
   - Linux: `src-tauri/target/release/bundle/appimage/hedgex_0.1.0_amd64.AppImage`

## ⚙️ Configuration

### First-Time Setup

1. **Launch HedgeX**
2. **Create Account**: Register with your email and create a secure password
3. **API Configuration**: 
   - Obtain API credentials from [Zerodha Kite Connect](https://kite.trade/)
   - Enter your API Key and API Secret in Settings
   - Complete the OAuth flow to get access token

### Zerodha Kite API Setup

1. **Register for Kite Connect**
   - Visit [Kite Connect](https://kite.trade/)
   - Create a developer account
   - Create a new app to get API credentials

2. **API Credentials**
   - **API Key**: Your public API identifier
   - **API Secret**: Your private API secret (keep secure)
   - **Redirect URL**: Set to `http://localhost:3000/callback`

3. **Subscription Requirements**
   - Historical data access requires a paid subscription
   - Real-time data feeds may have additional costs
   - Check Zerodha's pricing for current rates

## 🎯 Usage Guide

### Getting Started

1. **Login**: Use your HedgeX credentials to access the platform
2. **Dashboard**: View your portfolio, positions, and market overview
3. **Strategy Setup**: Configure your trading strategies
4. **Stock Selection**: Choose NIFTY 50 stocks to trade
5. **Start Trading**: Enable strategies and begin automated trading

### Trading Strategies

#### Creating a Strategy
1. Navigate to **Strategies** page
2. Click **"New Strategy"**
3. Configure parameters:
   - **Name**: Descriptive strategy name
   - **Risk Percentage**: Maximum risk per trade (1-5%)
   - **Stop Loss**: Automatic loss limit (1-10%)
   - **Take Profit**: Profit target (1-20%)
   - **Volume Threshold**: Minimum volume for trades
   - **Max Trades/Day**: Daily trade limit

#### Strategy Types
- **Momentum Trading**: Capitalize on price movements
- **Mean Reversion**: Trade on price corrections
- **Volume Breakout**: Trade on volume spikes
- **Custom Logic**: Define your own rules

### Risk Management

#### Built-in Safety Features
- **Position Limits**: Maximum exposure per stock
- **Daily Loss Limits**: Stop trading after losses
- **Emergency Stop**: Immediate halt of all trading
- **Connection Monitoring**: Auto-pause on disconnection

#### Best Practices
- Start with small position sizes
- Test strategies with paper trading first
- Monitor performance regularly
- Keep stop-losses tight
- Diversify across multiple stocks

### Backtesting

1. **Select Strategy**: Choose strategy to test
2. **Historical Data**: 
   - Upload CSV files, or
   - Use Kite Historical API (requires subscription)
3. **Time Period**: Set start and end dates
4. **Run Backtest**: Execute simulation
5. **Analyze Results**: Review performance metrics

#### Key Metrics
- **Total Return**: Overall profit/loss
- **Sharpe Ratio**: Risk-adjusted returns
- **Maximum Drawdown**: Largest loss period
- **Win Rate**: Percentage of profitable trades
- **Profit Factor**: Ratio of profits to losses

## 🔧 Development

### Development Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/your-repo/hedgex.git
   cd hedgex
   npm install
   ```

2. **Start development server**
   ```bash
   npm run tauri dev
   ```

3. **Available scripts**
   ```bash
   npm run dev          # Frontend development server
   npm run build        # Build frontend for production
   npm run tauri dev    # Full Tauri development
   npm run tauri build  # Build production executable
   npm run test         # Run test suite
   npm run test:run     # Run tests once
   ```

### Project Structure

```
hedgex/
├── src/                    # Frontend React application
│   ├── components/         # Reusable React components
│   ├── pages/             # Page components
│   ├── contexts/          # React contexts
│   ├── lib/               # Utility libraries
│   └── test/              # Test files
├── src-tauri/             # Rust backend
│   ├── src/               # Rust source code
│   ├── migrations/        # Database migrations
│   └── Cargo.toml         # Rust dependencies
├── public/                # Static assets
└── migrations/            # SQL migration files
```

### Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

### Code Style
- **Frontend**: ESLint + Prettier configuration
- **Backend**: Rustfmt for code formatting
- **Commits**: Conventional commit messages
- **Testing**: Comprehensive test coverage required

## 🔒 Security

### Data Protection
- **Local Storage**: All data stored locally on your machine
- **Encryption**: API credentials encrypted with Argon2
- **No Cloud**: No data transmitted to external servers (except Zerodha)
- **Session Management**: Secure token-based authentication

### Security Best Practices
- Use strong passwords for your HedgeX account
- Keep API credentials secure and never share them
- Regularly update the application
- Monitor trading activity for unusual patterns
- Use hardware security keys if available

## 📊 Performance

### System Requirements
- **CPU**: Modern multi-core processor recommended
- **RAM**: 8GB for optimal performance
- **Network**: Low-latency internet connection
- **Storage**: SSD recommended for database operations

### Optimization Tips
- Close unnecessary applications while trading
- Use wired internet connection when possible
- Monitor system resources during trading hours
- Keep the application updated for performance improvements

## 🐛 Troubleshooting

### Common Issues

#### Connection Problems
- **Symptom**: Cannot connect to Zerodha API
- **Solution**: 
  - Check internet connection
  - Verify API credentials
  - Ensure Zerodha services are operational
  - Check firewall settings

#### Performance Issues
- **Symptom**: Slow order execution or UI lag
- **Solution**:
  - Close other applications
  - Check system resources
  - Restart the application
  - Update to latest version

#### Database Errors
- **Symptom**: Data not saving or loading
- **Solution**:
  - Check disk space
  - Restart application
  - Check file permissions
  - Contact support if persistent

### Log Files
- **Location**: `%APPDATA%/HedgeX/logs/` (Windows) or `~/.hedgex/logs/` (Linux/macOS)
- **Types**: 
  - `app.log`: General application logs
  - `trading.log`: Trading-specific events
  - `error.log`: Error messages and stack traces

### Getting Help
- **Documentation**: Check this README and inline help
- **Issues**: Report bugs on GitHub Issues
- **Community**: Join our Discord server
- **Support**: Email support@hedgex.com

## 📈 Monitoring & Analytics

### Real-time Monitoring
- **Dashboard**: Live portfolio and P&L updates
- **Position Tracking**: Real-time position monitoring
- **Order Status**: Live order execution tracking
- **Connection Status**: API and WebSocket health

### Performance Analytics
- **Daily Reports**: Automated performance summaries
- **Strategy Analysis**: Individual strategy performance
- **Risk Metrics**: Exposure and risk analysis
- **Historical Charts**: Performance visualization

### Alerts & Notifications
- **Trade Alerts**: Notifications for executed trades
- **Risk Alerts**: Warnings for risk limit breaches
- **System Alerts**: Connection and system status
- **Performance Alerts**: Strategy performance notifications

## 🔄 Updates & Maintenance

### Automatic Updates
- **Update Checking**: Automatic check for new versions
- **Background Downloads**: Updates downloaded in background
- **Safe Installation**: Updates applied during downtime
- **Rollback**: Ability to revert to previous version

### Manual Updates
1. **Check Version**: Help → About to see current version
2. **Download**: Get latest version from releases page
3. **Backup**: Export your data before updating
4. **Install**: Run new installer
5. **Verify**: Confirm all data and settings preserved

### Maintenance Tasks
- **Database Cleanup**: Automatic log rotation and cleanup
- **Performance Optimization**: Regular database optimization
- **Security Updates**: Automatic security patch installation
- **Backup Creation**: Regular automated backups

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

**IMPORTANT**: Trading in financial markets involves substantial risk and may not be suitable for all investors. Past performance is not indicative of future results. HedgeX is a tool to assist in trading decisions, but all trading decisions and their consequences are solely your responsibility.

- **No Financial Advice**: This software does not provide financial advice
- **Risk Warning**: You may lose money using this software
- **Testing Required**: Always test strategies before live trading
- **Regulatory Compliance**: Ensure compliance with local regulations
- **No Guarantees**: No guarantee of profits or performance

## 🤝 Acknowledgments

- **Zerodha**: For providing the Kite Connect API
- **Tauri Team**: For the excellent desktop framework
- **React Team**: For the powerful frontend library
- **Rust Community**: For the robust systems programming language
- **Open Source Contributors**: For the amazing libraries and tools

## 📞 Support

- **Email**: support@hedgex.com
- **GitHub Issues**: [Report bugs and feature requests](https://github.com/your-repo/hedgex/issues)
- **Discord**: [Join our community](https://discord.gg/hedgex)
- **Documentation**: [Full documentation](https://docs.hedgex.com)

---

**Happy Trading! 📈**

*Built with ❤️ by the HedgeX Team*