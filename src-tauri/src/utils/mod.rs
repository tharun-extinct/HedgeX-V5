pub mod crypto;
pub mod logger;

// Re-export utilities for easier access
pub use crypto::{CryptoService, Encryption, hash_password, verify_password};
pub use logger::Logger;
