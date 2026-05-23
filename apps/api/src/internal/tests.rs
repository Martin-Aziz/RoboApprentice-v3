//! Integration tests for the internal ML callback endpoints.

use axum::body::Body;
use axum::http;
use serde_json::json;
use uuid::Uuid;

use crate::tests::{
    build_test_app, build_test_state, create_facility, create_skill, json_body, patch_json,
    register_user, send, status,
};

#[sqlx::test(migrations = "../../migrations")]
async fn test_update_demonstration_success(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let secret = state.config.internal_api_secret.clone();

    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let fid = create_facility(build_test_app(state.clone()), &token, "Plant A").await;
    let sid = create_skill(build_test_app(state.clone()), &token, fid).await;

    // Create a demonstration record directly
    let demo_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO demonstrations (id, skill_id, created_at) VALUES ($1, $2, NOW())",
    )
    .bind(demo_id)
    .bind(sid)
    .execute(&state.db)
    .await
    .unwrap();

    let update = json!({
        "voice_transcript": "Pick up the bracket and place it on the fixture.",
        "quality_score": 0.87
    });
    let resp = send(
        build_test_app(state),
        patch_json(
            &format!("/internal/demonstrations/{demo_id}"),
            &update,
            None,
            Some(&secret),
        ),
    )
    .await;

    assert_eq!(status(&resp), 204);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_update_demonstration_missing_secret(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let demo_id = Uuid::new_v4();

    let update = json!({ "voice_transcript": "test" });
    // No x-internal-secret header
    let resp = send(
        build_test_app(state),
        patch_json(&format!("/internal/demonstrations/{demo_id}"), &update, None, None),
    )
    .await;
    assert_eq!(status(&resp), 401);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_update_demonstration_wrong_secret(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let demo_id = Uuid::new_v4();

    let update = json!({ "voice_transcript": "test" });
    let resp = send(
        build_test_app(state),
        patch_json(
            &format!("/internal/demonstrations/{demo_id}"),
            &update,
            None,
            Some("wrong-secret"),
        ),
    )
    .await;
    assert_eq!(status(&resp), 401);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_update_skill_embedding_success(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let secret = state.config.internal_api_secret.clone();

    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let fid = create_facility(build_test_app(state.clone()), &token, "Plant A").await;
    let sid = create_skill(build_test_app(state.clone()), &token, fid).await;

    let embedding: Vec<f64> = (0..384).map(|i| (i as f64) / 384.0).collect();
    let update = json!({ "embedding": embedding });

    let resp = send(
        build_test_app(state.clone()),
        patch_json(
            &format!("/internal/skills/{sid}/embedding"),
            &update,
            None,
            Some(&secret),
        ),
    )
    .await;
    assert_eq!(status(&resp), 204);

    // Verify skill is now 'ready'
    let skill = sqlx::query_as::<_, (String,)>("SELECT status FROM skills WHERE id = $1")
        .bind(sid)
        .fetch_one(&state.db)
        .await
        .unwrap();
    assert_eq!(skill.0, "ready");
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_update_skill_embedding_wrong_dimensions(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let secret = state.config.internal_api_secret.clone();

    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let fid = create_facility(build_test_app(state.clone()), &token, "Plant A").await;
    let sid = create_skill(build_test_app(state.clone()), &token, fid).await;

    // 3-element embedding (wrong)
    let update = json!({ "embedding": [0.1, 0.2, 0.3] });
    let resp = send(
        build_test_app(state),
        patch_json(
            &format!("/internal/skills/{sid}/embedding"),
            &update,
            None,
            Some(&secret),
        ),
    )
    .await;
    assert_eq!(status(&resp), 422);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_internal_endpoint_not_accessible_via_jwt(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let demo_id = Uuid::new_v4();

    // JWT in Authorization header but no internal secret
    let req = axum::http::Request::builder()
        .method(http::Method::PATCH)
        .uri(format!("/internal/demonstrations/{demo_id}"))
        .header(http::header::AUTHORIZATION, format!("Bearer {token}"))
        .header(http::header::CONTENT_TYPE, "application/json")
        .body(Body::from(json!({ "quality_score": 0.9 }).to_string()))
        .unwrap();

    let resp = send(build_test_app(state), req).await;
    assert_eq!(status(&resp), 401);
}
