use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;
use chrono::{DateTime, Utc, TimeZone, NaiveDateTime};
use chrono_tz::Tz;
use rust_decimal::Decimal;
use std::str::FromStr;
use crate::models::backtesting::{OHLCV, CsvValidationResult, CsvImportConfig};
use crate::error::{HedgeXError, Result};
use tracing::{info, warn, error, debug};

/// CSV parser for historical market data
pub struct CsvParser {
    config: CsvImportConfig,
}

impl CsvParser {
    /// Create new CSV parser with configuration
    pub fn new(config: CsvImportConfig) -> Self {
        Self { config }
    }
    
    /// Validate CSV file format and content
    pub fn validate_csv(&self, file_path: &str) -> Result<CsvValidationResult> {
        debug!("Validating CSV file: {}", file_path);
        
        let path = Path::new(file_path);
        if !path.exists() {
            return Ok(CsvValidationResult {
                is_valid: false,
                errors: vec!["File does not exist".to_string()],
                warnings: vec![],
                total_rows: 0,
                valid_rows: 0,
            });
        }
        
        let file = File::open(path)
            .map_err(|e| HedgeXError::ConfigError(format!("Failed to open CSV file: {}", e)))?;
        let reader = BufReader::new(file);
        
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        let mut total_rows = 0;
        let mut valid_rows = 0;
        let mut line_number = 0;
        
        for line in reader.lines() {
            line_number += 1;
            
            // Skip header if configured
            if line_number == 1 && self.config.has_header {
                continue;
            }
            
            total_rows += 1;
            
            match line {
                Ok(line_content) => {
                    match self.parse_csv_line(&line_content, line_number) {
                        Ok(_) => valid_rows += 1,
                        Err(e) => {
                            errors.push(format!("Line {}: {}", line_number, e));
                            if errors.len() > 100 {
                                errors.push("Too many errors, stopping validation...".to_string());
                                break;
                            }
                        }
                    }
                }
                Err(e) => {
                    errors.push(format!("Line {}: Failed to read line: {}", line_number, e));
                }
            }
        }
        
        // Add warnings for common issues
        if valid_rows == 0 && total_rows > 0 {
            warnings.push("No valid data rows found. Check date format and column order.".to_string());
        }
        
        if valid_rows < total_rows / 2 {
            warnings.push("More than 50% of rows are invalid. Check data format.".to_string());
        }
        
        let is_valid = errors.is_empty() && valid_rows > 0;
        
        info!("CSV validation completed: {} valid rows out of {} total rows", valid_rows, total_rows);
        
        Ok(CsvValidationResult {
            is_valid,
            errors,
            warnings,
            total_rows,
            valid_rows,
        })
    }
    
    /// Parse CSV file and return OHLCV data
    pub fn parse_csv(&self, file_path: &str) -> Result<Vec<OHLCV>> {
        info!("Parsing CSV file: {}", file_path);
        
        let path = Path::new(file_path);
        let file = File::open(path)
            .map_err(|e| HedgeXError::ConfigError(format!("Failed to open CSV file: {}", e)))?;
        let reader = BufReader::new(file);
        
        let mut ohlcv_data = Vec::new();
        let mut line_number = 0;
        let mut errors = Vec::new();
        
        for line in reader.lines() {
            line_number += 1;
            
            // Skip header if configured
            if line_number == 1 && self.config.has_header {
                continue;
            }
            
            match line {
                Ok(line_content) => {
                    match self.parse_csv_line(&line_content, line_number) {
                        Ok(ohlcv) => ohlcv_data.push(ohlcv),
                        Err(e) => {
                            errors.push(format!("Line {}: {}", line_number, e));
                            if errors.len() > 10 {
                                warn!("Too many parsing errors, stopping at line {}", line_number);
                                break;
                            }
                        }
                    }
                }
                Err(e) => {
                    error!("Failed to read line {}: {}", line_number, e);
                }
            }
        }
        
        if !errors.is_empty() {
            warn!("CSV parsing completed with {} errors", errors.len());
            for error in &errors {
                warn!("CSV Error: {}", error);
            }
        }
        
        // Sort by timestamp
        ohlcv_data.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
        
        info!("Successfully parsed {} OHLCV records from CSV", ohlcv_data.len());
        Ok(ohlcv_data)
    }
    
    /// Parse a single CSV line into OHLCV data
    fn parse_csv_line(&self, line: &str, line_number: usize) -> Result<OHLCV> {
        let fields: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
        
        // Expected format: timestamp,open,high,low,close,volume
        if fields.len() < 6 {
            return Err(HedgeXError::ConfigError(format!(
                "Invalid CSV format: expected 6 columns, found {}",
                fields.len()
            )));
        }
        
        // Parse timestamp
        let timestamp = self.parse_timestamp(fields[0])?;
        
        // Parse OHLCV values
        let open = self.parse_decimal(fields[1], "open")?;
        let high = self.parse_decimal(fields[2], "high")?;
        let low = self.parse_decimal(fields[3], "low")?;
        let close = self.parse_decimal(fields[4], "close")?;
        let volume = self.parse_volume(fields[5])?;
        
        // Validate OHLCV data
        self.validate_ohlcv_data(open, high, low, close, volume)?;
        
        Ok(OHLCV::new(timestamp, open, high, low, close, volume))
    }
    
    /// Parse timestamp string to DateTime<Utc>
    fn parse_timestamp(&self, timestamp_str: &str) -> Result<DateTime<Utc>> {
        // Try parsing with configured format
        let naive_dt = NaiveDateTime::parse_from_str(timestamp_str, &self.config.date_format)
            .map_err(|e| HedgeXError::ConfigError(format!("Failed to parse timestamp '{}': {}", timestamp_str, e)))?;
        
        // Convert to timezone-aware datetime
        let timezone: Tz = self.config.timezone.parse()
            .map_err(|e| HedgeXError::ConfigError(format!("Invalid timezone '{}': {}", self.config.timezone, e)))?;
        
        let local_dt = timezone.from_local_datetime(&naive_dt)
            .single()
            .ok_or_else(|| HedgeXError::ConfigError(format!("Ambiguous timestamp: {}", timestamp_str)))?;
        
        Ok(local_dt.with_timezone(&Utc))
    }
    
    /// Parse decimal value from string
    fn parse_decimal(&self, value_str: &str, field_name: &str) -> Result<Decimal> {
        Decimal::from_str(value_str)
            .map_err(|e| HedgeXError::ConfigError(format!("Failed to parse {} '{}': {}", field_name, value_str, e)))
    }
    
    /// Parse volume from string
    fn parse_volume(&self, volume_str: &str) -> Result<i64> {
        volume_str.parse::<i64>()
            .map_err(|e| HedgeXError::ConfigError(format!("Failed to parse volume '{}': {}", volume_str, e)))
    }
    
    /// Validate OHLCV data for consistency
    fn validate_ohlcv_data(&self, open: Decimal, high: Decimal, low: Decimal, close: Decimal, volume: i64) -> Result<()> {
        // Check that high is the highest value
        if high < open || high < close || high < low {
            return Err(HedgeXError::ConfigError(
                "Invalid OHLCV data: high price is not the highest value".to_string()
            ));
        }
        
        // Check that low is the lowest value
        if low > open || low > close || low > high {
            return Err(HedgeXError::ConfigError(
                "Invalid OHLCV data: low price is not the lowest value".to_string()
            ));
        }
        
        // Check for negative values
        if open <= Decimal::ZERO || high <= Decimal::ZERO || low <= Decimal::ZERO || close <= Decimal::ZERO {
            return Err(HedgeXError::ConfigError(
                "Invalid OHLCV data: prices must be positive".to_string()
            ));
        }
        
        // Check volume
        if volume < 0 {
            return Err(HedgeXError::ConfigError(
                "Invalid OHLCV data: volume cannot be negative".to_string()
            ));
        }
        
        Ok(())
    }
    
    /// Get supported date formats
    pub fn get_supported_date_formats() -> Vec<&'static str> {
        vec![
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y %H:%M",
            "%d/%m/%Y",
            "%d-%m-%Y %H:%M:%S",
            "%d-%m-%Y %H:%M",
            "%d-%m-%Y",
            "%Y%m%d %H%M%S",
            "%Y%m%d",
        ]
    }
    
    /// Auto-detect date format from sample data
    pub fn detect_date_format(sample_lines: &[String]) -> Option<String> {
        let formats = Self::get_supported_date_formats();
        
        for format in formats {
            let mut success_count = 0;
            
            for line in sample_lines.iter().take(5) {
                let fields: Vec<&str> = line.split(',').collect();
                if !fields.is_empty() {
                    if NaiveDateTime::parse_from_str(fields[0].trim(), format).is_ok() {
                        success_count += 1;
                    }
                }
            }
            
            // If more than half of the samples work with this format, use it
            if success_count > sample_lines.len() / 2 {
                return Some(format.to_string());
            }
        }
        
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;
    use std::io::Write;
    
    fn create_test_csv_config() -> CsvImportConfig {
        CsvImportConfig {
            symbol: "RELIANCE".to_string(),
            exchange: "NSE".to_string(),
            timeframe: crate::models::backtesting::Timeframe::Day1,
            has_header: true,
            date_format: "%Y-%m-%d %H:%M:%S".to_string(),
            timezone: "Asia/Kolkata".to_string(),
        }
    }
    
    #[test]
    fn test_csv_validation_valid_file() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "timestamp,open,high,low,close,volume").unwrap();
        writeln!(temp_file, "2024-01-01 09:15:00,100.0,105.0,99.0,103.0,1000").unwrap();
        writeln!(temp_file, "2024-01-01 09:16:00,103.0,106.0,102.0,105.0,1500").unwrap();
        
        let config = create_test_csv_config();
        let parser = CsvParser::new(config);
        
        let result = parser.validate_csv(temp_file.path().to_str().unwrap()).unwrap();
        assert!(result.is_valid);
        assert_eq!(result.valid_rows, 2);
        assert_eq!(result.total_rows, 2);
    }
    
    #[test]
    fn test_csv_parsing() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "timestamp,open,high,low,close,volume").unwrap();
        writeln!(temp_file, "2024-01-01 09:15:00,100.0,105.0,99.0,103.0,1000").unwrap();
        writeln!(temp_file, "2024-01-01 09:16:00,103.0,106.0,102.0,105.0,1500").unwrap();
        
        let config = create_test_csv_config();
        let parser = CsvParser::new(config);
        
        let ohlcv_data = parser.parse_csv(temp_file.path().to_str().unwrap()).unwrap();
        assert_eq!(ohlcv_data.len(), 2);
        
        let first_candle = &ohlcv_data[0];
        assert_eq!(first_candle.open, Decimal::from(100));
        assert_eq!(first_candle.high, Decimal::from(105));
        assert_eq!(first_candle.low, Decimal::from(99));
        assert_eq!(first_candle.close, Decimal::from(103));
        assert_eq!(first_candle.volume, 1000);
    }
    
    #[test]
    fn test_invalid_ohlcv_data() {
        let mut temp_file = NamedTempFile::new().unwrap();
        writeln!(temp_file, "timestamp,open,high,low,close,volume").unwrap();
        writeln!(temp_file, "2024-01-01 09:15:00,100.0,95.0,99.0,103.0,1000").unwrap(); // high < open
        
        let config = create_test_csv_config();
        let parser = CsvParser::new(config);
        
        let result = parser.validate_csv(temp_file.path().to_str().unwrap()).unwrap();
        assert!(!result.is_valid);
        assert!(!result.errors.is_empty());
    }
    
    #[test]
    fn test_date_format_detection() {
        let sample_lines = vec![
            "2024-01-01 09:15:00,100.0,105.0,99.0,103.0,1000".to_string(),
            "2024-01-01 09:16:00,103.0,106.0,102.0,105.0,1500".to_string(),
        ];
        
        let detected_format = CsvParser::detect_date_format(&sample_lines);
        assert_eq!(detected_format, Some("%Y-%m-%d %H:%M:%S".to_string()));
    }
}