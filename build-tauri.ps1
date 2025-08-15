#!/usr/bin/env pwsh

Write-Host "Building HedgeX with memory optimizations..." -ForegroundColor Green

# Set environment variables to limit memory usage
$env:CARGO_BUILD_JOBS = "2"
$env:RUSTC_WRAPPER = ""
$env:CARGO_TARGET_DIR = "target"

# Clean previous build artifacts
Write-Host "Cleaning previous build..." -ForegroundColor Yellow
Set-Location src-tauri
cargo clean
Set-Location ..

# Build with limited parallelism
Write-Host "Starting Tauri build..." -ForegroundColor Yellow
try {
    npm run tauri build
    Write-Host "Build completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "Build failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")