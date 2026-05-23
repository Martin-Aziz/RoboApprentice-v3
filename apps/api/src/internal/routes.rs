use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::patch,
    Json, Router,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/demonstrations/:id",
            patch(update_demonstration),
        )
        .route(
            "/skills/:id/embedding",
            patch(update_skill_embedding),
        )
}

/// Verify the `X-Internal-Secret` header matches the configured secret.
fn verify_internal_secret(headers: &HeaderMap, state: &AppState) -> AppResult<()> {
    let provided = headers
        .get("x-internal-secret")
        .and_then(|v| v.to_str().ok())
        .ok_or(AppError::Unauthorized)?;

    if provided != state.config.internal_api_secret {
        return Err(AppError::Unauthorized);
    }

    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct UpdateDemonstrationRequest {
    pub voice_transcript: Option<String>,
    pub quality_score: Option<f64>,
}

/// Called by the ML worker after transcription and quality scoring.
async fn update_demonstration(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateDemonstrationRequest>,
) -> AppResult<StatusCode> {
    verify_internal_secret(&headers, &state)?;

    let updated = sqlx::query_scalar::<_, bool>(
        r#"
        UPDATE demonstrations
        SET voice_transcript = COALESCE($2, voice_transcript),
            quality_score    = COALESCE($3, quality_score)
        WHERE id = $1
        RETURNING true
        "#,
    )
    .bind(id)
    .bind(&req.voice_transcript)
    .bind(req.quality_score)
    .fetch_optional(&state.db)
    .await?
    .unwrap_or(false);

    if !updated {
        return Err(AppError::NotFound("Demonstration".into()));
    }

    // Transition skill status from 'training' → determined per embedding update.
    // Also mark the demonstration's skill as 'training' when processing starts.
    tracing::info!(demonstration_id = %id, "Demonstration transcript/score updated by ML worker");
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Deserialize)]
pub struct UpdateSkillEmbeddingRequest {
    /// 384-dimensional embedding as array of floats.
    pub embedding: Vec<f64>,
}

/// Called by the ML worker after generating the skill embedding.
/// Stores the embedding and transitions skill status to 'ready'.
async fn update_skill_embedding(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateSkillEmbeddingRequest>,
) -> AppResult<StatusCode> {
    verify_internal_secret(&headers, &state)?;

    if req.embedding.len() != 384 {
        return Err(AppError::Validation(format!(
            "Embedding must be 384 dimensions, got {}",
            req.embedding.len()
        )));
    }

    // Format the vector as the pgvector text representation: '[0.1,0.2,...]'
    let embedding_str = format!(
        "[{}]",
        req.embedding
            .iter()
            .map(|v| v.to_string())
            .collect::<Vec<_>>()
            .join(",")
    );

    // Compute average quality score from all demonstrations to set confidence
    let avg_quality = sqlx::query_scalar::<_, Option<f64>>(
        "SELECT AVG(quality_score) FROM demonstrations WHERE skill_id = $1 AND quality_score IS NOT NULL",
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0.0);

    let updated = sqlx::query_scalar::<_, bool>(
        r#"
        UPDATE skills
        SET embedding   = $2::vector,
            confidence  = $3,
            status      = 'ready',
            updated_at  = NOW()
        WHERE id = $1
          AND status != 'deprecated'
        RETURNING true
        "#,
    )
    .bind(id)
    .bind(&embedding_str)
    .bind(avg_quality)
    .fetch_optional(&state.db)
    .await?
    .unwrap_or(false);

    if !updated {
        return Err(AppError::NotFound("Skill".into()));
    }

    tracing::info!(skill_id = %id, confidence = avg_quality, "Skill embedding updated — status set to ready");
    Ok(StatusCode::NO_CONTENT)
}

