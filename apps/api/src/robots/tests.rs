//! Integration tests for robots endpoints.

use axum::body::Body;
use axum::http;
use serde_json::json;
use uuid::Uuid;

use crate::tests::{
    authed_get, build_test_app, build_test_state, create_facility, create_robot, json_body,
    patch_json, post_json, register_user, send, status,
};

#[sqlx::test(migrations = "../../migrations")]
async fn test_create_robot(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let fid = create_facility(build_test_app(state.clone()), &token, "Plant A").await;

    let body = json!({
        "name": "UR5e-01",
        "brand": "Universal Robots",
        "model": "UR5e",
        "ip_address": "192.168.1.10"
    });
    let resp = send(
        build_test_app(state),
        post_json(&format!("/api/v1/facilities/{fid}/robots"), &body, Some(&token)),
    )
    .await;

    assert_eq!(status(&resp), 201);
    let data = json_body(resp).await;
    assert_eq!(data["name"], "UR5e-01");
    assert_eq!(data["brand"], "Universal Robots");
    assert_eq!(data["status"], "offline");
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_list_robots_empty(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let fid = create_facility(build_test_app(state.clone()), &token, "Plant A").await;

    let resp = send(
        build_test_app(state),
        authed_get(&format!("/api/v1/facilities/{fid}/robots"), &token),
    )
    .await;
    assert_eq!(status(&resp), 200);
    let data = json_body(resp).await;
    assert_eq!(data.as_array().unwrap().len(), 0);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_estop_robot(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let fid = create_facility(build_test_app(state.clone()), &token, "Plant A").await;
    let rid = create_robot(build_test_app(state.clone()), &token, fid).await;

    // E-stop
    let req = axum::http::Request::builder()
        .method(http::Method::POST)
        .uri(format!("/api/v1/robots/{rid}/estop"))
        .header(http::header::AUTHORIZATION, format!("Bearer {token}"))
        .header(http::header::CONTENT_TYPE, "application/json")
        .body(Body::from("{}"))
        .unwrap();
    let resp = send(build_test_app(state.clone()), req).await;
    assert_eq!(status(&resp), 200);
    let data = json_body(resp).await;
    assert_eq!(data["status"], "offline");
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_get_robot_cross_user_forbidden(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token_a, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let (token_b, _) =
        register_user(build_test_app(state.clone()), "bob@example.com", "password123", "Bob").await;
    let fid = create_facility(build_test_app(state.clone()), &token_a, "Alice's Plant").await;
    let rid = create_robot(build_test_app(state.clone()), &token_a, fid).await;

    // Bob tries to access Alice's robot
    let resp = send(
        build_test_app(state),
        authed_get(&format!("/api/v1/robots/{rid}"), &token_b),
    )
    .await;
    assert_eq!(status(&resp), 404);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_create_robot_wrong_facility(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token_a, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let (token_b, _) =
        register_user(build_test_app(state.clone()), "bob@example.com", "password123", "Bob").await;
    let fid = create_facility(build_test_app(state.clone()), &token_a, "Alice's Plant").await;

    // Bob tries to create a robot in Alice's facility
    let body = json!({
        "name": "Robot",
        "brand": "KUKA",
        "model": "LBR iiwa"
    });
    let resp = send(
        build_test_app(state),
        post_json(&format!("/api/v1/facilities/{fid}/robots"), &body, Some(&token_b)),
    )
    .await;
    assert_eq!(status(&resp), 404);
}
