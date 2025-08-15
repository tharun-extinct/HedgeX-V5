@echo off
echo Starting HedgeX with system stability optimizations...

REM Set memory and resource limits
set RUST_MAX_MEMORY_MB=512
set RUST_LOG=info
set RUST_BACKTRACE=1

REM Set system resource limits
set DATABASE_MAX_CONNECTIONS=5
set WEBSOCKET_MAX_CONNECTIONS=10
set TRADING_MAX_CONCURRENT_STRATEGIES=5

REM Enable graceful shutdown
set ENABLE_GRACEFUL_SHUTDOWN=true
set ENABLE_RESOURCE_MONITORING=true

REM Check system resources before starting
echo Checking system resources...
wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /format:table

REM Start the application with reduced priority to prevent system overload
start /B /LOW npm run tauri dev

echo HedgeX started with stability optimizations.
echo Monitor the application for any issues.
pause
