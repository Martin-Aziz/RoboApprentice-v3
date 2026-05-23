//! Integration tests for authentication endpoints.

use axum::body::Body;
use axum::http::{self, Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::json;

use crate::tests::{
    build_test_app, build_test_state, json_body, post_json, register_user, send, status,
};

#[sqlx::test(migrations = "../../migrations")]
async fn test_register_success(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let app = build_test_app(state);

    let body = json!({
        "email": "alice@example.com",
        "password": "password123",
        "name": "Alice"
    });
    let resp = send(app, post_json("/api/v1/auth/register", &body, None)).await;

    assert_eq!(status(&resp), 201);
    let data = json_body(resp).await;
    assert!(data["access_token"].is_string());
    assert_eq!(data["token_type"], "Bearer");
    assert_eq!(data["user"]["email"], "alice@example.com");
    assert_eq!(data["user"]["name"], "Alice");
    assert!(data["user"]["id"].is_string());
    // password_hash must never be returned
    assert!(data["user"]["password_hash"].is_null());
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_register_duplicate_email(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let app = build_test_app(state.clone());

    let body = json!({
        "email": "alice@example.com",
        "password": "password123",
        "name": "Alice"
    });
    // First registration succeeds
    let resp = send(build_test_app(state.clone()), post_json("/api/v1/auth/register", &body, None)).await;
    assert_eq!(status(&resp), 201);

    // Second registration with same email returns 409
    let resp = send(build_test_app(state), post_json("/api/v1/auth/register", &body, None)).await;
    assert_eq!(status(&resp), 409);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_register_invalid_email(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let app = build_test_app(state);

    let body = json!({
        "email": "not-an-email",
        "password": "password123",
        "name": "Alice"
    });
    let resp = send(app, post_json("/api/v1/auth/register", &body, None)).await;
    assert_eq!(status(&resp), 422);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_register_short_password(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let app = build_test_app(state);

    let body = json!({
        "email": "alice@example.com",
        "password": "short",
        "name": "Alice"
    });
    let resp = send(app, post_json("/api/v1/auth/register", &body, None)).await;
    assert_eq!(status(&resp), 422);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_login_success(pool: sqlx::PgPool) {
    let state = build_test_state(pool);

    // Register first
    let (_, _) = register_user(
        build_test_app(state.clone()),
        "bob@example.com",
        "password123",
        "Bob",
    )
    .await;

    // Login
    let body = json!({ "email": "bob@example.com", "password": "password123" });
    let resp = send(
        build_test_app(state),
        post_json("/api/v1/auth/login", &body, None),
    )
    .await;

    assert_eq!(status(&resp), 200);
    // refresh_token cookie should be set
    let cookie_header = resp.headers().get(http::header::SET_COOKIE);
    assert!(cookie_header.is_some(), "Set-Cookie header should be present");
    let cookie_val = cookie_header.unwrap().to_str().unwrap();
    assert!(cookie_val.contains("refresh_token"), "cookie should be refresh_token");
    assert!(cookie_val.contains("HttpOnly"), "cookie should be HttpOnly");

    let data = json_body(resp).await;
    assert!(data["access_token"].is_string());
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_login_wrong_password(pool: sqlx::PgPool) {
    let state = build_test_state(pool);

    register_user(
        build_test_app(state.clone()),
        "carol@example.com",
        "correctpass",
        "Carol",
    )
    .await;

    let body = json!({ "email": "carol@example.com", "password": "wrongpassword" });
    let resp = send(
        build_test_app(state),
        post_json("/api/v1/auth/login", &body, None),
    )
    .await;
    assert_eq!(status(&resp), 401);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_login_unknown_email(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let app = build_test_app(state);

    let body = json!({ "email": "nobody@example.com", "password": "password123" });
    let resp = send(app, post_json("/api/v1/auth/login", &body, None)).await;
    assert_eq!(status(&resp), 401);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_missing_auth_header_returns_401(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let app = build_test_app(state);

    // Any protected route without auth
    let req = Request::builder()
        .uri("/api/v1/facilities")
        .body(Body::empty())
        .unwrap();
    let resp = send(app, req).await;
    assert_eq!(status(&resp), 401);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_invalid_jwt_returns_401(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let app = build_test_app(state);

    let req = Request::builder()
        .uri("/api/v1/facilities")
        .header(http::header::AUTHORIZATION, "Bearer this.is.invalid")
        .body(Body::empty())
        .unwrap();
    let resp = send(app, req).await;
    assert_eq!(status(&resp), 401);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_logout_clears_cookie(pool: sqlx::PgPool) {
    let state = build_test_state(pool);

    register_user(
        build_test_app(state.clone()),
        "dave@example.com",
        "password123",
        "Dave",
    )
    .await;

    // Login to get refresh cookie
    let login_body = json!({ "email": "dave@example.com", "password": "password123" });
    let login_resp = send(
        build_test_app(state.clone()),
        post_json("/api/v1/auth/login", &login_body, None),
    )
    .await;
    assert_eq!(status(&login_resp), 200);

    let refresh_cookie = login_resp
        .headers()
        .get(http::header::SET_COOKIE)
        .unwrap()
        .to_str()
        .unwrap()
        .to_string();
    let token_value = refresh_cookie
        .split(';')
        .next()
        .unwrap()
        .split('=')
        .nth(1)
        .unwrap()
        .to_string();

    // Logout
    let logout_req = Request::builder()
        .method(http::Method::POST)
        .uri("/api/v1/auth/logout")
        .header(http::header::COOKIE, format!("refresh_token={token_value}"))
        .body(Body::empty())
        .unwrap();
    let logout_resp = send(build_test_app(state), logout_req).await;
    assert_eq!(status(&logout_resp), 204);
}
