use serde::{Serialize, Deserialize, Deserializer};
use serde::de::{self, Visitor};
use std::fmt;
use std::str::FromStr;
use rust_decimal::Decimal;
use chrono::{DateTime, Utc, NaiveDate};
use std::collections::HashMap;

/// API credentials for Zerodha Kite
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiteApiCredentials {
    /// API key
    pub api_key: String,
    
    /// API secret (encrypted)
    pub api_secret: String,
    
    /// Access token (optional)
    pub access_token: Option<String>,
    
    /// Access token expiry
    pub access_token_expiry: Option<DateTime<Utc>>,
}

/// Kite order request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiteOrderRequest {
    /// Trading symbol
    pub tradingsymbol: String,
    
    /// Exchange
    pub exchange: KiteExchange,
    
    /// Transaction type (buy/sell)
    pub transaction_type: KiteTransactionType,
    
    /// Order type (market/limit/etc)
    pub order_type: KiteOrderType,
    
    /// Quantity
    pub quantity: u32,
    
    /// Price (required for limit orders)
    pub price: Option<f64>,
    
    /// Product code
    pub product: KiteProduct,
    
    /// Order validity
    pub validity: KiteValidity,
    
    /// Disclosed quantity
    pub disclosed_quantity: Option<KiteDiscloseQuantity>,
    
    /// Trigger price (for SL orders)
    pub trigger_price: Option<f64>,
    
    /// Square off value (for BO orders)
    pub squareoff: Option<f64>,
    
    /// Stoploss value (for BO orders)
    pub stoploss: Option<f64>,
    
    /// Trailing stoploss value (for BO orders)
    pub trailing_stoploss: Option<f64>,
    
    /// Order variety
    pub variety: KiteOrderVariety,
}

/// Kite order response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiteOrderResponse {
    /// Order ID
    pub order_id: String,
}

/// Kite position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KitePosition {
    /// Day positions
    pub day: Vec<KitePositionItem>,
    
    /// Net positions
    pub net: Vec<KitePositionItem>,
}

/// Kite position item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KitePositionItem {
    /// Trading symbol
    pub tradingsymbol: String,
    
    /// Exchange
    pub exchange: KiteExchange,
    
    /// Product
    pub product: KiteProduct,
    
    /// Quantity
    pub quantity: i32,
    
    /// Average price
    pub average_price: f64,
    
    /// Last price
    pub last_price: f64,
    
    /// PnL
    pub pnl: f64,
    
    /// Realized PnL
    pub realized_pnl: f64,
    
    /// Unrealized PnL
    pub unrealized_pnl: f64,
    
    /// Value
    pub value: f64,
    
    /// Buy quantity
    pub buy_quantity: i32,
    
    /// Buy price
    pub buy_price: f64,
    
    /// Buy value
    pub buy_value: f64,
    
    /// Sell quantity
    pub sell_quantity: i32,
    
    /// Sell price
    pub sell_price: f64,
    
    /// Sell value
    pub sell_value: f64,
    
    /// Day buy quantity
    pub day_buy_quantity: i32,
    
    /// Day sell quantity
    pub day_sell_quantity: i32,
    
    /// Day buy price
    pub day_buy_price: f64,
    
    /// Day sell price
    pub day_sell_price: f64,
    
    /// Day buy value
    pub day_buy_value: f64,
    
    /// Day sell value
    pub day_sell_value: f64,
}

/// Kite order
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiteOrder {
    /// Order ID
    pub order_id: String,
    
    /// Exchange order ID
    pub exchange_order_id: Option<String>,
    
    /// Parent order ID (for BO/CO orders)
    pub parent_order_id: Option<String>,
    
    /// Status
    pub status: KiteOrderStatus,
    
    /// Status message
    pub status_message: Option<String>,
    
    /// Order timestamp
    pub order_timestamp: Option<DateTime<Utc>>,
    
    /// Exchange update timestamp
    pub exchange_update_timestamp: Option<DateTime<Utc>>,
    
    /// Exchange timestamp
    pub exchange_timestamp: Option<DateTime<Utc>>,
    
    /// Variety
    pub variety: KiteOrderVariety,
    
    /// Exchange
    pub exchange: KiteExchange,
    
    /// Trading symbol
    pub tradingsymbol: String,
    
    /// Instrument token
    pub instrument_token: u64,
    
    /// Transaction type
    pub transaction_type: KiteTransactionType,
    
    /// Order type
    pub order_type: KiteOrderType,
    
    /// Product
    pub product: KiteProduct,
    
    /// Validity
    pub validity: KiteValidity,
    
    /// Price
    pub price: f64,
    
    /// Trigger price
    pub trigger_price: f64,
    
    /// Average price
    pub average_price: f64,
    
    /// Filled quantity
    pub filled_quantity: u32,
    
    /// Pending quantity
    pub pending_quantity: u32,
    
    /// Cancelled quantity
    pub cancelled_quantity: u32,
    
    /// Disclosed quantity
    pub disclosed_quantity: u32,
    
    /// Market protection
    pub market_protection: bool,
    
    /// Tag
    pub tag: Option<String>,
    
    /// Tags
    pub tags: Option<Vec<String>>,
}

/// Kite holding
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiteHolding {
    /// Trading symbol
    pub tradingsymbol: String,
    
    /// Exchange
    pub exchange: KiteExchange,
    
    /// Instrument token
    pub instrument_token: u64,
    
    /// ISIN
    pub isin: String,
    
    /// Product
    pub product: KiteProduct,
    
    /// Price
    pub price: f64,
    
    /// Quantity
    pub quantity: i32,
    
    /// Used quantity
    pub used_quantity: i32,
    
    /// T1 quantity
    pub t1_quantity: i32,
    
    /// Realised quantity
    pub realised_quantity: i32,
    
    /// Authorised quantity
    pub authorised_quantity: i32,
    
    /// Collateral quantity
    pub collateral_quantity: i32,
    
    /// Collateral type
    pub collateral_type: Option<String>,
    
    /// Average price
    pub average_price: f64,
    
    /// Last price
    pub last_price: f64,
    
    /// Close price
    pub close_price: f64,
    
    /// PnL
    pub pnl: f64,
    
    /// Day change
    pub day_change: f64,
    
    /// Day change percentage
    pub day_change_percentage: f64,
}

/// Kite margin response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiteMarginResponse {
    /// Equity segment margins
    pub equity: KiteMargin,
    
    /// Commodity segment margins
    pub commodity: KiteMargin,
}

/// Kite margin
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiteMargin {
    /// Enabled
    pub enabled: bool,
    
    /// Net
    pub net: f64,
    
    /// Available margin
    pub available: KiteAvailableMargin,
    
    /// Used margin
    pub used: KiteUsedMargin,
}

/// Kite available margin
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiteAvailableMargin {
    /// Adhoc margin
    pub adhoc_margin: f64,
    
    /// Cash
    pub cash: f64,
    
    /// Collateral
    pub collateral: f64,
    
    /// Intraday payin
    pub intraday_payin: f64,
}

/// Kite used margin
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiteUsedMargin {
    /// Debits
    pub debits: f64,
    
    /// Exposure
    pub exposure: f64,
    
    /// M2M realised
    pub m2m_realised: f64,
    
    /// M2M unrealised
    pub m2m_unrealised: f64,
    
    /// Option premium
    pub option_premium: f64,
    
    /// Payout
    pub payout: f64,
    
    /// Span
    pub span: f64,
    
    /// Holding sales
    pub holding_sales: f64,
    
    /// Turnover
    pub turnover: f64,
}

/// Kite profile
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiteProfile {
    /// User ID
    pub user_id: String,
    
    /// User name
    pub user_name: String,
    
    /// User shortname
    pub user_shortname: String,
    
    /// Email
    pub email: String,
    
    /// User type
    pub user_type: String,
    
    /// Broker
    pub broker: String,
    
    /// Products enabled
    pub products: Vec<String>,
    
    /// Order types enabled
    pub order_types: Vec<String>,
    
    /// Exchanges enabled
    pub exchanges: Vec<String>,
}

/// Kite quote
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiteQuote {
    /// Instrument token
    pub instrument_token: u64,
    
    /// Last price
    pub last_price: f64,
    
    /// Last quantity
    pub last_quantity: u32,
    
    /// Average traded price
    pub average_price: f64,
    
    /// Volume
    pub volume: u64,
    
    /// Buy quantity
    pub buy_quantity: u64,
    
    /// Sell quantity
    pub sell_quantity: u64,
    
    /// Open price
    pub ohlc: KiteOHLC,
    
    /// Net change
    pub net_change: f64,
    
    /// Lower circuit limit
    pub lower_circuit_limit: f64,
    
    /// Upper circuit limit
    pub upper_circuit_limit: f64,
    
    /// Depth
    pub depth: KiteMarketDepth,
}

/// Kite OHLC
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiteOHLC {
    /// Open price
    pub open: f64,
    
    /// High price
    pub high: f64,
    
    /// Low price
    pub low: f64,
    
    /// Close price
    pub close: f64,
}

/// Kite market depth
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiteMarketDepth {
    /// Buy orders
    pub buy: Vec<KiteDepthItem>,
    
    /// Sell orders
    pub sell: Vec<KiteDepthItem>,
}

/// Kite depth item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiteDepthItem {
    /// Price
    pub price: f64,
    
    /// Quantity
    pub quantity: u32,
    
    /// Orders
    pub orders: u32,
}

/// Kite historical data parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiteHistoricalDataParams {
    /// Instrument token
    pub instrument_token: u64,
    
    /// Symbol
    pub symbol: String,
    
    /// Exchange
    pub exchange: KiteExchange,
    
    /// From date
    pub from_date: String,
    
    /// To date
    pub to_date: String,
    
    /// Interval
    pub interval: KiteInterval,
}

/// Kite OHLCV
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiteOHLCV {
    /// Timestamp
    pub date: DateTime<Utc>,
    
    /// Open price
    pub open: f64,
    
    /// High price
    pub high: f64,
    
    /// Low price
    pub low: f64,
    
    /// Close price
    pub close: f64,
    
    /// Volume
    pub volume: u64,
}

/// Kite instrument
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KiteInstrument {
    /// Instrument token
    pub instrument_token: u64,
    
    /// Exchange token
    pub exchange_token: u64,
    
    /// Trading symbol
    pub tradingsymbol: String,
    
    /// Name
    pub name: String,
    
    /// Last price
    pub last_price: f64,
    
    /// Expiry
    pub expiry: Option<NaiveDate>,
    
    /// Strike
    pub strike: Option<f64>,
    
    /// Tick size
    pub tick_size: f64,
    
    /// Lot size
    pub lot_size: u32,
    
    /// Instrument type
    pub instrument_type: String,
    
    /// Segment
    pub segment: String,
    
    /// Exchange
    pub exchange: KiteExchange,
}

/// Kite exchange enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum KiteExchange {
    /// National Stock Exchange
    NSE,
    
    /// Bombay Stock Exchange
    BSE,
    
    /// Multi Commodity Exchange
    MCX,
    
    /// National Commodity & Derivatives Exchange
    NCDEX,
    
    /// Currency Derivatives segment of NSE
    CDS,
    
    /// Bombay Stock Exchange Currency
    BCD,
}

impl Serialize for KiteExchange {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(match self {
            KiteExchange::NSE => "NSE",
            KiteExchange::BSE => "BSE",
            KiteExchange::MCX => "MCX",
            KiteExchange::NCDEX => "NCDEX",
            KiteExchange::CDS => "CDS",
            KiteExchange::BCD => "BCD",
        })
    }
}

impl<'de> Deserialize<'de> for KiteExchange {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct KiteExchangeVisitor;
        
        impl<'de> Visitor<'de> for KiteExchangeVisitor {
            type Value = KiteExchange;
            
            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a string representing a Kite exchange")
            }
            
            fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                match value {
                    "NSE" => Ok(KiteExchange::NSE),
                    "BSE" => Ok(KiteExchange::BSE),
                    "MCX" => Ok(KiteExchange::MCX),
                    "NCDEX" => Ok(KiteExchange::NCDEX),
                    "CDS" => Ok(KiteExchange::CDS),
                    "BCD" => Ok(KiteExchange::BCD),
                    _ => Err(E::custom(format!("Unknown exchange: {}", value))),
                }
            }
        }
        
        deserializer.deserialize_str(KiteExchangeVisitor)
    }
}

impl FromStr for KiteExchange {
    type Err = String;
    
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "NSE" => Ok(KiteExchange::NSE),
            "BSE" => Ok(KiteExchange::BSE),
            "MCX" => Ok(KiteExchange::MCX),
            "NCDEX" => Ok(KiteExchange::NCDEX),
            "CDS" => Ok(KiteExchange::CDS),
            "BCD" => Ok(KiteExchange::BCD),
            _ => Err(format!("Unknown exchange: {}", s)),
        }
    }
}

impl fmt::Display for KiteExchange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            KiteExchange::NSE => write!(f, "NSE"),
            KiteExchange::BSE => write!(f, "BSE"),
            KiteExchange::MCX => write!(f, "MCX"),
            KiteExchange::NCDEX => write!(f, "NCDEX"),
            KiteExchange::CDS => write!(f, "CDS"),
            KiteExchange::BCD => write!(f, "BCD"),
        }
    }
}

/// Kite order status enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum KiteOrderStatus {
    /// Complete
    Complete,
    
    /// Rejected
    Rejected,
    
    /// Cancelled
    Cancelled,
    
    /// Pending
    Pending,
    
    /// Put order request
    PutOrderRequest,
    
    /// Modify validation pending
    ModifyValidationPending,
    
    /// Trigger pending
    TriggerPending,
    
    /// Open
    Open,
    
    /// Validation pending
    ValidationPending,
    
    /// Modify pending
    ModifyPending,
    
    /// Convert pending
    ConvertPending,
    
    /// Uptodate
    Uptodate,
    
    /// Trigger pending
    Triggered,
    
    /// Cancel pending
    CancelPending,
    
    /// AMO req received
    AmoReqReceived,
}

impl Serialize for KiteOrderStatus {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(match self {
            KiteOrderStatus::Complete => "COMPLETE",
            KiteOrderStatus::Rejected => "REJECTED",
            KiteOrderStatus::Cancelled => "CANCELLED",
            KiteOrderStatus::Pending => "PENDING",
            KiteOrderStatus::PutOrderRequest => "PUT ORDER REQUEST",
            KiteOrderStatus::ModifyValidationPending => "MODIFY VALIDATION PENDING",
            KiteOrderStatus::TriggerPending => "TRIGGER PENDING",
            KiteOrderStatus::Open => "OPEN",
            KiteOrderStatus::ValidationPending => "VALIDATION PENDING",
            KiteOrderStatus::ModifyPending => "MODIFY PENDING",
            KiteOrderStatus::ConvertPending => "CONVERT PENDING",
            KiteOrderStatus::Uptodate => "UPTODATE",
            KiteOrderStatus::Triggered => "TRIGGERED",
            KiteOrderStatus::CancelPending => "CANCEL PENDING",
            KiteOrderStatus::AmoReqReceived => "AMO REQ RECEIVED",
        })
    }
}

impl<'de> Deserialize<'de> for KiteOrderStatus {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct KiteOrderStatusVisitor;
        
        impl<'de> Visitor<'de> for KiteOrderStatusVisitor {
            type Value = KiteOrderStatus;
            
            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a string representing a Kite order status")
            }
            
            fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                match value {
                    "COMPLETE" => Ok(KiteOrderStatus::Complete),
                    "REJECTED" => Ok(KiteOrderStatus::Rejected),
                    "CANCELLED" => Ok(KiteOrderStatus::Cancelled),
                    "PENDING" => Ok(KiteOrderStatus::Pending),
                    "PUT ORDER REQUEST" => Ok(KiteOrderStatus::PutOrderRequest),
                    "MODIFY VALIDATION PENDING" => Ok(KiteOrderStatus::ModifyValidationPending),
                    "TRIGGER PENDING" => Ok(KiteOrderStatus::TriggerPending),
                    "OPEN" => Ok(KiteOrderStatus::Open),
                    "VALIDATION PENDING" => Ok(KiteOrderStatus::ValidationPending),
                    "MODIFY PENDING" => Ok(KiteOrderStatus::ModifyPending),
                    "CONVERT PENDING" => Ok(KiteOrderStatus::ConvertPending),
                    "UPTODATE" => Ok(KiteOrderStatus::Uptodate),
                    "TRIGGERED" => Ok(KiteOrderStatus::Triggered),
                    "CANCEL PENDING" => Ok(KiteOrderStatus::CancelPending),
                    "AMO REQ RECEIVED" => Ok(KiteOrderStatus::AmoReqReceived),
                    _ => Err(E::custom(format!("Unknown order status: {}", value))),
                }
            }
        }
        
        deserializer.deserialize_str(KiteOrderStatusVisitor)
    }
}

/// Kite order type enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum KiteOrderType {
    /// Market order
    Market,
    
    /// Limit order
    Limit,
    
    /// Stop loss order
    StopLoss,
    
    /// Stop loss market order
    StopLossMarket,
}

impl Serialize for KiteOrderType {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(match self {
            KiteOrderType::Market => "MARKET",
            KiteOrderType::Limit => "LIMIT",
            KiteOrderType::StopLoss => "SL",
            KiteOrderType::StopLossMarket => "SL-M",
        })
    }
}

impl<'de> Deserialize<'de> for KiteOrderType {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct KiteOrderTypeVisitor;
        
        impl<'de> Visitor<'de> for KiteOrderTypeVisitor {
            type Value = KiteOrderType;
            
            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a string representing a Kite order type")
            }
            
            fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                match value {
                    "MARKET" => Ok(KiteOrderType::Market),
                    "LIMIT" => Ok(KiteOrderType::Limit),
                    "SL" => Ok(KiteOrderType::StopLoss),
                    "SL-M" => Ok(KiteOrderType::StopLossMarket),
                    _ => Err(E::custom(format!("Unknown order type: {}", value))),
                }
            }
        }
        
        deserializer.deserialize_str(KiteOrderTypeVisitor)
    }
}

/// Kite product enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum KiteProduct {
    /// Cash and carry
    CNC,
    
    /// Intraday
    MIS,
    
    /// Normal
    NRML,
    
    /// Cover order
    CO,
    
    /// Bracket order
    BO,
}

impl Serialize for KiteProduct {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(match self {
            KiteProduct::CNC => "CNC",
            KiteProduct::MIS => "MIS",
            KiteProduct::NRML => "NRML",
            KiteProduct::CO => "CO",
            KiteProduct::BO => "BO",
        })
    }
}

impl<'de> Deserialize<'de> for KiteProduct {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct KiteProductVisitor;
        
        impl<'de> Visitor<'de> for KiteProductVisitor {
            type Value = KiteProduct;
            
            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a string representing a Kite product")
            }
            
            fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                match value {
                    "CNC" => Ok(KiteProduct::CNC),
                    "MIS" => Ok(KiteProduct::MIS),
                    "NRML" => Ok(KiteProduct::NRML),
                    "CO" => Ok(KiteProduct::CO),
                    "BO" => Ok(KiteProduct::BO),
                    _ => Err(E::custom(format!("Unknown product: {}", value))),
                }
            }
        }
        
        deserializer.deserialize_str(KiteProductVisitor)
    }
}

/// Kite validity enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum KiteValidity {
    /// Day
    Day,
    
    /// Immediate or cancel
    IOC,
    
    /// Good till triggered
    TTL,
}

impl Serialize for KiteValidity {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(match self {
            KiteValidity::Day => "DAY",
            KiteValidity::IOC => "IOC",
            KiteValidity::TTL => "TTL",
        })
    }
}

impl<'de> Deserialize<'de> for KiteValidity {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct KiteValidityVisitor;
        
        impl<'de> Visitor<'de> for KiteValidityVisitor {
            type Value = KiteValidity;
            
            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a string representing a Kite validity")
            }
            
            fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                match value {
                    "DAY" => Ok(KiteValidity::Day),
                    "IOC" => Ok(KiteValidity::IOC),
                    "TTL" => Ok(KiteValidity::TTL),
                    _ => Err(E::custom(format!("Unknown validity: {}", value))),
                }
            }
        }
        
        deserializer.deserialize_str(KiteValidityVisitor)
    }
}

/// Kite transaction type enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum KiteTransactionType {
    /// Buy
    Buy,
    
    /// Sell
    Sell,
}

impl Serialize for KiteTransactionType {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(match self {
            KiteTransactionType::Buy => "BUY",
            KiteTransactionType::Sell => "SELL",
        })
    }
}

impl<'de> Deserialize<'de> for KiteTransactionType {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct KiteTransactionTypeVisitor;
        
        impl<'de> Visitor<'de> for KiteTransactionTypeVisitor {
            type Value = KiteTransactionType;
            
            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a string representing a Kite transaction type")
            }
            
            fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                match value {
                    "BUY" => Ok(KiteTransactionType::Buy),
                    "SELL" => Ok(KiteTransactionType::Sell),
                    _ => Err(E::custom(format!("Unknown transaction type: {}", value))),
                }
            }
        }
        
        deserializer.deserialize_str(KiteTransactionTypeVisitor)
    }
}

/// Kite order variety enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum KiteOrderVariety {
    /// Regular order
    Regular,
    
    /// Cover order
    CO,
    
    /// Bracket order
    BO,
    
    /// After market order
    AMO,
}

impl fmt::Display for KiteOrderVariety {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            KiteOrderVariety::Regular => write!(f, "regular"),
            KiteOrderVariety::CO => write!(f, "co"),
            KiteOrderVariety::BO => write!(f, "bo"),
            KiteOrderVariety::AMO => write!(f, "amo"),
        }
    }
}

impl Serialize for KiteOrderVariety {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(match self {
            KiteOrderVariety::Regular => "regular",
            KiteOrderVariety::CO => "co",
            KiteOrderVariety::BO => "bo",
            KiteOrderVariety::AMO => "amo",
        })
    }
}

impl<'de> Deserialize<'de> for KiteOrderVariety {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct KiteOrderVarietyVisitor;
        
        impl<'de> Visitor<'de> for KiteOrderVarietyVisitor {
            type Value = KiteOrderVariety;
            
            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a string representing a Kite order variety")
            }
            
            fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                match value {
                    "regular" => Ok(KiteOrderVariety::Regular),
                    "co" => Ok(KiteOrderVariety::CO),
                    "bo" => Ok(KiteOrderVariety::BO),
                    "amo" => Ok(KiteOrderVariety::AMO),
                    _ => Err(E::custom(format!("Unknown order variety: {}", value))),
                }
            }
        }
        
        deserializer.deserialize_str(KiteOrderVarietyVisitor)
    }
}

/// Kite trigger type enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum KiteTriggerType {
    /// Percent
    Percent,
    
    /// Ticks
    Ticks,
    
    /// Absolute
    Absolute,
}

impl Serialize for KiteTriggerType {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(match self {
            KiteTriggerType::Percent => "percent",
            KiteTriggerType::Ticks => "ticks",
            KiteTriggerType::Absolute => "absolute",
        })
    }
}

impl<'de> Deserialize<'de> for KiteTriggerType {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct KiteTriggerTypeVisitor;
        
        impl<'de> Visitor<'de> for KiteTriggerTypeVisitor {
            type Value = KiteTriggerType;
            
            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a string representing a Kite trigger type")
            }
            
            fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                match value {
                    "percent" => Ok(KiteTriggerType::Percent),
                    "ticks" => Ok(KiteTriggerType::Ticks),
                    "absolute" => Ok(KiteTriggerType::Absolute),
                    _ => Err(E::custom(format!("Unknown trigger type: {}", value))),
                }
            }
        }
        
        deserializer.deserialize_str(KiteTriggerTypeVisitor)
    }
}

/// Kite interval enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum KiteInterval {
    /// 1 minute
    Minute1,
    
    /// 3 minutes
    Minute3,
    
    /// 5 minutes
    Minute5,
    
    /// 10 minutes
    Minute10,
    
    /// 15 minutes
    Minute15,
    
    /// 30 minutes
    Minute30,
    
    /// 60 minutes
    Minute60,
    
    /// 1 day
    Day1,
}

impl Serialize for KiteInterval {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(match self {
            KiteInterval::Minute1 => "minute",
            KiteInterval::Minute3 => "3minute",
            KiteInterval::Minute5 => "5minute",
            KiteInterval::Minute10 => "10minute",
            KiteInterval::Minute15 => "15minute",
            KiteInterval::Minute30 => "30minute",
            KiteInterval::Minute60 => "60minute",
            KiteInterval::Day1 => "day",
        })
    }
}

impl<'de> Deserialize<'de> for KiteInterval {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct KiteIntervalVisitor;
        
        impl<'de> Visitor<'de> for KiteIntervalVisitor {
            type Value = KiteInterval;
            
            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a string representing a Kite interval")
            }
            
            fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                match value {
                    "minute" => Ok(KiteInterval::Minute1),
                    "3minute" => Ok(KiteInterval::Minute3),
                    "5minute" => Ok(KiteInterval::Minute5),
                    "10minute" => Ok(KiteInterval::Minute10),
                    "15minute" => Ok(KiteInterval::Minute15),
                    "30minute" => Ok(KiteInterval::Minute30),
                    "60minute" => Ok(KiteInterval::Minute60),
                    "day" => Ok(KiteInterval::Day1),
                    _ => Err(E::custom(format!("Unknown interval: {}", value))),
                }
            }
        }
        
        deserializer.deserialize_str(KiteIntervalVisitor)
    }
}

impl fmt::Display for KiteInterval {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            KiteInterval::Minute1 => write!(f, "minute"),
            KiteInterval::Minute3 => write!(f, "3minute"),
            KiteInterval::Minute5 => write!(f, "5minute"),
            KiteInterval::Minute10 => write!(f, "10minute"),
            KiteInterval::Minute15 => write!(f, "15minute"),
            KiteInterval::Minute30 => write!(f, "30minute"),
            KiteInterval::Minute60 => write!(f, "60minute"),
            KiteInterval::Day1 => write!(f, "day"),
        }
    }
}

/// Kite disclosed quantity
#[derive(Debug, Clone, Copy)]
pub struct KiteDiscloseQuantity(u32);

impl KiteDiscloseQuantity {
    /// Create a new disclosed quantity
    pub fn new(quantity: u32) -> Self {
        Self(quantity)
    }
    
    /// Get the quantity
    pub fn get(&self) -> u32 {
        self.0
    }
}

impl Serialize for KiteDiscloseQuantity {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_u32(self.0)
    }
}

impl<'de> Deserialize<'de> for KiteDiscloseQuantity {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct KiteDiscloseQuantityVisitor;
        
        impl<'de> Visitor<'de> for KiteDiscloseQuantityVisitor {
            type Value = KiteDiscloseQuantity;
            
            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a number representing a Kite disclosed quantity")
            }
            
            fn visit_u64<E>(self, value: u64) -> Result<Self::Value, E>
            where
                E: de::Error,
            {
                if value <= u32::MAX as u64 {
                    Ok(KiteDiscloseQuantity(value as u32))
                } else {
                    Err(E::custom(format!("Disclosed quantity too large: {}", value)))
                }
            }
        }
        
        deserializer.deserialize_u64(KiteDiscloseQuantityVisitor)
    }
}