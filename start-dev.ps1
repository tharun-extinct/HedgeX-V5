Write-Host "Setting up environment for Tauri development..." -ForegroundColor Green
$env:Path += ";$env:USERPROFILE\.cargo\bin"
Write-Host "PATH updated to include Cargo" -ForegroundColor Green
Write-Host "Starting Tauri application..." -ForegroundColor Green
npm run tauri dev
