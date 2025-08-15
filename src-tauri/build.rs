use std::fs;
use std::path::Path;

fn main() {
    // Build Tauri with minimal features
    tauri_build::build();
    
    // Only copy migrations if they exist and are needed
    if let Ok(out_dir) = std::env::var("OUT_DIR") {
        let out_migrations_dir = Path::new(&out_dir).join("../../../migrations");
        
        // Create the migrations directory if it doesn't exist
        if let Ok(()) = fs::create_dir_all(&out_migrations_dir) {
            // Copy migrations from src-tauri/migrations to output directory
            let src_migrations_dir = Path::new("migrations");
            if !src_migrations_dir.exists() {
                let src_tauri_migrations = Path::new("src-tauri/migrations");
                
                if src_tauri_migrations.exists() {
                    if let Ok(entries) = fs::read_dir(src_tauri_migrations) {
                        for entry in entries.flatten() {
                            let path = entry.path();
                            if path.is_file() {
                                if let Some(file_name) = path.file_name() {
                                    let dest_path = out_migrations_dir.join(file_name);
                                    let _ = fs::copy(&path, &dest_path);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Tell Cargo to re-run this build script if migrations change
    println!("cargo:rerun-if-changed=migrations");
    println!("cargo:rerun-if-changed=src-tauri/migrations");
}
