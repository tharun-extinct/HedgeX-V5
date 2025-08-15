# HedgeX Stable Startup Script
Write-Host "Starting HedgeX with system stability optimizations..." -ForegroundColor Green

# Set memory and resource limits
$env:RUST_MAX_MEMORY_MB = "512"
$env:RUST_LOG = "info"
$env:RUST_BACKTRACE = "1"

# Set system resource limits
$env:DATABASE_MAX_CONNECTIONS = "5"
$env:WEBSOCKET_MAX_CONNECTIONS = "10"
$env:TRADING_MAX_CONCURRENT_STRATEGIES = "5"

# Enable graceful shutdown
$env:ENABLE_GRACEFUL_SHUTDOWN = "true"
$env:ENABLE_RESOURCE_MONITORING = "true"

# Check system resources before starting
Write-Host "Checking system resources..." -ForegroundColor Yellow
try {
    $memory = Get-WmiObject -Class Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory
    $totalGB = [math]::Round($memory.TotalVisibleMemorySize / 1MB, 2)
    $freeGB = [math]::Round($memory.FreePhysicalMemory / 1MB, 2)
    Write-Host "Total Memory: $totalGB GB" -ForegroundColor Cyan
    Write-Host "Free Memory: $freeGB GB" -ForegroundColor Cyan
    
    if ($freeGB -lt 2) {
        Write-Warning "Low memory detected! Consider closing other applications."
    }
} catch {
    Write-Warning "Could not check system memory"
}

# Start the application with reduced priority
Write-Host "Starting HedgeX..." -ForegroundColor Green
Start-Process -FilePath "npm" -ArgumentList "run", "tauri", "dev" -WindowStyle Normal -PriorityClass BelowNormal

Write-Host "HedgeX started with stability optimizations." -ForegroundColor Green
Write-Host "Monitor the application for any issues." -ForegroundColor Yellow
Read-Host "Press Enter to continue"
