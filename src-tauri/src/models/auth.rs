use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// User model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
}

impl User {
    /// Create a new user
    pub fn new(username: &str, password_hash: &str) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            username: username.to_string(),
            password_hash: password_hash.to_string(),
            created_at: Utc::now(),
            last_login: None,
        }
    }
}

/// API credentials model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiCredentials {
    pub user_id: String,
    pub api_key: String,
    pub api_secret: String, // Encrypted
    pub access_token: Option<String>,
    pub access_token_expiry: Option<DateTime<Utc>>,
}

impl ApiCredentials {
    /// Create new API credentials
    pub fn new(user_id: &str, api_key: &str, api_secret: &str) -> Self {
        Self {
            user_id: user_id.to_string(),
            api_key: api_key.to_string(),
            api_secret: api_secret.to_string(),
            access_token: None,
            access_token_expiry: None,
        }
    }
    
    /// Update access token
    pub fn with_access_token(mut self, token: &str, expiry: DateTime<Utc>) -> Self {
        self.access_token = Some(token.to_string());
        self.access_token_expiry = Some(expiry);
        self
    }
    
    /// Check if access token is expired
    pub fn is_token_expired(&self) -> bool {
        match self.access_token_expiry {
            Some(expiry) => expiry < Utc::now(),
            None => true,
        }
    }
}

/// Session token model
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
    /// Create a new session token
    pub fn new(user_id: &str, token: &str, expires_in_hours: i64) -> Self {
        let now = Utc::now();
        Self {
            token: token.to_string(),
            user_id: user_id.to_string(),
            expires_at: now + chrono::Duration::hours(expires_in_hours),
            created_at: now,
            last_used: now,
            is_active: true,
        }
    }
    
    /// Check if token is expired
    pub fn is_expired(&self) -> bool {
        self.expires_at < Utc::now()
    }
    
    /// Update last used timestamp
    pub fn update_last_used(&mut self) {
        self.last_used = Utc::now();
    }
}

/// Login request model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

/// Registration request model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrationRequest {
    pub username: String,
    pub password: String,
    pub confirm_password: String,
}

/// API credentials request model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiCredentialsRequest {
    pub api_key: String,
    pub api_secret: String,
}

/// Authentication response model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub user_id: String,
    pub username: String,
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

/// User profile model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: String,
    pub username: String,
    pub created_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
    pub has_api_credentials: bool,
}