use std::sync::Arc;

use axum::{extract::State, http::StatusCode, response::IntoResponse, routing::get, Json, Router};
use serde::Serialize;

use crate::state::AppState;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    version: &'static str,
}

#[derive(Serialize)]
struct ReadinessResponse {
    status: &'static str,
    database: bool,
    redis: bool,
}

async fn liveness() -> impl IntoResponse {
    Json(HealthResponse {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}

async fn readiness(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let db_ok = crate::db::check_health(&state.db).await;
    let redis_ok = crate::db::check_redis(&state.redis).await;

    let status = if db_ok && redis_ok { "ready" } else { "degraded" };
    let code = if db_ok && redis_ok {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (
        code,
        Json(ReadinessResponse {
            status,
            database: db_ok,
            redis: redis_ok,
        }),
    )
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/health", get(liveness))
        .route("/health/ready", get(readiness))
}
