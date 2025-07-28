use reqwest::Client;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::models::backtesting::{OHLCV, Timeframe, HistoricalDataParams};
use crate::error::{HedgeXError, Result};
use tracing::{info, warn, error, debug};
use rust_decimal::Decimal;
use std::str::FromStr;

/// Kite Historical Data API client
pub struct KiteHistoricalClient {
    client: Client,
    base_url: String,
    api_key: String,
    access_token: Option<String>,
}

/// Kite API historical data response
#[derive(Debug, Deserialize)]
struct KiteHistoricalResponse {
    status: String,
    data: KiteHistoricalData,
}

#[derive(Debug, Deserialize)]
struct KiteHistoricalData {
    candles: Vec<Vec<serde_json::Value>>,
}

/// Kite API instrument response
#[derive(Debug, Deserialize)]
struct KiteInstrument {
    instrument_token: u64,
    exchange_token: u64,
    tradingsymbol: String,
    name: String,
    last_price: f64,
    expiry: Option<String>,
    strike: Option<f64>,
    tick_size: f64,
    lot_size: u32,
    instrument_type: String,
    segment: String,
    exchange: String,
}

impl KiteHistoricalClient {
    /// Create new Kite Historical client
    pub fn new(api_key: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: "https://api.kite.trade".to_string(),
            api_key: api_key.to_string(),
            access_token: None,
        }
    }
    
    /// Set access token for authenticated requests
    pub fn set_access_token(&mut self, access_token: &str) {
        self.access_token = Some(access_token.to_string());
    }
    
    /// Fetch historical data from Kite API
    pub async fn fetch_historical_data(&self, params: &HistoricalDataParams) -> Result<Vec<OHLCV>> {
        info!("Fetching historical data for {} from Kite API", params.symbol);
        
        let access_token = self.access_token.as_ref()
            .ok_or_else(|| HedgeXError::AuthenticationError("Access token not set".to_string()))?;
        
        // Get instrument token for the symbol
        let instrument_token = self.get_instrument_token(&params.symbol, &params.exchange).await?;
        
        // Convert timeframe to Kite API format
        let interval = self.timeframe_to_kite_interval(&params.timeframe);
        
        // Format dates for API
        let from_date = params.from_date.format("%Y-%m-%d").to_string();
        let to_date = params.to_date.format("%Y-%m-%d").to_string();
        
        // Build request URL
        let url = format!(
            "{}/instruments/historical/{}/{}",
            self.base_url,
            instrument_token,
            interval
        );
        
        debug!("Requesting historical data from: {}", url);
        
        // Make API request
        let response = self.client
            .get(&url)
            .header("X-Kite-Version", "3")
            .header("Authorization", format!("token {}:{}", self.api_key, access_token))
            .query(&[
                ("from", from_date.as_str()),
                ("to", to_date.as_str()),
            ])
            .send()
            .await
            .map_err(|e| HedgeXError::ApiError(format!("Failed to fetch historical data: {}", e)))?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(HedgeXError::ApiError(format!(
                "Kite API error {}: {}",
                status,
                error_text
            )));
        }
        
        let api_response: KiteHistoricalResponse = response
            .json()
            .await
            .map_err(|e| HedgeXError::ApiError(format!("Failed to parse historical data response: {}", e)))?;
        
        if api_response.status != "success" {
            return Err(HedgeXError::ApiError(format!(
                "Kite API returned error status: {}",
                api_response.status
            )));
        }
        
        // Convert API response to OHLCV data
        let ohlcv_data = self.convert_kite_candles_to_ohlcv(api_response.data.candles)?;
        
        info!("Successfully fetched {} historical data points", ohlcv_data.len());
        Ok(ohlcv_data)
    }
    
    /// Get instrument token for a symbol
    async fn get_instrument_token(&self, symbol: &str, exchange: &str) -> Result<u64> {
        debug!("Getting instrument token for {}:{}", exchange, symbol);
        
        // For this implementation, we'll use a simplified approach
        // In a real implementation, you would fetch the instruments list from Kite API
        // and cache it locally for performance
        
        // This is a placeholder - in production, you would:
        // 1. Download instruments.csv from Kite API
        // 2. Parse and cache the instrument data
        // 3. Look up the instrument token by symbol and exchange
        
        // For now, return a mock instrument token
        // You would replace this with actual instrument lookup
        match (exchange, symbol) {
            ("NSE", "RELIANCE") => Ok(738561),
            ("NSE", "TCS") => Ok(2953217),
            ("NSE", "INFY") => Ok(408065),
            ("NSE", "HDFCBANK") => Ok(341249),
            ("NSE", "ICICIBANK") => Ok(1270529),
            _ => {
                warn!("Instrument token not found for {}:{}, using default", exchange, symbol);
                // In production, this should return an error or fetch from API
                Ok(0) // This will cause API calls to fail, which is expected for unknown symbols
            }
        }
    }
    
    /// Convert timeframe to Kite API interval format
    fn timeframe_to_kite_interval(&self, timeframe: &Timeframe) -> String {
        match timeframe {
            Timeframe::Minute1 => "minute".to_string(),
            Timeframe::Minute5 => "5minute".to_string(),
            Timeframe::Minute15 => "15minute".to_string(),
            Timeframe::Minute30 => "30minute".to_string(),
            Timeframe::Hour1 => "60minute".to_string(),
            Timeframe::Day1 => "day".to_string(),
        }
    }
    
    /// Convert Kite API candle data to OHLCV format
    fn convert_kite_candles_to_ohlcv(&self, candles: Vec<Vec<serde_json::Value>>) -> Result<Vec<OHLCV>> {
        let mut ohlcv_data = Vec::new();
        
        for candle in candles {
            if candle.len() < 6 {
                warn!("Invalid candle data: expected 6 values, got {}", candle.len());
                continue;
            }
            
            // Kite API candle format: [timestamp, open, high, low, close, volume]
            let timestamp_str = candle[0].as_str()
                .ok_or_else(|| HedgeXError::ApiError("Invalid timestamp in candle data".to_string()))?;
            
            let timestamp = DateTime::parse_from_rfc3339(timestamp_str)
                .map_err(|e| HedgeXError::ApiError(format!("Failed to parse timestamp: {}", e)))?
                .with_timezone(&Utc);
            
            let open = self.parse_decimal_from_value(&candle[1], "open")?;
            let high = self.parse_decimal_from_value(&candle[2], "high")?;
            let low = self.parse_decimal_from_value(&candle[3], "low")?;
            let close = self.parse_decimal_from_value(&candle[4], "close")?;
            let volume = candle[5].as_i64()
                .ok_or_else(|| HedgeXError::ApiError("Invalid volume in candle data".to_string()))?;
            
            ohlcv_data.push(OHLCV::new(timestamp, open, high, low, close, volume));
        }
        
        // Sort by timestamp
        ohlcv_data.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
        
        Ok(ohlcv_data)
    }
    
    /// Parse decimal value from JSON value
    fn parse_decimal_from_value(&self, value: &serde_json::Value, field_name: &str) -> Result<Decimal> {
        let float_val = value.as_f64()
            .ok_or_else(|| HedgeXError::ApiError(format!("Invalid {} in candle data", field_name)))?;
        
        Decimal::from_str(&float_val.to_string())
            .map_err(|e| HedgeXError::ApiError(format!("Failed to convert {} to decimal: {}", field_name, e)))
    }
    
    /// Fetch instruments list from Kite API (for production use)
    pub async fn fetch_instruments(&self, exchange: &str) -> Result<Vec<KiteInstrument>> {
        info!("Fetching instruments list for exchange: {}", exchange);
        
        let url = format!("{}/instruments/{}", self.base_url, exchange);
        
        let response = self.client
            .get(&url)
            .header("X-Kite-Version", "3")
            .send()
            .await
            .map_err(|e| HedgeXError::ApiError(format!("Failed to fetch instruments: {}", e)))?;
        
        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(HedgeXError::ApiError(format!(
                "Kite API error {}: {}",
                status,
                error_text
            )));
        }
        
        let csv_data = response.text().await
            .map_err(|e| HedgeXError::ApiError(format!("Failed to read instruments response: {}", e)))?;
        
        // Parse CSV data
        let instruments = self.parse_instruments_csv(&csv_data)?;
        
        info!("Successfully fetched {} instruments", instruments.len());
        Ok(instruments)
    }
    
    /// Parse instruments CSV data
    fn parse_instruments_csv(&self, csv_data: &str) -> Result<Vec<KiteInstrument>> {
        let mut instruments = Vec::new();
        let mut lines = csv_data.lines();
        
        // Skip header
        lines.next();
        
        for line in lines {
            let fields: Vec<&str> = line.split(',').collect();
            if fields.len() < 12 {
                continue;
            }
            
            let instrument = KiteInstrument {
                instrument_token: fields[0].parse().unwrap_or(0),
                exchange_token: fields[1].parse().unwrap_or(0),
                tradingsymbol: fields[2].to_string(),
                name: fields[3].to_string(),
                last_price: fields[4].parse().unwrap_or(0.0),
                expiry: if fields[5].is_empty() { None } else { Some(fields[5].to_string()) },
                strike: if fields[6].is_empty() { None } else { fields[6].parse().ok() },
                tick_size: fields[7].parse().unwrap_or(0.01),
                lot_size: fields[8].parse().unwrap_or(1),
                instrument_type: fields[9].to_string(),
                segment: fields[10].to_string(),
                exchange: fields[11].to_string(),
            };
            
            instruments.push(instrument);
        }
        
        Ok(instruments)
    }
    
    /// Check if API is available and accessible
    pub async fn health_check(&self) -> Result<bool> {
        debug!("Performing Kite API health check");
        
        let url = format!("{}/user/profile", self.base_url);
        
        let access_token = self.access_token.as_ref()
            .ok_or_else(|| HedgeXError::AuthenticationError("Access token not set".to_string()))?;
        
        let response = self.client
            .get(&url)
            .header("X-Kite-Version", "3")
            .header("Authorization", format!("token {}:{}", self.api_key, access_token))
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await;
        
        match response {
            Ok(resp) => {
                let is_healthy = resp.status().is_success();
                if is_healthy {
                    debug!("Kite API health check passed");
                } else {
                    warn!("Kite API health check failed with status: {}", resp.status());
                }
                Ok(is_healthy)
            }
            Err(e) => {
                error!("Kite API health check failed: {}", e);
                Ok(false)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mockito::{Server, Mock};
    
    #[tokio::test]
    async fn test_timeframe_conversion() {
        let client = KiteHistoricalClient::new("test_api_key");
        
        assert_eq!(client.timeframe_to_kite_interval(&Timeframe::Minute1), "minute");
        assert_eq!(client.timeframe_to_kite_interval(&Timeframe::Minute5), "5minute");
        assert_eq!(client.timeframe_to_kite_interval(&Timeframe::Day1), "day");
    }
    
    #[tokio::test]
    async fn test_candle_conversion() {
        let client = KiteHistoricalClient::new("test_api_key");
        
        let candles = vec![
            vec![
                serde_json::Value::String("2024-01-01T09:15:00+05:30".to_string()),
                serde_json::Value::Number(serde_json::Number::from_f64(100.0).unwrap()),
                serde_json::Value::Number(serde_json::Number::from_f64(105.0).unwrap()),
                serde_json::Value::Number(serde_json::Number::from_f64(99.0).unwrap()),
                serde_json::Value::Number(serde_json::Number::from_f64(103.0).unwrap()),
                serde_json::Value::Number(serde_json::Number::from(1000)),
            ]
        ];
        
        let ohlcv_data = client.convert_kite_candles_to_ohlcv(candles).unwrap();
        assert_eq!(ohlcv_data.len(), 1);
        
        let candle = &ohlcv_data[0];
        assert_eq!(candle.open, Decimal::from(100));
        assert_eq!(candle.high, Decimal::from(105));
        assert_eq!(candle.low, Decimal::from(99));
        assert_eq!(candle.close, Decimal::from(103));
        assert_eq!(candle.volume, 1000);
    }
}