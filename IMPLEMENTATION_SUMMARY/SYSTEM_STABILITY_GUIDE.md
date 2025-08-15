# HedgeX System Stability Guide

## Overview
This guide addresses the blue screen error "bootable device not found, install OS" that can occur when running HedgeX. This is typically caused by system resource exhaustion, not the application itself.

## Root Causes Identified

### 1. **Resource Exhaustion**
- Memory leaks from Arc<Mutex<>> patterns
- Unclosed database connections
- WebSocket connection accumulation
- Heavy async operations without proper limits

### 2. **Unsafe System Calls**
- `std::process::exit(1)` calls during initialization
- Missing error boundaries
- Aggressive error handling

### 3. **Missing Resource Management**
- No graceful shutdown procedures
- Inadequate cleanup on crashes
- Resource monitoring disabled

## Solutions Implemented

### 1. **Enhanced Error Handling**
- Replaced `std::process::exit(1)` with proper error returns
- Added panic hooks for graceful error logging
- Implemented circuit breaker patterns

### 2. **Resource Management**
- Added `cleanup_resources()` function
- Implemented graceful shutdown handlers
- Added connection pooling limits

### 3. **System Health Monitoring**
- Memory usage monitoring (every 30 seconds)
- Database connection health checks
- WebSocket connection monitoring
- Automatic resource cleanup

### 4. **Configuration Limits**
- Memory limit: 512 MB
- Database connections: 5 max
- WebSocket connections: 10 max
- Trading strategies: 5 concurrent max

## Usage Instructions

### Option 1: Use Stable Startup Scripts
```bash
# Windows Batch
start-stable.bat

# PowerShell
start-stable.ps1
```

### Option 2: Manual Environment Setup
```bash
# Set these environment variables before starting
set RUST_MAX_MEMORY_MB=512
set RUST_LOG=info
set ENABLE_GRACEFUL_SHUTDOWN=true
set ENABLE_RESOURCE_MONITORING=true
```

## Troubleshooting Steps

### If Blue Screen Occurs Again:

1. **Check System Resources**
   ```bash
   # Check available memory
   wmic OS get TotalVisibleMemorySize,FreePhysicalMemory
   
   # Check disk space
   wmic logicaldisk get size,freespace,caption
   ```

2. **Verify Application Logs**
   - Check `%APPDATA%/HedgeX/logs/` for error logs
   - Look for memory usage warnings
   - Check for connection errors

3. **System Recovery**
   - Restart computer
   - Check BIOS boot order
   - Run `chkdsk C: /f /r`
   - Run `sfc /scannow`

4. **Application Recovery**
   - Delete application data: `%APPDATA%/HedgeX/`
   - Restart with stable scripts
   - Monitor resource usage

## Prevention Measures

### 1. **Before Starting HedgeX**
- Close unnecessary applications
- Ensure 2+ GB free memory
- Check disk space (10+ GB free)
- Close other trading applications

### 2. **During Operation**
- Monitor memory usage in Task Manager
- Watch for connection errors in logs
- Don't run multiple instances
- Use stable startup scripts

### 3. **Regular Maintenance**
- Restart application daily
- Clear old log files
- Monitor system performance
- Update Windows regularly

## Emergency Procedures

### If System Becomes Unresponsive:
1. **Force Close HedgeX**
   - Ctrl+Alt+Del → Task Manager
   - End "HedgeX" process
   - End "tauri" processes

2. **System Recovery**
   - Safe Mode boot
   - System Restore
   - Check disk health

### If Blue Screen Persists:
1. **Hardware Check**
   - Verify hard drive connections
   - Check RAM modules
   - Update device drivers

2. **Professional Help**
   - Contact IT support
   - Hardware diagnostics
   - System reinstallation if necessary

## Configuration Files

### `src-tauri/config.toml`
```toml
[system]
max_memory_mb = 512
enable_graceful_shutdown = true
enable_resource_monitoring = true

[database]
max_connections = 5
timeout_seconds = 30

[websocket]
max_connections = 10
timeout_seconds = 60
```

## Support

If issues persist after implementing these solutions:
1. Check application logs for specific errors
2. Verify system meets minimum requirements
3. Try running in safe mode
4. Contact HedgeX support team

## Minimum System Requirements

- **RAM**: 8 GB (16 GB recommended)
- **Storage**: 20 GB free space
- **OS**: Windows 10/11 (64-bit)
- **CPU**: Intel i5/AMD Ryzen 5 or better
- **Network**: Stable internet connection

## Performance Optimization Tips

1. **Close unnecessary background processes**
2. **Disable unnecessary startup programs**
3. **Use SSD storage if possible**
4. **Keep Windows updated**
5. **Regular system maintenance**
6. **Monitor resource usage regularly**
