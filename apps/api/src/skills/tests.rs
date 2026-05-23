//! Integration tests for skills endpoints.

use axum::body::Body;
use axum::http;
use serde_json::json;
use uuid::Uuid;

use crate::tests::{
    authed_delete, authed_get, build_test_app, build_test_state, create_facility, create_skill,
    json_body, patch_json, post_json, register_user, send, status,
};

#[sqlx::test(migrations = "../../migrations")]
async fn test_create_skill(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let fid = create_facility(build_test_app(state.clone()), &token, "Plant A").await;

    let body = json!({
        "name": "Pick and Place",
        "task_language": "Pick up the bracket from the tray and place it on the fixture"
    });
    let resp = send(
        build_test_app(state),
        post_json(&format!("/api/v1/facilities/{fid}/skills"), &body, Some(&token)),
    )
    .await;

    assert_eq!(status(&resp), 201);
    let data = json_body(resp).await;
    assert_eq!(data["name"], "Pick and Place");
    assert_eq!(data["status"], "draft");
    assert_eq!(data["run_count"], 0);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_list_skills_empty(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let fid = create_facility(build_test_app(state.clone()), &token, "Plant A").await;

    let resp = send(
        build_test_app(state),
        authed_get(&format!("/api/v1/facilities/{fid}/skills"), &token),
    )
    .await;
    assert_eq!(status(&resp), 200);
    let data = json_body(resp).await;
    assert_eq!(data["total"], 0);
    assert_eq!(data["skills"].as_array().unwrap().len(), 0);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_list_skills_with_search(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let fid = create_facility(build_test_app(state.clone()), &token, "Plant A").await;

    // Create 2 skills
    let b1 = json!({ "name": "Pick Bracket", "task_language": "pick up bracket" });
    let b2 = json!({ "name": "Insert Screw", "task_language": "insert screw into hole" });
    send(build_test_app(state.clone()), post_json(&format!("/api/v1/facilities/{fid}/skills"), &b1, Some(&token))).await;
    send(build_test_app(state.clone()), post_json(&format!("/api/v1/facilities/{fid}/skills"), &b2, Some(&token))).await;

    // Search for "bracket"
    let resp = send(
        build_test_app(state),
        authed_get(&format!("/api/v1/facilities/{fid}/skills?search=bracket"), &token),
    )
    .await;
    assert_eq!(status(&resp), 200);
    let data = json_body(resp).await;
    assert_eq!(data["total"], 1);
    assert_eq!(data["skills"][0]["name"], "Pick Bracket");
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_get_skill(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let fid = create_facility(build_test_app(state.clone()), &token, "Plant A").await;
    let sid = create_skill(build_test_app(state.clone()), &token, fid).await;

    let resp = send(
        build_test_app(state),
        authed_get(&format!("/api/v1/skills/{sid}"), &token),
    )
    .await;
    assert_eq!(status(&resp), 200);
    let data = json_body(resp).await;
    assert_eq!(data["id"].as_str().unwrap(), sid.to_string());
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_soft_delete_skill(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let fid = create_facility(build_test_app(state.clone()), &token, "Plant A").await;
    let sid = create_skill(build_test_app(state.clone()), &token, fid).await;

    // Delete (soft)
    let resp = send(
        build_test_app(state.clone()),
        authed_delete(&format!("/api/v1/skills/{sid}"), &token),
    )
    .await;
    assert_eq!(status(&resp), 204);

    // Should no longer appear in list
    let list_resp = send(
        build_test_app(state),
        authed_get(&format!("/api/v1/facilities/{fid}/skills"), &token),
    )
    .await;
    let data = json_body(list_resp).await;
    assert_eq!(data["total"], 0);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_update_skill(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let fid = create_facility(build_test_app(state.clone()), &token, "Plant A").await;
    let sid = create_skill(build_test_app(state.clone()), &token, fid).await;

    let update = json!({ "name": "Updated Skill Name" });
    let resp = send(
        build_test_app(state),
        patch_json(&format!("/api/v1/skills/{sid}"), &update, Some(&token), None),
    )
    .await;
    assert_eq!(status(&resp), 200);
    let data = json_body(resp).await;
    assert_eq!(data["name"], "Updated Skill Name");
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_cross_user_skill_access_forbidden(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token_a, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let (token_b, _) =
        register_user(build_test_app(state.clone()), "bob@example.com", "password123", "Bob").await;
    let fid = create_facility(build_test_app(state.clone()), &token_a, "Alice's Plant").await;
    let sid = create_skill(build_test_app(state.clone()), &token_a, fid).await;

    // Bob tries to access Alice's skill
    let resp = send(
        build_test_app(state),
        authed_get(&format!("/api/v1/skills/{sid}"), &token_b),
    )
    .await;
    assert_eq!(status(&resp), 404);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_skill_pagination(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let fid = create_facility(build_test_app(state.clone()), &token, "Plant A").await;

    // Create 5 skills
    for i in 0..5 {
        let b = json!({
            "name": format!("Skill {i}"),
            "task_language": format!("task description {i}")
        });
        send(build_test_app(state.clone()), post_json(&format!("/api/v1/facilities/{fid}/skills"), &b, Some(&token))).await;
    }

    // Get first page of 2
    let resp = send(
        build_test_app(state),
        authed_get(&format!("/api/v1/facilities/{fid}/skills?limit=2&offset=0"), &token),
    )
    .await;
    let data = json_body(resp).await;
    assert_eq!(data["total"], 5);
    assert_eq!(data["skills"].as_array().unwrap().len(), 2);
}
