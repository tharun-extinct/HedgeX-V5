use std::fs;
use std::path::Path;

fn main() {
    // Build Tauri
    tauri_build::build();
    
    // Copy migrations to output directory
    let out_dir = std::env::var("OUT_DIR").unwrap();
    let out_migrations_dir = Path::new(&out_dir).join("../../../migrations");
    
    // Create the migrations directory if it doesn't exist
    fs::create_dir_all(&out_migrations_dir).unwrap();
    
    // Copy migrations from src-tauri/migrations to output directory
    let src_migrations_dir = Path::new("migrations");
    if !src_migrations_dir.exists() {
        let src_tauri_migrations = Path::new("src-tauri/migrations");
        
        if src_tauri_migrations.exists() {
            for entry in fs::read_dir(src_tauri_migrations).unwrap() {
                let entry = entry.unwrap();
                let path = entry.path();
                if path.is_file() {
                    let file_name = path.file_name().unwrap();
                    let dest_path = out_migrations_dir.join(file_name);
                    fs::copy(&path, &dest_path).unwrap();
                    println!("cargo:warning=Copied migration: {:?} to {:?}", path, dest_path);
                }
            }
        } else {
            println!("cargo:warning=No migrations found in src-tauri/migrations");
        }
    }
    
    // Tell Cargo to re-run this build script if migrations change
    println!("cargo:rerun-if-changed=migrations");
    println!("cargo:rerun-if-changed=src-tauri/migrations");
}
