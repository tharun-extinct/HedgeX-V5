use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// User model representing a registered user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
}

/// API credentials for Zerodha Kite API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiCredentials {
    pub user_id: String,
    pub api_key: String,
    pub api_secret: String,
    pub access_token: Option<String>,
    pub access_token_expiry: Option<DateTime<Utc>>,
}

/// Session token for authenticated users
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionToken {
    pub token: String,
    pub user_id: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub last_used: DateTime<Utc>,
    pub is_active: bool,
}

impl SessionToken {
    /// Create a new session token with specified expiry hours
    pub fn new(user_id: &str, token: &str, expiry_hours: i64) -> Self {
        let now = Utc::now();
        let expires_at = now + chrono::Duration::hours(expiry_hours);
        
        Self {
            token: token.to_string(),
            user_id: user_id.to_string(),
            expires_at,
            created_at: now,
            last_used: now,
            is_active: true,
        }
    }
    
    /// Check if the token is expired
    pub fn is_expired(&self) -> bool {
        Utc::now() > self.expires_at
    }
    
    /// Update the last used timestamp
    pub fn update_last_used(&mut self) {
        self.last_used = Utc::now();
    }
}

/// Login request payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

/// Registration request payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
    pub confirm_password: String,
}

/// API credentials request payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiCredentialsRequest {
    pub api_key: String,
    pub api_secret: String,
}

/// Authentication response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub user_id: String,
    pub username: String,
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

/// User profile response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub user_id: String,
    pub username: String,
    pub created_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
    pub has_api_credentials: bool,
}

/// Password change request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasswordChangeRequest {
    pub current_password: String,
    pub new_password: String,
    pub confirm_password: String,
}