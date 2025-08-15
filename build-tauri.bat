@echo off
echo Building HedgeX with memory optimizations...

REM Set environment variables to limit memory usage
set CARGO_BUILD_JOBS=2
set RUSTC_WRAPPER=
set CARGO_TARGET_DIR=target

REM Clean previous build artifacts
echo Cleaning previous build...
cd src-tauri
cargo clean
cd ..

REM Build with limited parallelism
echo Starting Tauri build...
npm run tauri build

echo Build completed!
pause