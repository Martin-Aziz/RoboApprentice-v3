//! Integration tests for facilities endpoints.

use axum::http;
use serde_json::json;
use uuid::Uuid;

use crate::tests::{
    authed_delete, authed_get, build_test_app, build_test_state, create_facility, json_body,
    post_json, register_user, send, status,
};

#[sqlx::test(migrations = "../../migrations")]
async fn test_create_facility(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;

    let body = json!({ "name": "Acme Factory A" });
    let resp = send(
        build_test_app(state),
        post_json("/api/v1/facilities", &body, Some(&token)),
    )
    .await;

    assert_eq!(status(&resp), 201);
    let data = json_body(resp).await;
    assert_eq!(data["name"], "Acme Factory A");
    assert!(data["id"].is_string());
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_create_facility_unauthenticated(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let app = build_test_app(state);

    let body = json!({ "name": "Factory" });
    let resp = send(app, post_json("/api/v1/facilities", &body, None)).await;
    assert_eq!(status(&resp), 401);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_list_facilities_empty(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token, _) =
        register_user(build_test_app(state.clone()), "bob@example.com", "password123", "Bob").await;

    let resp = send(
        build_test_app(state),
        authed_get("/api/v1/facilities", &token),
    )
    .await;

    assert_eq!(status(&resp), 200);
    let data = json_body(resp).await;
    assert_eq!(data.as_array().unwrap().len(), 0);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_list_facilities_returns_own_only(pool: sqlx::PgPool) {
    let state = build_test_state(pool);

    let (token_a, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let (token_b, _) =
        register_user(build_test_app(state.clone()), "bob@example.com", "password123", "Bob").await;

    // Alice creates 2 facilities, Bob creates 1
    create_facility(build_test_app(state.clone()), &token_a, "Alice Plant 1").await;
    create_facility(build_test_app(state.clone()), &token_a, "Alice Plant 2").await;
    create_facility(build_test_app(state.clone()), &token_b, "Bob's Factory").await;

    let alice_resp = send(
        build_test_app(state.clone()),
        authed_get("/api/v1/facilities", &token_a),
    )
    .await;
    let alice_data = json_body(alice_resp).await;
    assert_eq!(alice_data.as_array().unwrap().len(), 2);

    let bob_resp = send(
        build_test_app(state),
        authed_get("/api/v1/facilities", &token_b),
    )
    .await;
    let bob_data = json_body(bob_resp).await;
    assert_eq!(bob_data.as_array().unwrap().len(), 1);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_get_facility_not_found(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;

    let unknown_id = Uuid::new_v4();
    let resp = send(
        build_test_app(state),
        authed_get(&format!("/api/v1/facilities/{unknown_id}"), &token),
    )
    .await;
    assert_eq!(status(&resp), 404);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_cross_user_facility_access_forbidden(pool: sqlx::PgPool) {
    let state = build_test_state(pool);

    let (token_a, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let (token_b, _) =
        register_user(build_test_app(state.clone()), "bob@example.com", "password123", "Bob").await;

    // Alice creates a facility
    let facility_id = create_facility(build_test_app(state.clone()), &token_a, "Alice's Plant").await;

    // Bob tries to access it — should get 404 (indistinguishable from not found)
    let resp = send(
        build_test_app(state),
        authed_get(&format!("/api/v1/facilities/{facility_id}"), &token_b),
    )
    .await;
    assert_eq!(status(&resp), 404);
}
