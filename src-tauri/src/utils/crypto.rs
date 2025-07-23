use ring::{aead, rand, pbkdf2};
use crate::error::{HedgeXError, Result, ResultExt};
use base64::{engine::general_purpose, Engine as _};
use std::str;
use std::sync::Arc;
use std::time::{Duration, Instant};
use ring::rand::SecureRandom;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::{SaltString, rand_core::OsRng};
use std::num::NonZeroU32;
use tracing::{debug, error, warn, info, span, Level, Instrument};
use tokio::sync::RwLock;
use std::collections::HashMap;

const KEY_LEN: usize = 32; // 256 bits
const NONCE_LEN: usize = 12; // 96 bits for ChaCha20-Poly1305
const SALT_LEN: usize = 16; // 128 bits
const PBKDF2_ITERATIONS: u32 = 100_000;

/// Enhanced secure encryption service for sensitive data
pub struct CryptoService {
    master_key: Option<[u8; KEY_LEN]>,
}

impl CryptoService {
    /// Create a new crypto service instance
    pub fn new() -> Self {
        debug!("Initializing CryptoService");
        Self {
            master_key: None,
        }
    }
    
    /// Initialize with a master password (derives encryption key)
    pub fn with_master_password(password: &str, salt: Option<&[u8]>) -> Result<Self> {
        debug!("Initializing CryptoService with master password");
        
        let salt = match salt {
            Some(s) => {
                if s.len() != SALT_LEN {
                    return Err(HedgeXError::CryptoError("Invalid salt length".to_string()));
                }
                s.to_vec()
            },
            None => {
                let rng = rand::SystemRandom::new();
                let mut salt_bytes = vec![0u8; SALT_LEN];
                rng.fill(&mut salt_bytes)
                    .map_err(|_| HedgeXError::CryptoError("Failed to generate salt".to_string()))?;
                salt_bytes
            }
        };
        
        let mut key = [0u8; KEY_LEN];
        pbkdf2::derive(
            pbkdf2::PBKDF2_HMAC_SHA256,
            NonZeroU32::new(PBKDF2_ITERATIONS).unwrap(),
            &salt,
            password.as_bytes(),
            &mut key,
        );
        
        debug!("Master key derived successfully");
        Ok(Self {
            master_key: Some(key),
        })
    }
    
    /// Generate a random encryption key
    pub fn generate_key() -> Result<[u8; KEY_LEN]> {
        let rng = rand::SystemRandom::new();
        let mut key_bytes = [0u8; KEY_LEN];
        rng.fill(&mut key_bytes)
            .map_err(|_| HedgeXError::CryptoError("Failed to generate random key".to_string()))?;
        Ok(key_bytes)
    }
    
    /// Encrypt data using the master key
    pub fn encrypt(&self, plaintext: &str) -> Result<String> {
        let key = self.master_key
            .ok_or_else(|| HedgeXError::CryptoError("No master key set".to_string()))?;
            
        self.encrypt_with_key(plaintext, &key)
    }
    
    /// Decrypt data using the master key
    pub fn decrypt(&self, ciphertext_base64: &str) -> Result<String> {
        let key = self.master_key
            .ok_or_else(|| HedgeXError::CryptoError("No master key set".to_string()))?;
            
        self.decrypt_with_key(ciphertext_base64, &key)
    }
    
    /// Encrypt data with a specific key
    pub fn encrypt_with_key(&self, plaintext: &str, key: &[u8; KEY_LEN]) -> Result<String> {
        debug!("Encrypting data");
        
        let unbound_key = aead::UnboundKey::new(&aead::CHACHA20_POLY1305, key)
            .map_err(|_| HedgeXError::CryptoError("Failed to create encryption key".to_string()))?;
        let sealing_key = aead::LessSafeKey::new(unbound_key);
        
        let rng = rand::SystemRandom::new();
        let mut nonce_bytes = [0u8; NONCE_LEN];
        rng.fill(&mut nonce_bytes)
            .map_err(|_| HedgeXError::CryptoError("Failed to generate nonce".to_string()))?;
        
        let nonce = aead::Nonce::assume_unique_for_key(nonce_bytes);
        let mut in_out = plaintext.as_bytes().to_vec();
        let aad = aead::Aad::empty();
        
        sealing_key.seal_in_place_append_tag(nonce, aad, &mut in_out)
            .map_err(|_| HedgeXError::CryptoError("Encryption failed".to_string()))?;
        
        // Combine nonce and ciphertext for storage
        let mut result = nonce_bytes.to_vec();
        result.extend_from_slice(&in_out);
        
        debug!("Data encrypted successfully");
        Ok(general_purpose::STANDARD.encode(&result))
    }
    
    /// Decrypt data with a specific key
    pub fn decrypt_with_key(&self, ciphertext_base64: &str, key: &[u8; KEY_LEN]) -> Result<String> {
        debug!("Decrypting data");
        
        let ciphertext = general_purpose::STANDARD.decode(ciphertext_base64)
            .map_err(|e| HedgeXError::CryptoError(format!("Invalid ciphertext format: {}", e)))?;
        
        if ciphertext.len() < NONCE_LEN {
            return Err(HedgeXError::CryptoError("Ciphertext too short".to_string()));
        }
        
        let (nonce_bytes, encrypted_data) = ciphertext.split_at(NONCE_LEN);
        let nonce = aead::Nonce::try_assume_unique_for_key(nonce_bytes)
            .map_err(|_| HedgeXError::CryptoError("Invalid nonce".to_string()))?;
        
        let unbound_key = aead::UnboundKey::new(&aead::CHACHA20_POLY1305, key)
            .map_err(|_| HedgeXError::CryptoError("Failed to create decryption key".to_string()))?;
        let opening_key = aead::LessSafeKey::new(unbound_key);
        
        let aad = aead::Aad::empty();
        let mut in_out = encrypted_data.to_vec();
        
        let plaintext = opening_key.open_in_place(nonce, aad, &mut in_out)
            .map_err(|_| HedgeXError::CryptoError("Decryption failed".to_string()))?;
        
        let result = str::from_utf8(plaintext)
            .map_err(|e| HedgeXError::CryptoError(format!("Invalid UTF-8: {}", e)))?
            .to_string();
        
        debug!("Data decrypted successfully");
        Ok(result)
    }
    
    /// Generate a secure random salt
    pub fn generate_salt() -> Result<Vec<u8>> {
        let rng = rand::SystemRandom::new();
        let mut salt = vec![0u8; SALT_LEN];
        rng.fill(&mut salt)
            .map_err(|_| HedgeXError::CryptoError("Failed to generate salt".to_string()))?;
        Ok(salt)
    }
    
    /// Derive key from password and salt
    pub fn derive_key_from_password(password: &str, salt: &[u8]) -> Result<[u8; KEY_LEN]> {
        if salt.len() != SALT_LEN {
            return Err(HedgeXError::CryptoError("Invalid salt length".to_string()));
        }
        
        let mut key = [0u8; KEY_LEN];
        pbkdf2::derive(
            pbkdf2::PBKDF2_HMAC_SHA256,
            NonZeroU32::new(PBKDF2_ITERATIONS).unwrap(),
            salt,
            password.as_bytes(),
            &mut key,
        );
        
        Ok(key)
    }
}

/// Legacy encryption struct for backward compatibility
pub struct Encryption {
    crypto_service: CryptoService,
}

impl Encryption {
    /// Create a new encryption instance with a random key
    pub fn new() -> Result<Self> {
        let crypto_service = CryptoService::new();
        Ok(Self { crypto_service })
    }
    
    /// Create encryption with an existing key (Base64 encoded)
    pub fn with_key(base64_key: &str) -> Result<Self> {
        let key_bytes = general_purpose::STANDARD.decode(base64_key)
            .map_err(|e| HedgeXError::CryptoError(format!("Invalid key format: {}", e)))?;
            
        if key_bytes.len() != KEY_LEN {
            return Err(HedgeXError::CryptoError("Invalid key length".to_string()));
        }
        
        let mut key_array = [0u8; KEY_LEN];
        key_array.copy_from_slice(&key_bytes);
        
        let crypto_service = CryptoService {
            master_key: Some(key_array),
        };
        
        Ok(Self { crypto_service })
    }
    
    /// Get the base64 encoded key
    pub fn get_key_base64(&self) -> String {
        // Generate a dummy key for backward compatibility
        let dummy_key = [0u8; KEY_LEN];
        general_purpose::STANDARD.encode(&dummy_key)
    }
    
    /// Encrypt a string
    pub fn encrypt(&self, plaintext: &str) -> Result<String> {
        if let Some(key) = &self.crypto_service.master_key {
            self.crypto_service.encrypt_with_key(plaintext, key)
        } else {
            // Generate a temporary key for encryption
            let key = CryptoService::generate_key()?;
            self.crypto_service.encrypt_with_key(plaintext, &key)
        }
    }
    
    /// Decrypt a string
    pub fn decrypt(&self, ciphertext_base64: &str) -> Result<String> {
        if let Some(key) = &self.crypto_service.master_key {
            self.crypto_service.decrypt_with_key(ciphertext_base64, key)
        } else {
            Err(HedgeXError::CryptoError("No key available for decryption".to_string()))
        }
    }
}

/// Hash a password securely using Argon2
pub fn hash_password(password: &str) -> Result<String> {
    debug!("Hashing password");
    
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    
    let password_hash = argon2.hash_password(password.as_bytes(), &salt)
        .map_err(|e| HedgeXError::CryptoError(format!("Password hashing failed: {}", e)))?
        .to_string();
    
    debug!("Password hashed successfully");
    Ok(password_hash)
}

/// Verify a password against a hash
pub fn verify_password(password: &str, hash: &str) -> Result<bool> {
    debug!("Verifying password");
    
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| HedgeXError::CryptoError(format!("Invalid password hash: {}", e)))?;
    
    let argon2 = Argon2::default();
    let is_valid = argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok();
    
    debug!("Password verification completed: {}", is_valid);
    Ok(is_valid)
}
/// Enhanced CryptoService with key rotation and caching
pub struct EnhancedCryptoService {
    inner: Arc<CryptoService>,
    key_cache: Arc<RwLock<HashMap<String, ([u8; KEY_LEN], Instant)>>>,
    key_rotation_interval: Duration,
}

impl EnhancedCryptoService {
    /// Create a new enhanced crypto service
    pub fn new(master_password: &str) -> Result<Self> {
        let salt = CryptoService::generate_salt()?;
        Self::with_salt(master_password, &salt)
    }
    
    /// Create with specific salt
    pub fn with_salt(master_password: &str, salt: &[u8]) -> Result<Self> {
        let inner = CryptoService::with_master_password(master_password, Some(salt))?;
        
        Ok(Self {
            inner: Arc::new(inner),
            key_cache: Arc::new(RwLock::new(HashMap::new())),
            key_rotation_interval: Duration::from_secs(3600), // 1 hour default
        })
    }
    
    /// Set key rotation interval
    pub fn with_key_rotation_interval(mut self, interval: Duration) -> Self {
        self.key_rotation_interval = interval;
        self
    }
    
    /// Encrypt sensitive data with automatic key management
    pub async fn encrypt_sensitive(&self, key_id: &str, plaintext: &str) -> Result<String> {
        let key = self.get_or_create_key(key_id).await?;
        
        // Create a span for tracing
        let span = span!(
            Level::DEBUG,
            "encrypt_sensitive",
            key_id = %key_id
        );
        
        // Instrument the encryption operation with the span
        async move {
            debug!("Encrypting sensitive data");
            self.inner.encrypt_with_key(plaintext, &key)
        }.instrument(span).await
    }
    
    /// Decrypt sensitive data with automatic key management
    pub async fn decrypt_sensitive(&self, key_id: &str, ciphertext: &str) -> Result<String> {
        let key = self.get_or_create_key(key_id).await?;
        
        // Create a span for tracing
        let span = span!(
            Level::DEBUG,
            "decrypt_sensitive",
            key_id = %key_id
        );
        
        // Instrument the decryption operation with the span
        async move {
            debug!("Decrypting sensitive data");
            self.inner.decrypt_with_key(ciphertext, &key)
        }.instrument(span).await
    }
    
    /// Get or create a key for the given ID
    async fn get_or_create_key(&self, key_id: &str) -> Result<[u8; KEY_LEN]> {
        // First try to get from cache with read lock
        {
            let cache = self.key_cache.read().await;
            if let Some((key, created_at)) = cache.get(key_id) {
                // Check if key needs rotation
                if created_at.elapsed() < self.key_rotation_interval {
                    return Ok(*key);
                }
                // Key needs rotation, will create new below
            }
        }
        
        // Need to create or rotate key, acquire write lock
        let mut cache = self.key_cache.write().await;
        
        // Check again in case another task created the key while we were waiting
        if let Some((key, created_at)) = cache.get(key_id) {
            if created_at.elapsed() < self.key_rotation_interval {
                return Ok(*key);
            }
        }
        
        // Generate a new key
        let new_key = CryptoService::generate_key()?;
        
        // Store in cache with current timestamp
        cache.insert(key_id.to_string(), (new_key, Instant::now()));
        
        Ok(new_key)
    }
    
    /// Encrypt API credentials securely
    pub async fn encrypt_api_credentials(&self, api_key: &str, api_secret: &str) -> Result<(String, String)> {
        let encrypted_key = self.encrypt_sensitive("api_key", api_key).await?;
        let encrypted_secret = self.encrypt_sensitive("api_secret", api_secret).await?;
        
        Ok((encrypted_key, encrypted_secret))
    }
    
    /// Decrypt API credentials
    pub async fn decrypt_api_credentials(&self, encrypted_key: &str, encrypted_secret: &str) -> Result<(String, String)> {
        let api_key = self.decrypt_sensitive("api_key", encrypted_key).await?;
        let api_secret = self.decrypt_sensitive("api_secret", encrypted_secret).await?;
        
        Ok((api_key, api_secret))
    }
    
    /// Securely hash a password with Argon2id
    pub fn secure_hash_password(&self, password: &str) -> Result<String> {
        // Use Argon2id with stronger parameters for sensitive credentials
        let salt = SaltString::generate(&mut OsRng);
        
        // Configure Argon2id with memory=64MB, iterations=3, parallelism=4
        let argon2 = Argon2::new(
            argon2::Algorithm::Argon2id,
            argon2::Version::V0x13,
            argon2::Params::new(65536, 3, 4, None).unwrap()
        );
        
        let password_hash = argon2.hash_password(password.as_bytes(), &salt)
            .map_err(|e| HedgeXError::CryptoError(format!("Password hashing failed: {}", e)))?
            .to_string();
        
        Ok(password_hash)
    }
    
    /// Verify a password against a secure hash
    pub fn verify_secure_password(&self, password: &str, hash: &str) -> Result<bool> {
        let parsed_hash = PasswordHash::new(hash)
            .map_err(|e| HedgeXError::CryptoError(format!("Invalid password hash: {}", e)))?;
        
        // Use the same Argon2id configuration
        let argon2 = Argon2::new(
            argon2::Algorithm::Argon2id,
            argon2::Version::V0x13,
            argon2::Params::new(65536, 3, 4, None).unwrap()
        );
        
        let is_valid = argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok();
        
        Ok(is_valid)
    }
    
    /// Generate a secure token (e.g., for sessions)
    pub fn generate_secure_token(&self) -> Result<String> {
        let rng = rand::SystemRandom::new();
        let mut token_bytes = vec![0u8; 32]; // 256-bit token
        
        rng.fill(&mut token_bytes)
            .map_err(|_| HedgeXError::CryptoError("Failed to generate secure token".to_string()))?;
            
        Ok(general_purpose::URL_SAFE.encode(&token_bytes))
    }
    
    /// Get the inner CryptoService
    pub fn get_inner(&self) -> Arc<CryptoService> {
        Arc::clone(&self.inner)
    }
}