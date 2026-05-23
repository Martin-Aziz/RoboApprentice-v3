use std::sync::Arc;

use axum::Router;
use axum::http;
use sqlx::postgres::PgPoolOptions;
use tower_http::{
    compression::CompressionLayer,
    cors::CorsLayer,
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

mod auth;
mod config;
mod db;
mod demonstrations;
mod error;
mod facilities;
mod health;
mod internal;
mod robots;
mod skills;
mod state;

#[cfg(test)]
mod tests;

use config::AppConfig;
use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "forge_mind_api=debug,tower_http=debug".into()))
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    let config = AppConfig::from_env()?;

    let pool = PgPoolOptions::new()
        .max_connections(config.database_max_connections)
        .min_connections(config.database_min_connections)
        .connect(&config.database_url)
        .await?;

    sqlx::migrate!("../../migrations").run(&pool).await?;
    tracing::info!("Database migrations applied");

    let redis_client = redis::Client::open(config.redis_url.as_str())?;

    let state = Arc::new(AppState::new(pool, redis_client, config.clone()));

    let cors = build_cors(&config);

    let app = Router::new()
        .merge(health::router())
        .nest("/api/v1", api_routes())
        .nest("/internal", internal::router())
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(cors)
        .with_state(state);

    let addr = format!("{}:{}", config.api_host, config.api_port);
    tracing::info!("FORGE MIND API listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

fn build_cors(config: &AppConfig) -> CorsLayer {
    use axum::http::HeaderValue;
    use tower_http::cors::AllowOrigin;

    let origins: Vec<HeaderValue> = config
        .allowed_origins
        .iter()
        .filter_map(|o| o.parse().ok())
        .collect();

    CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::PATCH,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            http::header::AUTHORIZATION,
            http::header::CONTENT_TYPE,
            http::header::ACCEPT,
            http::header::ORIGIN,
            http::header::HeaderName::from_static("x-requested-with"),
        ])
        .allow_credentials(true)
}

fn api_routes() -> Router<Arc<AppState>> {
    Router::new()
        .merge(auth::router())
        .merge(facilities::router())
        .merge(robots::router())
        .merge(skills::router())
        .merge(demonstrations::router())
}

