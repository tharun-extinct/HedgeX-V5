use crate::api::kite_client::{KiteApiClient, KiteClient};
use crate::models::kite::{
    KiteOrderRequest, KiteOrderResponse, KitePosition, 
    KiteOrder, KiteHolding, KiteMarginResponse, KiteProfile, KiteQuote,
    KiteHistoricalDataParams, KiteOHLCV, KiteInstrument, KiteExchange,
    KiteOrderType, KiteOrderVariety, KiteProduct, KiteValidity, KiteTransactionType,
    KiteInterval,
};
use mockito::{mock, server_url};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

#[tokio::test]
async fn test_generate_session() {
    let mut server = mockito::Server::new();
    let mock_url = server.url();
    
    // Create client with mock server URL
    let client = KiteClient::new_with_config("test_api_key", &mock_url, 0).unwrap();
    
    // Setup mock response
    let _m = server.mock("POST", "/session/token")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"status":"success","data":{"access_token":"test_access_token"}}"#)
        .create();
    
    // Call generate_session
    let result = client.generate_session("test_request_token", "test_api_secret").await;
    
    // Verify result
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), "test_access_token");
    
    // Verify access token was set
    assert_eq!(client.get_access_token().await, Some("test_access_token".to_string()));
}

#[tokio::test]
async fn test_invalidate_session() {
    let mut server = mockito::Server::new();
    let mock_url = server.url();
    
    // Create client with mock server URL
    let client = KiteClient::new_with_config("test_api_key", &mock_url, 0).unwrap();
    
    // Set access token
    client.set_access_token("test_access_token".to_string()).await;
    
    // Setup mock response
    let _m = server.mock("DELETE", "/session/token")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"status":"success","data":{}}"#)
        .create();
    
    // Call invalidate_session
    let result = client.invalidate_session().await;
    
    // Verify result
    assert!(result.is_ok());
    
    // Verify access token was cleared
    assert_eq!(client.get_access_token().await, None);
}

#[tokio::test]
async fn test_get_profile() {
    let mut server = mockito::Server::new();
    let mock_url = server.url();
    
    // Create client with mock server URL
    let client = KiteClient::new_with_config("test_api_key", &mock_url, 0).unwrap();
    
    // Set access token
    client.set_access_token("test_access_token".to_string()).await;
    
    // Setup mock response
    let _m = server.mock("GET", "/user/profile")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"status":"success","data":{"user_id":"AB1234","user_name":"Test User","user_shortname":"Test","email":"test@example.com","user_type":"individual","broker":"ZERODHA","products":["CNC","MIS"],"order_types":["MARKET","LIMIT"],"exchanges":["NSE","BSE"]}}"#)
        .create();
    
    // Call get_profile
    let result = client.get_profile().await;
    
    // Verify result
    assert!(result.is_ok());
    let profile = result.unwrap();
    assert_eq!(profile.user_id, "AB1234");
    assert_eq!(profile.user_name, "Test User");
    assert_eq!(profile.email, "test@example.com");
    assert_eq!(profile.user_type, "individual");
    assert_eq!(profile.broker, "ZERODHA");
}

#[tokio::test]
async fn test_get_margins() {
    let mut server = mockito::Server::new();
    let mock_url = server.url();
    
    // Create client with mock server URL
    let client = KiteClient::new_with_config("test_api_key", &mock_url, 0).unwrap();
    
    // Set access token
    client.set_access_token("test_access_token".to_string()).await;
    
    // Setup mock response
    let _m = server.mock("GET", "/user/margins")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"status":"success","data":{"equity":{"enabled":true,"net":10000.0,"available":{"adhoc_margin":0.0,"cash":10000.0,"collateral":0.0,"intraday_payin":0.0},"used":{"debits":0.0,"exposure":0.0,"m2m_realised":0.0,"m2m_unrealised":0.0,"option_premium":0.0,"payout":0.0,"span":0.0,"holding_sales":0.0,"turnover":0.0}},"commodity":{"enabled":true,"net":0.0,"available":{"adhoc_margin":0.0,"cash":0.0,"collateral":0.0,"intraday_payin":0.0},"used":{"debits":0.0,"exposure":0.0,"m2m_realised":0.0,"m2m_unrealised":0.0,"option_premium":0.0,"payout":0.0,"span":0.0,"holding_sales":0.0,"turnover":0.0}}}}"#)
        .create();
    
    // Call get_margins
    let result = client.get_margins().await;
    
    // Verify result
    assert!(result.is_ok());
    let margins = result.unwrap();
    assert_eq!(margins.equity.enabled, true);
    assert_eq!(margins.equity.net, 10000.0);
    assert_eq!(margins.equity.available.cash, 10000.0);
}

#[tokio::test]
async fn test_get_orders() {
    let mut server = mockito::Server::new();
    let mock_url = server.url();
    
    // Create client with mock server URL
    let client = KiteClient::new_with_config("test_api_key", &mock_url, 0).unwrap();
    
    // Set access token
    client.set_access_token("test_access_token".to_string()).await;
    
    // Setup mock response
    let _m = server.mock("GET", "/orders")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"status":"success","data":[{"order_id":"123456","exchange_order_id":"NSE123456","parent_order_id":null,"status":"COMPLETE","status_message":null,"order_timestamp":"2023-01-01T10:00:00+05:30","exchange_update_timestamp":"2023-01-01T10:00:01+05:30","exchange_timestamp":"2023-01-01T10:00:01+05:30","variety":"regular","exchange":"NSE","tradingsymbol":"INFY","instrument_token":123456,"transaction_type":"BUY","order_type":"MARKET","product":"CNC","validity":"DAY","price":0.0,"trigger_price":0.0,"average_price":1500.0,"filled_quantity":10,"pending_quantity":0,"cancelled_quantity":0,"disclosed_quantity":0,"market_protection":false,"tag":null,"tags":null}]}"#)
        .create();
    
    // Call get_orders
    let result = client.get_orders().await;
    
    // Verify result
    assert!(result.is_ok());
    let orders = result.unwrap();
    assert_eq!(orders.len(), 1);
    assert_eq!(orders[0].order_id, "123456");
    assert_eq!(orders[0].exchange, KiteExchange::NSE);
    assert_eq!(orders[0].tradingsymbol, "INFY");
    assert_eq!(orders[0].transaction_type, KiteTransactionType::Buy);
    assert_eq!(orders[0].product, KiteProduct::CNC);
}

#[tokio::test]
async fn test_place_order() {
    let mut server = mockito::Server::new();
    let mock_url = server.url();
    
    // Create client with mock server URL
    let client = KiteClient::new_with_config("test_api_key", &mock_url, 0).unwrap();
    
    // Set access token
    client.set_access_token("test_access_token".to_string()).await;
    
    // Setup mock response
    let _m = server.mock("POST", "/orders")
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"status":"success","data":{"order_id":"123456"}}"#)
        .create();
    
    // Create order request
    let order = KiteOrderRequest {
        tradingsymbol: "INFY".to_string(),
        exchange: KiteExchange::NSE,
        transaction_type: KiteTransactionType::Buy,
        order_type: KiteOrderType::Market,
        quantity: 10,
        price: None,
        product: KiteProduct::CNC,
        validity: KiteValidity::Day,
        disclosed_quantity: None,
        trigger_price: None,
        squareoff: None,
        stoploss: None,
        trailing_stoploss: None,
        variety: KiteOrderVariety::Regular,
    };
    
    // Call place_order
    let result = client.place_order(order).await;
    
    // Verify result
    assert!(result.is_ok());
    let response = result.unwrap();
    assert_eq!(response.order_id, "123456");
}

#[tokio::test]
async fn test_error_handling() {
    let mut server = mockito::Server::new();
    let mock_url = server.url();
    
    // Create client with mock server URL
    let client = KiteClient::new_with_config("test_api_key", &mock_url, 0).unwrap();
    
    // Set access token
    client.set_access_token("test_access_token".to_string()).await;
    
    // Setup mock response for authentication error
    let _m = server.mock("GET", "/user/profile")
        .with_status(403)
        .with_header("content-type", "application/json")
        .with_body(r#"{"status":"error","error_type":"TokenException","error_message":"Invalid API key or access token"}"#)
        .create();
    
    // Call get_profile
    let result = client.get_profile().await;
    
    // Verify error
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(format!("{}", err).contains("Invalid API key or access token"));
}

#[tokio::test]
async fn test_rate_limit_error() {
    let mut server = mockito::Server::new();
    let mock_url = server.url();
    
    // Create client with mock server URL
    let client = KiteClient::new_with_config("test_api_key", &mock_url, 0).unwrap();
    
    // Set access token
    client.set_access_token("test_access_token".to_string()).await;
    
    // Setup mock response for rate limit error
    let _m = server.mock("GET", "/user/profile")
        .with_status(429)
        .with_header("content-type", "application/json")
        .with_body(r#"{"status":"error","error_type":"TooManyRequestsException","error_message":"Rate limit exceeded"}"#)
        .create();
    
    // Call get_profile
    let result = client.get_profile().await;
    
    // Verify error
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert!(format!("{}", err).contains("Rate limit exceeded"));
}