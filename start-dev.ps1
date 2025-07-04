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
    npm run tauri dev
} catch {
    Write-Host "Error starting the application: $_" -ForegroundColor Red
    
    Write-Host "Attempting to start frontend and backend separately..." -ForegroundColor Yellow
    
    # Start Vite development server in a new window
    Start-Process powershell -ArgumentList "-Command npm run dev"
    
    # Give Vite time to start
    Write-Host "Waiting for Vite to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Start Tauri backend
    Write-Host "Starting Tauri backend..." -ForegroundColor Yellow
    cd src-tauri
    cargo run
}
