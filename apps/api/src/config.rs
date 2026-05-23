use std::env;

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub app_env: String,
    pub allowed_origins: Vec<String>,
    pub api_host: String,
    pub api_port: u16,
    pub database_url: String,
    pub database_max_connections: u32,
    pub database_min_connections: u32,
    pub redis_url: String,
    pub jwt_private_key_path: String,
    pub jwt_public_key_path: String,
    pub jwt_access_token_expiry_minutes: u64,
    pub jwt_refresh_token_expiry_days: u64,
    pub s3_endpoint: String,
    pub s3_region: String,
    pub s3_bucket: String,
    pub s3_access_key_id: String,
    pub s3_secret_access_key: String,
    pub ml_service_url: String,
    pub max_upload_bytes: usize,
    pub internal_api_secret: String,
    pub rate_limit_requests: u64,
    pub rate_limit_window_seconds: u64,
}

impl AppConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        let allowed_origins = env::var("ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:3000".into())
            .split(',')
            .map(|s| s.trim().to_string())
            .collect();

        Ok(Self {
            app_env: env::var("APP_ENV").unwrap_or_else(|_| "development".into()),
            allowed_origins,
            api_host: env::var("API_HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            api_port: env::var("API_PORT")
                .unwrap_or_else(|_| "8080".into())
                .parse()?,
            database_url: env::var("DATABASE_URL")?,
            database_max_connections: env::var("DATABASE_MAX_CONNECTIONS")
                .unwrap_or_else(|_| "10".into())
                .parse()?,
            database_min_connections: env::var("DATABASE_MIN_CONNECTIONS")
                .unwrap_or_else(|_| "2".into())
                .parse()?,
            redis_url: env::var("REDIS_URL")?,
            jwt_private_key_path: env::var("JWT_PRIVATE_KEY_PATH")
                .unwrap_or_else(|_| "keys/jwt_private.pem".into()),
            jwt_public_key_path: env::var("JWT_PUBLIC_KEY_PATH")
                .unwrap_or_else(|_| "keys/jwt_public.pem".into()),
            jwt_access_token_expiry_minutes: env::var("JWT_ACCESS_TOKEN_EXPIRY_MINUTES")
                .unwrap_or_else(|_| "15".into())
                .parse()?,
            jwt_refresh_token_expiry_days: env::var("JWT_REFRESH_TOKEN_EXPIRY_DAYS")
                .unwrap_or_else(|_| "7".into())
                .parse()?,
            s3_endpoint: env::var("S3_ENDPOINT")?,
            s3_region: env::var("S3_REGION").unwrap_or_else(|_| "us-east-1".into()),
            s3_bucket: env::var("S3_BUCKET")?,
            s3_access_key_id: env::var("S3_ACCESS_KEY_ID")?,
            s3_secret_access_key: env::var("S3_SECRET_ACCESS_KEY")?,
            ml_service_url: env::var("ML_SERVICE_URL")?,
            max_upload_bytes: env::var("MAX_UPLOAD_BYTES")
                .unwrap_or_else(|_| "524288000".into()) // 500 MB
                .parse()?,
            internal_api_secret: env::var("INTERNAL_API_SECRET")?,
            rate_limit_requests: env::var("RATE_LIMIT_REQUESTS")
                .unwrap_or_else(|_| "20".into())
                .parse()?,
            rate_limit_window_seconds: env::var("RATE_LIMIT_WINDOW_SECONDS")
                .unwrap_or_else(|_| "60".into())
                .parse()?,
        })
    }

    pub fn is_production(&self) -> bool {
        self.app_env == "production"
    }
}
