use std::sync::Arc;

use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    routing::post,
    Json, Router,
};
use uuid::Uuid;

use crate::auth::models::AuthUser;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

use super::models::Demonstration;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/skills/:skill_id/demonstrations", post(upload_demonstration).get(list_demonstrations))
}

const DEFAULT_VIDEO_FILENAME: &str = "demo.webm";
const MAX_TRANSCRIPT_CHARS: usize = 10_000;
const REDIS_ENQUEUE_TIMEOUT_MS: u64 = 250;

const ALLOWED_VIDEO_CONTENT_TYPES: &[&str] = &[
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",
    "video/mpeg",
    "video/ogg",
    "application/octet-stream", // some browsers send this for video
];

async fn upload_demonstration(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(skill_id): Path<Uuid>,
    mut multipart: Multipart,
) -> AppResult<(StatusCode, Json<Demonstration>)> {
    verify_skill_ownership(&state, skill_id, user.user_id).await?;

    let mut video_data: Option<Vec<u8>> = None;
    let mut voice_transcript: Option<String> = None;
    let mut source_robot_id: Option<Uuid> = None;
    let mut filename = String::from(DEFAULT_VIDEO_FILENAME);

    while let Some(field) = multipart.next_field().await.map_err(|e| AppError::Validation(e.to_string()))? {
        let field_name = field.name().unwrap_or("").to_string();
        match field_name.as_str() {
            "video" => {
                // Validate content type
                let content_type = field
                    .content_type()
                    .unwrap_or("application/octet-stream")
                    .to_string();

                let is_allowed = ALLOWED_VIDEO_CONTENT_TYPES.iter().any(|&ct| content_type.starts_with(ct));
                if !is_allowed {
                    return Err(AppError::Validation(format!(
                        "Unsupported media type '{}'. Only video files are accepted.",
                        content_type
                    )));
                }

                if let Some(name) = field.file_name() {
                    filename = sanitize_filename(name);
                }

                let bytes = field
                    .bytes()
                    .await
                    .map_err(|e| AppError::Validation(format!("Failed to read video: {e}")))?;

                if bytes.len() > state.config.max_upload_bytes {
                    return Err(AppError::Validation(format!(
                        "File too large. Maximum size is {} bytes.",
                        state.config.max_upload_bytes
                    )));
                }

                video_data = Some(bytes.to_vec());
            }
            "voice_transcript" => {
                let transcript = field
                    .text()
                    .await
                    .map_err(|e| AppError::Validation(format!("Failed to read transcript: {e}")))?;

                if transcript.chars().count() > MAX_TRANSCRIPT_CHARS {
                    return Err(AppError::Validation(format!(
                        "Transcript too long. Maximum length is {} characters.",
                        MAX_TRANSCRIPT_CHARS
                    )));
                }

                voice_transcript = Some(transcript);
            }
            "source_robot_id" => {
                let text = field
                    .text()
                    .await
                    .map_err(|e| AppError::Validation(format!("Failed to read robot_id: {e}")))?;
                source_robot_id = Some(
                    Uuid::parse_str(&text)
                        .map_err(|_| AppError::Validation("Invalid robot_id UUID".into()))?,
                );
            }
            _ => {}
        }
    }

    let demo_id = Uuid::new_v4();
    let video_path = if let Some(data) = video_data {
        let key = build_s3_object_key(skill_id, demo_id, &filename);
        upload_to_s3(&state, &key, &data).await?;
        Some(key)
    } else {
        None
    };

    let demonstration = sqlx::query_as::<_, Demonstration>(
        r#"
        INSERT INTO demonstrations (id, skill_id, video_path, voice_transcript, source_robot_id, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, skill_id, video_path, voice_transcript, source_robot_id, quality_score, created_at
        "#,
    )
    .bind(demo_id)
    .bind(skill_id)
    .bind(&video_path)
    .bind(&voice_transcript)
    .bind(source_robot_id)
    .fetch_one(&state.db)
    .await?;

    // Enqueue ML processing via Redis
    let timeout = std::time::Duration::from_millis(REDIS_ENQUEUE_TIMEOUT_MS);
    match tokio::time::timeout(timeout, state.redis_conn()).await {
        Ok(Ok(mut conn)) => {
            let job = serde_json::json!({
                "demonstration_id": demo_id,
                "skill_id": skill_id,
                "video_path": video_path,
                "voice_transcript": voice_transcript,
            });

            match tokio::time::timeout(
                timeout,
                redis::cmd("LPUSH")
                    .arg("queue:demonstration:process")
                    .arg(job.to_string())
                    .query_async::<_, i64>(&mut conn),
            )
            .await
            {
                Ok(Ok(_)) => {}
                Ok(Err(err)) => {
                    tracing::warn!(error = %err, demo_id = %demonstration.id, "Failed to enqueue ML processing job");
                }
                Err(_) => {
                    tracing::warn!(demo_id = %demonstration.id, "Timed out while enqueueing ML processing job");
                }
            }
        }
        Ok(Err(err)) => {
            tracing::warn!(error = %err, demo_id = %demonstration.id, "Failed to acquire Redis connection for ML enqueue");
        }
        Err(_) => {
            tracing::warn!(demo_id = %demonstration.id, "Timed out acquiring Redis connection for ML enqueue");
        }
    }

    tracing::info!(
        demo_id = %demonstration.id,
        skill_id = %skill_id,
        has_video = video_path.is_some(),
        "Demonstration uploaded"
    );

    Ok((StatusCode::CREATED, Json(demonstration)))
}

async fn list_demonstrations(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(skill_id): Path<Uuid>,
) -> AppResult<Json<Vec<Demonstration>>> {
    verify_skill_ownership(&state, skill_id, user.user_id).await?;

    let demos = sqlx::query_as::<_, Demonstration>(
        r#"
        SELECT id, skill_id, video_path, voice_transcript, source_robot_id, quality_score, created_at
        FROM demonstrations
        WHERE skill_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(skill_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(demos))
}

async fn upload_to_s3(state: &AppState, key: &str, data: &[u8]) -> AppResult<()> {
    let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .endpoint_url(&state.config.s3_endpoint)
        .region(aws_config::Region::new(state.config.s3_region.clone()))
        .credentials_provider(aws_sdk_s3::config::Credentials::new(
            &state.config.s3_access_key_id,
            &state.config.s3_secret_access_key,
            None,
            None,
            "forge-mind",
        ))
        .load()
        .await;

    let s3_config = aws_sdk_s3::config::Builder::from(&config)
        .force_path_style(true)
        .build();
    let client = aws_sdk_s3::Client::from_conf(s3_config);

    client
        .put_object()
        .bucket(&state.config.s3_bucket)
        .key(key)
        .body(data.to_vec().into())
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("S3 upload failed: {e}")))?;

    Ok(())
}

async fn verify_skill_ownership(state: &Arc<AppState>, skill_id: Uuid, user_id: Uuid) -> AppResult<()> {
    let exists = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM skills s
            JOIN facilities f ON s.facility_id = f.id
            WHERE s.id = $1 AND f.owner_id = $2
        )
        "#,
    )
    .bind(skill_id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    if !exists {
        return Err(AppError::NotFound("Skill".into()));
    }

    Ok(())
}

fn sanitize_filename(raw_filename: &str) -> String {
    let mut out = String::with_capacity(raw_filename.len());
    for ch in raw_filename.chars() {
        if ch.is_ascii_alphanumeric() || ch == '.' || ch == '_' || ch == '-' {
            out.push(ch);
        } else {
            out.push('_');
        }
    }

    let trimmed = out.trim_matches(|ch| ch == '_' || ch == '.');
    if trimmed.is_empty() {
        return DEFAULT_VIDEO_FILENAME.to_string();
    }

    if trimmed.len() > 120 {
        return trimmed[..120].to_string();
    }

    trimmed.to_string()
}

fn build_s3_object_key(skill_id: Uuid, demo_id: Uuid, filename: &str) -> String {
    format!("demonstrations/{skill_id}/{demo_id}/{filename}")
}

#[cfg(test)]
mod unit_tests {
    use uuid::Uuid;

    use super::{build_s3_object_key, sanitize_filename, DEFAULT_VIDEO_FILENAME};

    #[test]
    fn sanitize_filename_replaces_path_separators_and_spaces() {
        let sanitized = sanitize_filename("../folder/robot demo.mp4");
        assert_eq!(sanitized, "folder_robot_demo.mp4");
    }

    #[test]
    fn sanitize_filename_falls_back_when_empty_after_cleaning() {
        let sanitized = sanitize_filename("...////");
        assert_eq!(sanitized, DEFAULT_VIDEO_FILENAME);
    }

    #[test]
    fn sanitize_filename_clamps_length() {
        let input = format!("{}.mp4", "a".repeat(200));
        let sanitized = sanitize_filename(&input);
        assert_eq!(sanitized.len(), 120);
    }

    #[test]
    fn build_s3_object_key_uses_stable_segments() {
        let skill_id = Uuid::parse_str("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa").unwrap();
        let demo_id = Uuid::parse_str("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb").unwrap();
        let key = build_s3_object_key(skill_id, demo_id, "demo.mp4");
        assert_eq!(
            key,
            "demonstrations/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/demo.mp4"
        );
    }
}
