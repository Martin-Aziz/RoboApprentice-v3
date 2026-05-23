use sqlx::PgPool;

use crate::config::AppConfig;

pub struct AppState {
    pub db: PgPool,
    pub redis: redis::Client,
    pub config: AppConfig,
    pub jwt_keys: JwtKeys,
}

pub struct JwtKeys {
    pub private_key: Vec<u8>,
    pub public_key: Vec<u8>,
}

impl AppState {
    pub fn new(db: PgPool, redis: redis::Client, config: AppConfig) -> Self {
        let private_key = match std::fs::read(&config.jwt_private_key_path) {
            Ok(k) => k,
            Err(e) => {
                if config.is_production() {
                    panic!(
                        "JWT private key not found at '{}' in production: {e}",
                        config.jwt_private_key_path
                    );
                }
                tracing::warn!(
                    "JWT private key not found at {}, using dev fallback",
                    config.jwt_private_key_path
                );
                include_bytes!("../../../keys/jwt_private.pem").to_vec()
            }
        };
        let public_key = match std::fs::read(&config.jwt_public_key_path) {
            Ok(k) => k,
            Err(e) => {
                if config.is_production() {
                    panic!(
                        "JWT public key not found at '{}' in production: {e}",
                        config.jwt_public_key_path
                    );
                }
                tracing::warn!(
                    "JWT public key not found at {}, using dev fallback",
                    config.jwt_public_key_path
                );
                include_bytes!("../../../keys/jwt_public.pem").to_vec()
            }
        };

        Self {
            db,
            redis,
            config,
            jwt_keys: JwtKeys {
                private_key,
                public_key,
            },
        }
    }

    pub async fn redis_conn(&self) -> Result<redis::aio::MultiplexedConnection, redis::RedisError> {
        self.redis.get_multiplexed_tokio_connection().await
    }
}
