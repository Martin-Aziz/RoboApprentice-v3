//! Test helpers shared across all integration test modules.
//!
//! Uses `tower::ServiceExt::oneshot` to call the router directly without
//! binding a network socket — fast, isolated, no port conflicts.

use std::sync::Arc;

use axum::Router;
use axum::body::Body;
use axum::http::{self, Request, Response};
use axum::response::IntoResponse;
use http_body_util::BodyExt;
use serde_json::Value;
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

use crate::config::AppConfig;
use crate::state::AppState;

/// Build a test `AppState` backed by the provided pool.
///
/// Uses the bundled dev RSA keys (keys/jwt_private.pem / jwt_public.pem) so
/// tests can sign and verify tokens without needing real key files on disk.
pub fn build_test_state(pool: PgPool) -> Arc<AppState> {
    let config = test_config();
    let redis = redis::Client::open(config.redis_url.clone()).expect("test redis client");
    Arc::new(AppState::new(pool, redis, config))
}

pub fn test_config() -> AppConfig {
    AppConfig {
        app_env: "test".into(),
        allowed_origins: vec!["http://localhost:3000".into()],
        api_host: "127.0.0.1".into(),
        api_port: 0,
        database_url: std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://forge_mind:forge_mind_pass@localhost:5432/forge_mind_test".into()),
        database_max_connections: 5,
        database_min_connections: 1,
        redis_url: std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into()),
        jwt_private_key_path: "keys/jwt_private.pem".into(),
        jwt_public_key_path: "keys/jwt_public.pem".into(),
        jwt_access_token_expiry_minutes: 15,
        jwt_refresh_token_expiry_days: 7,
        s3_endpoint: "http://localhost:9000".into(),
        s3_region: "us-east-1".into(),
        s3_bucket: "forge-mind-test".into(),
        s3_access_key_id: "minioadmin".into(),
        s3_secret_access_key: "minioadmin".into(),
        ml_service_url: "http://localhost:8001".into(),
        max_upload_bytes: 10 * 1024 * 1024, // 10 MB in tests
        internal_api_secret: "test-internal-secret".into(),
        rate_limit_requests: 1000, // High limit so tests don't hit it
        rate_limit_window_seconds: 60,
    }
}

/// Build the full application router for testing.
pub fn build_test_app(state: Arc<AppState>) -> Router {
    use crate::{auth, demonstrations, facilities, health, internal, robots, skills};
    use tower_http::cors::CorsLayer;

    Router::new()
        .merge(health::router())
        .nest("/api/v1", {
            Router::new()
                .merge(auth::router())
                .merge(facilities::router())
                .merge(robots::router())
                .merge(skills::router())
                .merge(demonstrations::router())
        })
        .nest("/internal", internal::router())
        .layer(CorsLayer::permissive())
        .with_state(state)
}

/// Send a request to the test app and return the response.
pub async fn send(app: Router, req: Request<Body>) -> Response<Body> {
    app.oneshot(req).await.unwrap()
}

/// Parse a JSON response body.
pub async fn json_body(resp: Response<Body>) -> Value {
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).expect("response body is not JSON")
}

/// Read just the status code from a response (consuming it).
pub fn status(resp: &Response<Body>) -> u16 {
    resp.status().as_u16()
}

/// Build a GET request with Bearer auth.
pub fn authed_get(path: &str, token: &str) -> Request<Body> {
    Request::builder()
        .uri(path)
        .header(http::header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap()
}

/// Build a POST request with JSON body and optional Bearer auth.
pub fn post_json(path: &str, body: &Value, token: Option<&str>) -> Request<Body> {
    let mut builder = Request::builder()
        .method(http::Method::POST)
        .uri(path)
        .header(http::header::CONTENT_TYPE, "application/json");
    if let Some(t) = token {
        builder = builder.header(http::header::AUTHORIZATION, format!("Bearer {t}"));
    }
    builder.body(Body::from(body.to_string())).unwrap()
}

/// Build a PATCH request with JSON body and optional Bearer / internal-secret auth.
pub fn patch_json(path: &str, body: &Value, token: Option<&str>, internal_secret: Option<&str>) -> Request<Body> {
    let mut builder = Request::builder()
        .method(http::Method::PATCH)
        .uri(path)
        .header(http::header::CONTENT_TYPE, "application/json");
    if let Some(t) = token {
        builder = builder.header(http::header::AUTHORIZATION, format!("Bearer {t}"));
    }
    if let Some(s) = internal_secret {
        builder = builder.header("x-internal-secret", s);
    }
    builder.body(Body::from(body.to_string())).unwrap()
}

/// Build a DELETE request with Bearer auth.
pub fn authed_delete(path: &str, token: &str) -> Request<Body> {
    Request::builder()
        .method(http::Method::DELETE)
        .uri(path)
        .header(http::header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap()
}

/// Register a user and return (access_token, user_id).
pub async fn register_user(
    app: Router,
    email: &str,
    password: &str,
    name: &str,
) -> (String, Uuid) {
    let body = serde_json::json!({ "email": email, "password": password, "name": name });
    let req = post_json("/api/v1/auth/register", &body, None);
    let resp = send(app, req).await;
    assert_eq!(status(&resp), 201, "register failed");
    let data = json_body(resp).await;
    let token = data["access_token"].as_str().unwrap().to_string();
    let user_id: Uuid = data["user"]["id"].as_str().unwrap().parse().unwrap();
    (token, user_id)
}

/// Create a facility and return its ID.
pub async fn create_facility(app: Router, token: &str, name: &str) -> Uuid {
    let body = serde_json::json!({ "name": name });
    let req = post_json("/api/v1/facilities", &body, Some(token));
    let resp = send(app, req).await;
    assert_eq!(status(&resp), 201, "create facility failed");
    let data = json_body(resp).await;
    data["id"].as_str().unwrap().parse().unwrap()
}

/// Create a robot and return its ID.
pub async fn create_robot(app: Router, token: &str, facility_id: Uuid) -> Uuid {
    let body = serde_json::json!({
        "name": "Test Robot",
        "brand": "Universal Robots",
        "model": "UR5e"
    });
    let req = post_json(&format!("/api/v1/facilities/{facility_id}/robots"), &body, Some(token));
    let resp = send(app, req).await;
    assert_eq!(status(&resp), 201, "create robot failed");
    let data = json_body(resp).await;
    data["id"].as_str().unwrap().parse().unwrap()
}

/// Create a skill and return its ID.
pub async fn create_skill(app: Router, token: &str, facility_id: Uuid) -> Uuid {
    let body = serde_json::json!({
        "name": "Pick and Place",
        "task_language": "Pick up the bracket from the tray and place it on the fixture"
    });
    let req = post_json(&format!("/api/v1/facilities/{facility_id}/skills"), &body, Some(token));
    let resp = send(app, req).await;
    assert_eq!(status(&resp), 201, "create skill failed");
    let data = json_body(resp).await;
    data["id"].as_str().unwrap().parse().unwrap()
}
