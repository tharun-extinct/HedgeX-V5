use crate::services::auth_service::{AuthService, RegisterRequest, LoginRequest, ApiCredentialsRequest};
use crate::services::enhanced_database_service::EnhancedDatabaseService;
use std::sync::Arc;
use tempfile::tempdir;

#[tokio::test]
async fn test_auth_service_integration() {
    // Create a temporary directory for the test database
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path();
    
    // Initialize the enhanced database service
    let db_service = EnhancedDatabaseService::new(db_path, "test_password")
        .await
        .unwrap();
    
    // Run migrations
    db_service.run_migrations().await.unwrap();
    
    // Create the authentication service
    let auth_service = AuthService::new(Arc::new(db_service));
    
    // Test user registration
    let register_request = RegisterRequest {
        username: "testuser".to_string(),
        password: "TestPassword123".to_string(),
    };
    
    let user = auth_service.register(register_request).await.unwrap();
    assert_eq!(user.username, "testuser");
    
    // Test login
    let login_request = LoginRequest {
        username: "testuser".to_string(),
        password: "TestPassword123".to_string(),
    };
    
    let session = auth_service.login(login_request).await.unwrap();
    assert!(!session.token.is_empty());
    
    // Test session validation
    let user_id = auth_service.validate_session(&session.token).await.unwrap();
    assert_eq!(user_id, user.id);
    
    // Test API credentials storage and retrieval
    let api_request = ApiCredentialsRequest {
        api_key: "test_api_key".to_string(),
        api_secret: "test_api_secret".to_string(),
    };
    
    auth_service.store_api_credentials(&user.id, api_request).await.unwrap();
    
    let credentials = auth_service.get_api_credentials(&user.id).await.unwrap();
    assert_eq!(credentials.api_key, "test_api_key");
    assert_eq!(credentials.api_secret, "test_api_secret");
    
    // Test logout
    auth_service.logout(&session.token).await.unwrap();
    
    // Validate session should fail after logout
    let result = auth_service.validate_session(&session.token).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_invalid_credentials() {
    // Create a temporary directory for the test database
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path();
    
    // Initialize the enhanced database service
    let db_service = EnhancedDatabaseService::new(db_path, "test_password")
        .await
        .unwrap();
    
    // Run migrations
    db_service.run_migrations().await.unwrap();
    
    // Create the authentication service
    let auth_service = AuthService::new(Arc::new(db_service));
    
    // Test registration with invalid password (no uppercase)
    let register_request = RegisterRequest {
        username: "testuser".to_string(),
        password: "testpassword123".to_string(),
    };
    
    let result = auth_service.register(register_request).await;
    assert!(result.is_err());
    
    // Test registration with invalid password (no lowercase)
    let register_request = RegisterRequest {
        username: "testuser".to_string(),
        password: "TESTPASSWORD123".to_string(),
    };
    
    let result = auth_service.register(register_request).await;
    assert!(result.is_err());
    
    // Test registration with invalid password (no numbers)
    let register_request = RegisterRequest {
        username: "testuser".to_string(),
        password: "TestPassword".to_string(),
    };
    
    let result = auth_service.register(register_request).await;
    assert!(result.is_err());
    
    // Test registration with invalid username (too short)
    let register_request = RegisterRequest {
        username: "te".to_string(),
        password: "TestPassword123".to_string(),
    };
    
    let result = auth_service.register(register_request).await;
    assert!(result.is_err());
    
    // Test registration with invalid username (invalid characters)
    let register_request = RegisterRequest {
        username: "test@user".to_string(),
        password: "TestPassword123".to_string(),
    };
    
    let result = auth_service.register(register_request).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_duplicate_username() {
    // Create a temporary directory for the test database
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path();
    
    // Initialize the enhanced database service
    let db_service = EnhancedDatabaseService::new(db_path, "test_password")
        .await
        .unwrap();
    
    // Run migrations
    db_service.run_migrations().await.unwrap();
    
    // Create the authentication service
    let auth_service = AuthService::new(Arc::new(db_service));
    
    // Register a user
    let register_request = RegisterRequest {
        username: "testuser".to_string(),
        password: "TestPassword123".to_string(),
    };
    
    auth_service.register(register_request.clone()).await.unwrap();
    
    // Try to register with the same username
    let result = auth_service.register(register_request).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_session_expiration() {
    // Create a temporary directory for the test database
    let temp_dir = tempdir().unwrap();
    let db_path = temp_dir.path();
    
    // Initialize the enhanced database service
    let db_service = EnhancedDatabaseService::new(db_path, "test_password")
        .await
        .unwrap();
    
    // Run migrations
    db_service.run_migrations().await.unwrap();
    
    // Create the authentication service
    let auth_service = AuthService::new(Arc::new(db_service));
    
    // Register and login
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
    
    // Manually insert an expired session
    let pool = auth_service.db_service.get_database().get_pool();
    
    // Set the expiration time to the past
    sqlx::query!(
        "UPDATE session_tokens SET expires_at = datetime('now', '-1 hour') WHERE token = ?",
        session.token
    )
    .execute(pool)
    .await
    .unwrap();
    
    // Validate session should fail
    let result = auth_service.validate_session(&session.token).await;
    assert!(result.is_err());
    
    // Clean up expired sessions
    let count = auth_service.cleanup_expired_sessions().await.unwrap();
    assert_eq!(count, 1);
}