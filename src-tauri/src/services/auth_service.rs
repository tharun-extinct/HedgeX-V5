use crate::error::{HedgeXError, Result, ResultExt};
use crate::services::enhanced_database_service::EnhancedDatabaseService;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::sync::Arc;
use tracing::{debug, error, info, span, Level, Instrument};
use uuid::Uuid;

/// Authentication service for user management and session handling
pub struct AuthService {
    db_service: Arc<EnhancedDatabaseService>,
}

/// User registration request
#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
}

/// Login request
#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

/// API credentials request
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiCredentialsRequest {
    pub api_key: String,
    pub api_secret: String,
}

/// Session token response
#[derive(Debug, Serialize, Deserialize)]
pub struct SessionToken {
    pub token: String,
    pub user_id: String,
    pub expires_at: DateTime<Utc>,
}

/// User information
#[derive(Debug, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub username: String,
    pub created_at: DateTime<Utc>,
    pub last_login: Option<DateTime<Utc>>,
}

/// API credentials
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiCredentials {
    pub api_key: String,
    pub api_secret: String,
}

impl AuthService {
    /// Create a new authentication service
    pub fn new(db_service: Arc<EnhancedDatabaseService>) -> Self {
        Self { db_service }
    }

    /// Register a new user
    pub async fn register(&self, request: RegisterRequest) -> Result<UserInfo> {
        let span = span!(Level::INFO, "register_user", username = %request.username);
        
        async move {
            info!("Registering new user: {}", request.username);
            
            // Validate username and password
            self.validate_credentials(&request.username, &request.password)?;
            
            // Check if username already exists
            let pool = self.db_service.get_database().get_pool();
            let existing_user = sqlx::query(
                "SELECT id FROM users WHERE username = ?"
            )
            .bind(&request.username)
            .fetch_optional(pool)
            .await?;
            
            if existing_user.is_some() {
                return Err(HedgeXError::AuthenticationError("Username already exists".to_string()));
            }
            
            // Hash password
            let password_hash = self.db_service.hash_password(&request.password)?;
            
            // Generate user ID
            let user_id = Uuid::new_v4().to_string();
            let now = Utc::now();
            
            // Insert user into database
            sqlx::query(
                "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)"
            )
            .bind(&user_id)
            .bind(&request.username)
            .bind(&password_hash)
            .bind(&now)
            .execute(pool)
            .await?;
            
            info!("User registered successfully: {}", request.username);
            
            Ok(UserInfo {
                id: user_id,
                username: request.username,
                created_at: now,
                last_login: None,
            })
        }
        .instrument(span)
        .await
    }

    /// Login user
    pub async fn login(&self, request: LoginRequest) -> Result<SessionToken> {
        let span = span!(Level::INFO, "login_user", username = %request.username);
        
        async move {
            info!("Login attempt for user: {}", request.username);
            
            // Get user from database
            let pool = self.db_service.get_database().get_pool();
            let user = sqlx::query_as::<_, (String, String)>(
                "SELECT id, password_hash FROM users WHERE username = ?"
            )
            .bind(&request.username)
            .fetch_optional(pool)
            .await?;
            
            let user = match user {
                Some(user) => user,
                None => {
                    error!("Login failed: User not found: {}", request.username);
                    return Err(HedgeXError::AuthenticationError("Invalid username or password".to_string()));
                }
            };
            
            // Verify password
            let is_valid = self.db_service.verify_password(&request.password, &user.1)?;
            
            if !is_valid {
                error!("Login failed: Invalid password for user: {}", request.username);
                return Err(HedgeXError::AuthenticationError("Invalid username or password".to_string()));
            }
            
            // Generate session token
            let token = self.db_service.generate_token()?;
            let expires_at = Utc::now() + Duration::hours(24);
            
            // Store session token
            sqlx::query(
                "INSERT INTO session_tokens (token, user_id, expires_at) VALUES (?, ?, ?)"
            )
            .bind(&token)
            .bind(&user.0)
            .bind(&expires_at)
            .execute(pool)
            .await?;
            
            // Update last login time
            sqlx::query(
                "UPDATE users SET last_login = ? WHERE id = ?"
            )
            .bind(&Utc::now())
            .bind(&user.0)
            .execute(pool)
            .await?;
            
            info!("Login successful for user: {}", request.username);
            
            Ok(SessionToken {
                token,
                user_id: user.id,
                expires_at,
            })
        }
        .instrument(span)
        .await
    }

    /// Validate session token
    pub async fn validate_session(&self, token: &str) -> Result<String> {
        let span = span!(Level::DEBUG, "validate_session", token = %token);
        
        async move {
            debug!("Validating session token");
            
            // Get session from database
            let pool = self.db_service.get_database().get_pool();
            let session = sqlx::query_as::<_, (String, chrono::DateTime<chrono::Utc>, bool)>(
                "SELECT user_id, expires_at, is_active FROM session_tokens WHERE token = ?"
            )
            .bind(token)
            .fetch_optional(pool)
            .await?;
            
            let session = match session {
                Some(session) => session,
                None => {
                    debug!("Session validation failed: Token not found");
                    return Err(HedgeXError::SessionError);
                }
            };
            
            // Check if session is active
            if !session.2 {
                debug!("Session validation failed: Token is inactive");
                return Err(HedgeXError::SessionError);
            }
            
            // Check if session is expired
            if session.1 < Utc::now() {
                debug!("Session validation failed: Token expired");
                return Err(HedgeXError::SessionError);
            }
            
            // Update last used time
            sqlx::query(
                "UPDATE session_tokens SET last_used = ? WHERE token = ?"
            )
            .bind(&Utc::now())
            .bind(token)
            .execute(pool)
            .await?;
            
            debug!("Session validation successful");
            
            Ok(session.0)
        }
        .instrument(span)
        .await
    }

    /// Logout user
    pub async fn logout(&self, token: &str) -> Result<()> {
        let span = span!(Level::INFO, "logout_user", token = %token);
        
        async move {
            info!("Logging out user");
            
            // Invalidate session token
            let pool = self.db_service.get_database().get_pool();
            let result = sqlx::query(
                "UPDATE session_tokens SET is_active = false WHERE token = ?"
            )
            .bind(token)
            .execute(pool)
            .await?;
            
            if result.rows_affected() == 0 {
                debug!("Logout: Token not found");
                return Err(HedgeXError::SessionError);
            }
            
            info!("Logout successful");
            
            Ok(())
        }
        .instrument(span)
        .await
    }

    /// Store API credentials
    pub async fn store_api_credentials(&self, user_id: &str, credentials: crate::models::auth::ApiCredentials) -> Result<()> {
        let span = span!(Level::INFO, "store_api_credentials", user_id = %user_id);
        
        async move {
            info!("Storing API credentials for user: {}", user_id);
            
            // Encrypt API credentials
            let (encrypted_key, encrypted_secret) = self.db_service
                .encrypt_api_credentials(&credentials.api_key, &credentials.api_secret)
                .await?;
            
            // Store in database
            let pool = self.db_service.get_database().get_pool();
            
            // Check if user exists
            let user = sqlx::query("SELECT id FROM users WHERE id = ?")
                .bind(user_id)
                .fetch_optional(pool)
                .await?;
                
            if user.is_none() {
                return Err(HedgeXError::NotFoundError("User not found".to_string()));
            }
            
            // Insert or update API credentials
            sqlx::query(
                r#"
                INSERT INTO api_credentials (user_id, api_key, api_secret, access_token, access_token_expiry)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    api_key = excluded.api_key,
                    api_secret = excluded.api_secret,
                    access_token = excluded.access_token,
                    access_token_expiry = excluded.access_token_expiry
                "#
            )
            .bind(user_id)
            .bind(&encrypted_key)
            .bind(&encrypted_secret)
            .bind(&credentials.access_token)
            .bind(&credentials.access_token_expiry)
            .execute(pool)
            .await?;
            
            info!("API credentials stored successfully for user: {}", user_id);
            
            Ok(())
        }
        .instrument(span)
        .await
    }

    /// Get API credentials
    pub async fn get_api_credentials(&self, user_id: &str) -> Result<crate::models::auth::ApiCredentials> {
        let span = span!(Level::INFO, "get_api_credentials", user_id = %user_id);
        
        async move {
            info!("Retrieving API credentials for user: {}", user_id);
            
            // Get encrypted credentials from database
            let pool = self.db_service.get_database().get_pool();
            let credentials = sqlx::query_as::<_, (String, String, Option<String>, Option<chrono::DateTime<chrono::Utc>>)>(
                "SELECT api_key, api_secret, access_token, access_token_expiry FROM api_credentials WHERE user_id = ?"
            )
            .bind(user_id)
            .fetch_optional(pool)
            .await?;
            
            let credentials = match credentials {
                Some(creds) => creds,
                None => {
                    return Err(HedgeXError::NotFoundError("API credentials not found".to_string()));
                }
            };
            
            // Decrypt credentials
            let (api_key, api_secret) = self.db_service
                .decrypt_api_credentials(&credentials.0, &credentials.1)
                .await?;
            
            info!("API credentials retrieved successfully for user: {}", user_id);
            
            Ok(crate::models::auth::ApiCredentials {
                user_id: user_id.to_string(),
                api_key,
                api_secret,
                access_token: credentials.2,
                access_token_expiry: credentials.3,
            })
        }
        .instrument(span)
        .await
    }

    /// Update API credentials
    pub async fn update_api_credentials(&self, user_id: &str, credentials: crate::models::auth::ApiCredentials) -> Result<()> {
        let span = span!(Level::INFO, "update_api_credentials", user_id = %user_id);
        
        async move {
            info!("Updating API credentials for user: {}", user_id);
            
            // Encrypt API credentials
            let (encrypted_key, encrypted_secret) = self.db_service
                .encrypt_api_credentials(&credentials.api_key, &credentials.api_secret)
                .await?;
            
            // Update in database
            let pool = self.db_service.get_database().get_pool();
            
            // Check if user exists
            let user = sqlx::query("SELECT id FROM users WHERE id = ?")
                .bind(user_id)
                .fetch_optional(pool)
                .await?;
                
            if user.is_none() {
                return Err(HedgeXError::NotFoundError("User not found".to_string()));
            }
            
            // Update API credentials
            sqlx::query(
                r#"
                UPDATE api_credentials 
                SET api_key = ?, api_secret = ?, access_token = ?, access_token_expiry = ?
                WHERE user_id = ?
                "#
            )
            .bind(&encrypted_key)
            .bind(&encrypted_secret)
            .bind(&credentials.access_token)
            .bind(&credentials.access_token_expiry)
            .bind(user_id)
            .execute(pool)
            .await?;
            
            info!("API credentials updated successfully for user: {}", user_id);
            
            Ok(())
        }
        .instrument(span)
        .await
    }

    /// Get user information
    pub async fn get_user_info(&self, user_id: &str) -> Result<UserInfo> {
        let span = span!(Level::INFO, "get_user_info", user_id = %user_id);
        
        async move {
            info!("Retrieving user information for user: {}", user_id);
            
            // Get user from database
            let pool = self.db_service.get_database().get_pool();
            let user = sqlx::query_as::<_, (String, String, chrono::DateTime<chrono::Utc>, Option<chrono::DateTime<chrono::Utc>>)>(
                "SELECT id, username, created_at, last_login FROM users WHERE id = ?"
            )
            .bind(user_id)
            .fetch_optional(pool)
            .await?;
            
            let user = match user {
                Some(user) => user,
                None => {
                    return Err(HedgeXError::NotFoundError("User not found".to_string()));
                }
            };
            
            info!("User information retrieved successfully for user: {}", user_id);
            
            Ok(UserInfo {
                id: user.0,
                username: user.1,
                created_at: user.2,
                last_login: user.3,
            })
        }
        .instrument(span)
        .await
    }

    /// Validate username and password
    fn validate_credentials(&self, username: &str, password: &str) -> Result<()> {
        // Username validation
        if username.len() < 3 || username.len() > 50 {
            return Err(HedgeXError::ValidationError(
                "Username must be between 3 and 50 characters".to_string()
            ));
        }
        
        if !username.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.') {
            return Err(HedgeXError::ValidationError(
                "Username can only contain alphanumeric characters, underscores, hyphens, and dots".to_string()
            ));
        }
        
        // Password validation
        if password.len() < 8 {
            return Err(HedgeXError::ValidationError(
                "Password must be at least 8 characters".to_string()
            ));
        }
        
        if !password.chars().any(|c| c.is_uppercase()) {
            return Err(HedgeXError::ValidationError(
                "Password must contain at least one uppercase letter".to_string()
            ));
        }
        
        if !password.chars().any(|c| c.is_lowercase()) {
            return Err(HedgeXError::ValidationError(
                "Password must contain at least one lowercase letter".to_string()
            ));
        }
        
        if !password.chars().any(|c| c.is_numeric()) {
            return Err(HedgeXError::ValidationError(
                "Password must contain at least one number".to_string()
            ));
        }
        
        Ok(())
    }

    /// Clean up expired sessions
    pub async fn cleanup_expired_sessions(&self) -> Result<u64> {
        let span = span!(Level::INFO, "cleanup_expired_sessions");
        
        async move {
            info!("Cleaning up expired sessions");
            
            let pool = self.db_service.get_database().get_pool();
            let result = sqlx::query(
                "DELETE FROM session_tokens WHERE expires_at < ?"
            )
            .bind(&Utc::now())
            .execute(pool)
            .await?;
            
            let count = result.rows_affected();
            info!("Cleaned up {} expired sessions", count);
            
            Ok(count)
        }
        .instrument(span)
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use tempfile::tempdir;
    
    async fn setup_test_db() -> Arc<EnhancedDatabaseService> {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path();
        
        let db_service = EnhancedDatabaseService::new(db_path, "test_password")
            .await
            .unwrap();
        
        // Run migrations
        db_service.run_migrations().await.unwrap();
        
        Arc::new(db_service)
    }
    
    #[tokio::test]
    async fn test_register_user() {
        let db_service = setup_test_db().await;
        let auth_service = AuthService::new(db_service);
        
        let request = RegisterRequest {
            username: "testuser".to_string(),
            password: "TestPassword123".to_string(),
        };
        
        let result = auth_service.register(request).await;
        assert!(result.is_ok());
        
        let user_info = result.unwrap();
        assert_eq!(user_info.username, "testuser");
    }
    
    #[tokio::test]
    async fn test_login_user() {
        let db_service = setup_test_db().await;
        let auth_service = AuthService::new(db_service);
        
        // Register user first
        let register_request = RegisterRequest {
            username: "testuser".to_string(),
            password: "TestPassword123".to_string(),
        };
        
        let register_result = auth_service.register(register_request).await;
        assert!(register_result.is_ok());
        
        // Now try to login
        let login_request = LoginRequest {
            username: "testuser".to_string(),
            password: "TestPassword123".to_string(),
        };
        
        let login_result = auth_service.login(login_request).await;
        assert!(login_result.is_ok());
        
        let session = login_result.unwrap();
        assert!(!session.token.is_empty());
    }
    
    #[tokio::test]
    async fn test_validate_session() {
        let db_service = setup_test_db().await;
        let auth_service = AuthService::new(db_service);
        
        // Register and login user
        let register_request = RegisterRequest {
            username: "testuser".to_string(),
            password: "TestPassword123".to_string(),
        };
        
        let user = auth_service.register(register_request).await.unwrap();
        
        let login_request = LoginRequest {
            username: "testuser".to_string(),
            password: "TestPassword123".to_string(),
        };
        
        let session = auth_service.login(login_request).await.unwrap();
        
        // Validate session
        let validation_result = auth_service.validate_session(&session.token).await;
        assert!(validation_result.is_ok());
        
        let user_id = validation_result.unwrap();
        assert_eq!(user_id, user.id);
    }
    
    #[tokio::test]
    async fn test_logout() {
        let db_service = setup_test_db().await;
        let auth_service = AuthService::new(db_service);
        
        // Register and login user
        let register_request = RegisterRequest {
            username: "testuser".to_string(),
            password: "TestPassword123".to_string(),
        };
        
        auth_service.register(register_request).await.unwrap();
        
        let login_request = LoginRequest {
            username: "testuser".to_string(),
            password: "TestPassword123".to_string(),
        };
        
        let session = auth_service.login(login_request).await.unwrap();
        
        // Logout
        let logout_result = auth_service.logout(&session.token).await;
        assert!(logout_result.is_ok());
        
        // Try to validate session after logout
        let validation_result = auth_service.validate_session(&session.token).await;
        assert!(validation_result.is_err());
    }
    
    #[tokio::test]
    async fn test_store_and_get_api_credentials() {
        let db_service = setup_test_db().await;
        let auth_service = AuthService::new(db_service);
        
        // Register user
        let register_request = RegisterRequest {
            username: "testuser".to_string(),
            password: "TestPassword123".to_string(),
        };
        
        let user = auth_service.register(register_request).await.unwrap();
        
        // Store API credentials
        let api_request = ApiCredentialsRequest {
            api_key: "test_api_key".to_string(),
            api_secret: "test_api_secret".to_string(),
        };
        
        let store_result = auth_service.store_api_credentials(&user.id, api_request).await;
        assert!(store_result.is_ok());
        
        // Get API credentials
        let get_result = auth_service.get_api_credentials(&user.id).await;
        assert!(get_result.is_ok());
        
        let credentials = get_result.unwrap();
        assert_eq!(credentials.api_key, "test_api_key");
        assert_eq!(credentials.api_secret, "test_api_secret");
    }
    
    #[tokio::test]
    async fn test_invalid_login() {
        let db_service = setup_test_db().await;
        let auth_service = AuthService::new(db_service);
        
        // Register user
        let register_request = RegisterRequest {
            username: "testuser".to_string(),
            password: "TestPassword123".to_string(),
        };
        
        auth_service.register(register_request).await.unwrap();
        
        // Try to login with wrong password
        let login_request = LoginRequest {
            username: "testuser".to_string(),
            password: "WrongPassword123".to_string(),
        };
        
        let login_result = auth_service.login(login_request).await;
        assert!(login_result.is_err());
    }
    
    #[tokio::test]
    async fn test_cleanup_expired_sessions() {
        let db_service = setup_test_db().await;
        let auth_service = AuthService::new(db_service);
        
        // Register and login user
        let register_request = RegisterRequest {
            username: "testuser".to_string(),
            password: "TestPassword123".to_string(),
        };
        
        auth_service.register(register_request).await.unwrap();
        
        let login_request = LoginRequest {
            username: "testuser".to_string(),
            password: "TestPassword123".to_string(),
        };
        
        auth_service.login(login_request).await.unwrap();
        
        // Manually insert an expired session
        let pool = auth_service.db_service.get_database().get_pool();
        let expired_time = Utc::now() - Duration::hours(25);
        
        sqlx::query!(
            "INSERT INTO session_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
            "expired_token",
            "test_user_id",
            expired_time
        )
        .execute(pool)
        .await
        .unwrap();
        
        // Clean up expired sessions
        let cleanup_result = auth_service.cleanup_expired_sessions().await;
        assert!(cleanup_result.is_ok());
        
        let count = cleanup_result.unwrap();
        assert_eq!(count, 1);
    }
}