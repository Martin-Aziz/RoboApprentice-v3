//! Integration tests for the demonstrations upload endpoint.
//!
//! Note: S3 uploads are not tested here (would require a running MinIO).
//! The tests focus on route behaviour, authorization, and validation
//! by using a demonstration upload with no video file — just a transcript.

use axum::body::Body;
use axum::http;

use crate::tests::{
    authed_get, build_test_app, build_test_state, create_facility, create_skill, json_body,
    register_user, send, status,
};

#[sqlx::test(migrations = "../../migrations")]
async fn test_list_demonstrations_empty(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let fid = create_facility(build_test_app(state.clone()), &token, "Plant A").await;
    let sid = create_skill(build_test_app(state.clone()), &token, fid).await;

    let resp = send(
        build_test_app(state),
        authed_get(&format!("/api/v1/skills/{sid}/demonstrations"), &token),
    )
    .await;
    assert_eq!(status(&resp), 200);
    let data = json_body(resp).await;
    assert_eq!(data.as_array().unwrap().len(), 0);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_upload_demonstration_text_only(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let fid = create_facility(build_test_app(state.clone()), &token, "Plant A").await;
    let sid = create_skill(build_test_app(state.clone()), &token, fid).await;

    // Build a multipart body with just a text transcript (no video — avoids S3 call)
    let boundary = "----TestBoundary123";
    let body = format!(
        "--{boundary}\r\nContent-Disposition: form-data; name=\"voice_transcript\"\r\n\r\nPick up the bracket\r\n--{boundary}--\r\n"
    );

    let req = http::Request::builder()
        .method(http::Method::POST)
        .uri(format!("/api/v1/skills/{sid}/demonstrations"))
        .header(http::header::AUTHORIZATION, format!("Bearer {token}"))
        .header(
            http::header::CONTENT_TYPE,
            format!("multipart/form-data; boundary={boundary}"),
        )
        .body(Body::from(body))
        .unwrap();

    let resp = send(build_test_app(state), req).await;
    assert_eq!(status(&resp), 201);
    let data = json_body(resp).await;
    assert_eq!(data["skill_id"].as_str().unwrap(), sid.to_string());
    assert_eq!(data["voice_transcript"], "Pick up the bracket");
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_upload_demonstration_cross_user_forbidden(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token_a, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let (token_b, _) =
        register_user(build_test_app(state.clone()), "bob@example.com", "password123", "Bob").await;
    let fid = create_facility(build_test_app(state.clone()), &token_a, "Plant A").await;
    let sid = create_skill(build_test_app(state.clone()), &token_a, fid).await;

    let boundary = "----TestBoundary456";
    let body = format!(
        "--{boundary}\r\nContent-Disposition: form-data; name=\"voice_transcript\"\r\n\r\ntest\r\n--{boundary}--\r\n"
    );
    let req = http::Request::builder()
        .method(http::Method::POST)
        .uri(format!("/api/v1/skills/{sid}/demonstrations"))
        .header(http::header::AUTHORIZATION, format!("Bearer {token_b}"))
        .header(
            http::header::CONTENT_TYPE,
            format!("multipart/form-data; boundary={boundary}"),
        )
        .body(Body::from(body))
        .unwrap();

    let resp = send(build_test_app(state), req).await;
    assert_eq!(status(&resp), 404);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_upload_demonstration_invalid_video_type(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let fid = create_facility(build_test_app(state.clone()), &token, "Plant A").await;
    let sid = create_skill(build_test_app(state.clone()), &token, fid).await;

    // Upload a file claiming to be text/plain in the video field
    let boundary = "----TestBoundary789";
    let body = format!(
        "--{boundary}\r\nContent-Disposition: form-data; name=\"video\"; filename=\"not-a-video.txt\"\r\nContent-Type: text/plain\r\n\r\nhello world\r\n--{boundary}--\r\n"
    );
    let req = http::Request::builder()
        .method(http::Method::POST)
        .uri(format!("/api/v1/skills/{sid}/demonstrations"))
        .header(http::header::AUTHORIZATION, format!("Bearer {token}"))
        .header(
            http::header::CONTENT_TYPE,
            format!("multipart/form-data; boundary={boundary}"),
        )
        .body(Body::from(body))
        .unwrap();

    let resp = send(build_test_app(state), req).await;
    assert_eq!(status(&resp), 422);
}

#[sqlx::test(migrations = "../../migrations")]
async fn test_upload_demonstration_rejects_transcript_too_long(pool: sqlx::PgPool) {
    let state = build_test_state(pool);
    let (token, _) =
        register_user(build_test_app(state.clone()), "alice@example.com", "password123", "Alice").await;
    let fid = create_facility(build_test_app(state.clone()), &token, "Plant A").await;
    let sid = create_skill(build_test_app(state.clone()), &token, fid).await;

    let oversized_transcript = "x".repeat(10_001);
    let boundary = "----TestBoundaryTranscriptTooLong";
    let body = format!(
        "--{boundary}\r\nContent-Disposition: form-data; name=\"voice_transcript\"\r\n\r\n{oversized_transcript}\r\n--{boundary}--\r\n"
    );

    let req = http::Request::builder()
        .method(http::Method::POST)
        .uri(format!("/api/v1/skills/{sid}/demonstrations"))
        .header(http::header::AUTHORIZATION, format!("Bearer {token}"))
        .header(
            http::header::CONTENT_TYPE,
            format!("multipart/form-data; boundary={boundary}"),
        )
        .body(Body::from(body))
        .unwrap();

    let resp = send(build_test_app(state), req).await;
    assert_eq!(status(&resp), 422);
    let data = json_body(resp).await;
    assert_eq!(data["error"], "Validation error");
    assert!(data["details"]
        .as_str()
        .unwrap_or_default()
        .contains("Transcript too long"));
}
