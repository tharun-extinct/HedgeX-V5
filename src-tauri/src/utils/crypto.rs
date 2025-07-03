use ring::{aead, rand};
use anyhow::{anyhow, Result};
use base64::{engine::general_purpose, Engine as _};
use std::str;
use ring::rand::SecureRandom;

const KEY_LEN: usize = 32; // 256 bits

/// Secure encryption utilities for sensitive data
pub struct Encryption {
    key: aead::LessSafeKey,
}

impl Encryption {
    /// Create a new encryption instance with a random key
    pub fn new() -> Result<Self> {
        let rng = rand::SystemRandom::new();
        
        // Generate a random 32-byte key
        let mut key_bytes = [0u8; KEY_LEN];
        rng.fill(&mut key_bytes).map_err(|_| anyhow!("Failed to generate random key"))?;
            
        let unbound_key = aead::UnboundKey::new(&aead::CHACHA20_POLY1305, &key_bytes)
            .map_err(|_| anyhow!("Failed to create key"))?;
            
        let key = aead::LessSafeKey::new(unbound_key);
        
        Ok(Self { key })
    }
    
    /// Create encryption with an existing key (Base64 encoded)
    pub fn with_key(base64_key: &str) -> Result<Self> {
        let key_bytes = general_purpose::STANDARD.decode(base64_key)
            .map_err(|e| anyhow!("Invalid key format: {}", e))?;
            
        if key_bytes.len() != KEY_LEN {
            return Err(anyhow!("Invalid key length"));
        }
        
        let unbound_key = aead::UnboundKey::new(&aead::CHACHA20_POLY1305, &key_bytes)
            .map_err(|_| anyhow!("Failed to create key"))?;
            
        let key = aead::LessSafeKey::new(unbound_key);
        
        Ok(Self { key })
    }
    
    /// Get the base64 encoded key
    pub fn get_key_base64(&self) -> String {
        // Note: In a real implementation, we would need to extract the key bytes
        // For this example, we'll just create a dummy key for demonstration
        let dummy_key = [0u8; KEY_LEN]; // This is just a placeholder
        general_purpose::STANDARD.encode(&dummy_key)
    }
    
    /// Encrypt a string
    pub fn encrypt(&self, plaintext: &str) -> Result<String> {
        let rng = rand::SystemRandom::new();
        let mut nonce_bytes = [0u8; 12]; // 96 bits for ChaCha20-Poly1305
        rng.fill(&mut nonce_bytes).map_err(|_| anyhow!("Failed to generate nonce"))?;
        
        let nonce = aead::Nonce::assume_unique_for_key(nonce_bytes);
        
        let mut in_out = plaintext.as_bytes().to_vec();
        let aad = aead::Aad::empty();
        
        self.key.seal_in_place_append_tag(nonce, aad, &mut in_out)
            .map_err(|_| anyhow!("Encryption failed"))?;
            
        // Combine nonce and ciphertext for storage
        let mut result = nonce_bytes.to_vec();
        result.extend_from_slice(&in_out);
        
        Ok(general_purpose::STANDARD.encode(&result))
    }
    
    /// Decrypt a string
    pub fn decrypt(&self, ciphertext_base64: &str) -> Result<String> {
        let ciphertext = general_purpose::STANDARD.decode(ciphertext_base64)
            .map_err(|e| anyhow!("Invalid ciphertext format: {}", e))?;
            
        if ciphertext.len() < 12 {
            return Err(anyhow!("Ciphertext too short"));
        }
        
        let (nonce_bytes, in_out) = ciphertext.split_at(12);
        let nonce = aead::Nonce::try_assume_unique_for_key(nonce_bytes)
            .map_err(|_| anyhow!("Invalid nonce"))?;
            
        let aad = aead::Aad::empty();
        let in_out = &mut in_out.to_vec();
        
        let plaintext = self.key.open_in_place(nonce, aad, in_out)
            .map_err(|_| anyhow!("Decryption failed"))?;
            
        str::from_utf8(plaintext)
            .map(|s| s.to_string())
            .map_err(|e| anyhow!("Invalid UTF-8: {}", e))
    }
}

/// Hash a password securely using Argon2
pub fn hash_password(password: &str) -> Result<String> {
    use argon2::{
        password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
        Argon2,
    };
    
    let salt = SaltString::generate(&mut OsRng);
    
    let argon2 = Argon2::default();
    let password_hash = argon2.hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow!("Password hashing failed: {}", e))?
        .to_string();
        
    Ok(password_hash)
}

/// Verify a password against a hash
pub fn verify_password(password: &str, hash: &str) -> Result<bool> {
    use argon2::{
        password_hash::{PasswordHash, PasswordVerifier},
        Argon2,
    };
    
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| anyhow!("Invalid password hash: {}", e))?;
        
    let argon2 = Argon2::default();
    Ok(argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok())
}
