Write-Host "Setting up environment for Tauri development..." -ForegroundColor Green
$env:Path += ";$env:USERPROFILE\.cargo\bin"
Write-Host "PATH updated to include Cargo" -ForegroundColor Green

# Function to check if a port is in use
function Test-PortInUse {
    param (
        [int]$Port
    )
    
    $connections = netstat -ano | Select-String -Pattern "LISTENING" | Select-String -Pattern ":$Port\s"
    return ($connections -ne $null)
}

# Check if port 1420 is already in use
if (Test-PortInUse -Port 1420) {
    Write-Host "ERROR: Port 1420 is already in use!" -ForegroundColor Red
    Write-Host "Please stop any other processes using port 1420 and try again." -ForegroundColor Yellow
    
    # Find the process ID using port 1420
    $connections = netstat -ano | Select-String -Pattern "LISTENING" | Select-String -Pattern ":1420\s"
    if ($connections -ne $null) {
        $processId = [regex]::Match($connections, '(\d+)$').Groups[1].Value
        Write-Host "Process using port 1420: PID $processId" -ForegroundColor Yellow
        
        # Get process name
        $processName = (Get-Process -Id $processId).ProcessName
        Write-Host "Process name: $processName" -ForegroundColor Yellow
    }
    
    Write-Host "Would you like to kill the process and continue? (Y/N)" -ForegroundColor Yellow
    $kill = Read-Host
    if ($kill -eq "Y" -or $kill -eq "y") {
        try {
            Stop-Process -Id $processId -Force
            Write-Host "Process killed. Continuing..." -ForegroundColor Green
            Start-Sleep -Seconds 2  # Give it time to release the port
        } catch {
            Write-Host "Failed to kill process. Please close it manually." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Exiting. Please close the process using port 1420 manually and try again." -ForegroundColor Yellow
        exit 1
    }
}

# Ensure project dependencies are installed
Write-Host "Checking npm dependencies..." -ForegroundColor Green
npm install

# Ensure Rust dependencies are up to date
Write-Host "Checking Rust dependencies..." -ForegroundColor Green
cd src-tauri

# Force clean any locks
Write-Host "Cleaning Rust build artifacts and locks..." -ForegroundColor Yellow
if (Test-Path -Path "target/debug/hedgex.exe") {
    try {
        Remove-Item -Path "target/debug/hedgex.exe" -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Host "Warning: Could not remove existing hedgex.exe, it may be in use." -ForegroundColor Yellow
        Write-Host "Trying to force terminate any running instances..." -ForegroundColor Yellow
        Get-Process | Where-Object {$_.Name -like "hedgex*"} | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        
        # Try again
        try {
            Remove-Item -Path "target/debug/hedgex.exe" -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Host "Still cannot remove hedgex.exe. Will continue anyway..." -ForegroundColor Yellow
        }
    }
}
cargo clean
cargo check
cd ..

# Create migrations folder if it doesn't exist
if (-not (Test-Path -Path "migrations")) {
    Write-Host "Creating migrations folder..." -ForegroundColor Green
    New-Item -ItemType Directory -Path "migrations" | Out-Null
}

# Copy migrations from src-tauri/migrations if needed
if (Test-Path -Path "src-tauri/migrations") {
    Write-Host "Copying migrations from src-tauri/migrations to migrations..." -ForegroundColor Green
    Copy-Item -Path "src-tauri/migrations/*" -Destination "migrations/" -Force
}

Write-Host "Starting Tauri application in development mode..." -ForegroundColor Green
Write-Host "Frontend URL will be: http://localhost:1420" -ForegroundColor Cyan
Write-Host "If the application window doesn't open automatically, please open this URL in your browser." -ForegroundColor Cyan

# Start the application
try {
    # Try to kill any existing Tauri or Node processes that might be blocking our ports
    Get-Process | Where-Object {$_.Name -like "hedgex*" -or $_.Name -like "node*" -and $_.Path -like "*HedgeX-V5*"} | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    
    # Launch in separate frontend and backend mode instead of combined mode
    Write-Host "Starting frontend and backend separately (more reliable)..." -ForegroundColor Yellow
    
    # Start Vite development server in a new window
    Start-Process powershell -ArgumentList "-Command cd 'x:\AI_and_Automation\HedgeX-V5' && npm run dev"
    
    # Give Vite time to start
    Write-Host "Waiting for Vite to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Start Tauri backend
    Write-Host "Starting Tauri backend..." -ForegroundColor Yellow
    cd src-tauri
    cargo run
} catch {
    Write-Host "Error starting the application: $_" -ForegroundColor Red
    Write-Host "Please try running 'npm run dev' and 'cargo run' separately." -ForegroundColor Yellow
}
