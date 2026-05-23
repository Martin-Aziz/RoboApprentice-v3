use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use uuid::Uuid;
use validator::Validate;

use crate::auth::models::AuthUser;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

use super::models::{
    CreateSkillRequest, ExecuteSkillRequest, Skill, SkillExecution, SkillListResponse, SkillQuery,
    SimilarSkillsQuery, UpdateSkillRequest,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/facilities/:facility_id/skills",
            post(create_skill).get(list_skills),
        )
        .route(
            "/facilities/:facility_id/skills/similar",
            get(find_similar_skills),
        )
        .route(
            "/skills/:id",
            get(get_skill).patch(update_skill).delete(delete_skill),
        )
        .route("/skills/:id/execute", post(execute_skill))
        .route("/skills/:id/executions", get(list_executions))
}

async fn create_skill(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(facility_id): Path<Uuid>,
    Json(req): Json<CreateSkillRequest>,
) -> AppResult<(StatusCode, Json<Skill>)> {
    req.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    verify_facility_access(&state, facility_id, user.user_id).await?;

    let skill = sqlx::query_as::<_, Skill>(
        r#"
        INSERT INTO skills (id, facility_id, name, description, task_language, confidence, status, run_count, success_count, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 0.0, 'draft', 0, 0, $6, NOW(), NOW())
        RETURNING id, facility_id, name, description, task_language, confidence, status, policy_data, run_count, success_count, created_by, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(facility_id)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.task_language)
    .bind(user.user_id)
    .fetch_one(&state.db)
    .await?;

    tracing::info!(skill_id = %skill.id, name = %skill.name, "Skill created");
    Ok((StatusCode::CREATED, Json(skill)))
}

async fn list_skills(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(facility_id): Path<Uuid>,
    Query(query): Query<SkillQuery>,
) -> AppResult<Json<SkillListResponse>> {
    verify_facility_access(&state, facility_id, user.user_id).await?;

    let limit = query.limit.unwrap_or(50).min(100);
    let offset = query.offset.unwrap_or(0);

    let order_clause = match query.sort_by.as_deref() {
        Some("name") => "ORDER BY s.name ASC",
        Some("confidence") => "ORDER BY s.confidence DESC NULLS LAST",
        Some("run_count") => "ORDER BY s.run_count DESC",
        _ => "ORDER BY s.updated_at DESC",
    };

    let base_query = format!(
        r#"
        SELECT s.id, s.facility_id, s.name, s.description, s.task_language, s.confidence, s.status,
               s.policy_data, s.run_count, s.success_count, s.created_by, s.created_at, s.updated_at
        FROM skills s
        WHERE s.facility_id = $1
          AND s.status != 'deprecated'
          AND ($2::text IS NULL OR s.status = $2)
          AND ($3::text IS NULL OR s.name ILIKE '%' || $3 || '%' OR s.task_language ILIKE '%' || $3 || '%')
        {order_clause}
        LIMIT $4 OFFSET $5
        "#,
    );

    let skills = sqlx::query_as::<_, Skill>(&base_query)
        .bind(facility_id)
        .bind(&query.status)
        .bind(&query.search)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await?;

    let total = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*) FROM skills s
        WHERE s.facility_id = $1
          AND s.status != 'deprecated'
          AND ($2::text IS NULL OR s.status = $2)
          AND ($3::text IS NULL OR s.name ILIKE '%' || $3 || '%' OR s.task_language ILIKE '%' || $3 || '%')
        "#,
    )
    .bind(facility_id)
    .bind(&query.status)
    .bind(&query.search)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(SkillListResponse { skills, total }))
}

async fn get_skill(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Skill>> {
    let skill = sqlx::query_as::<_, Skill>(
        r#"
        SELECT s.id, s.facility_id, s.name, s.description, s.task_language, s.confidence, s.status,
               s.policy_data, s.run_count, s.success_count, s.created_by, s.created_at, s.updated_at
        FROM skills s
        JOIN facilities f ON s.facility_id = f.id
        WHERE s.id = $1 AND f.owner_id = $2
        "#,
    )
    .bind(id)
    .bind(user.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Skill".into()))?;

    Ok(Json(skill))
}

async fn update_skill(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateSkillRequest>,
) -> AppResult<Json<Skill>> {
    verify_skill_ownership(&state, id, user.user_id).await?;

    let skill = sqlx::query_as::<_, Skill>(
        r#"
        UPDATE skills SET
            name = COALESCE($2, name),
            description = COALESCE($3, description),
            task_language = COALESCE($4, task_language),
            status = COALESCE($5, status),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, facility_id, name, description, task_language, confidence, status, policy_data, run_count, success_count, created_by, created_at, updated_at
        "#,
    )
    .bind(id)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.task_language)
    .bind(&req.status)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(skill))
}

async fn delete_skill(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    verify_skill_ownership(&state, id, user.user_id).await?;

    // Soft delete: set status to deprecated
    sqlx::query("UPDATE skills SET status = 'deprecated', updated_at = NOW() WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    tracing::info!(skill_id = %id, "Skill soft-deleted (deprecated)");
    Ok(StatusCode::NO_CONTENT)
}

async fn execute_skill(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<ExecuteSkillRequest>,
) -> AppResult<(StatusCode, Json<SkillExecution>)> {
    verify_skill_ownership(&state, id, user.user_id).await?;

    // Verify robot belongs to same facility as the skill
    let valid = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM robots r
            JOIN skills s ON r.facility_id = s.facility_id
            WHERE r.id = $1 AND s.id = $2
        )
        "#,
    )
    .bind(req.robot_id)
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    if !valid {
        return Err(AppError::Validation(
            "Robot must belong to the same facility as the skill".into(),
        ));
    }

    let execution = sqlx::query_as::<_, SkillExecution>(
        r#"
        INSERT INTO skill_executions (id, skill_id, robot_id, status, started_at, parts_processed)
        VALUES ($1, $2, $3, 'started', NOW(), 0)
        RETURNING id, skill_id, robot_id, status, started_at, completed_at, parts_processed, error_message
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(id)
    .bind(req.robot_id)
    .fetch_one(&state.db)
    .await?;

    // Update robot status to running
    sqlx::query("UPDATE robots SET status = 'running' WHERE id = $1")
        .bind(req.robot_id)
        .execute(&state.db)
        .await?;

    // Increment skill run count
    sqlx::query("UPDATE skills SET run_count = run_count + 1, updated_at = NOW() WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    tracing::info!(
        execution_id = %execution.id,
        skill_id = %id,
        robot_id = %req.robot_id,
        "Skill execution started"
    );

    // In production: dispatch to robot command service via Redis queue

    Ok((StatusCode::CREATED, Json(execution)))
}

async fn list_executions(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Vec<SkillExecution>>> {
    verify_skill_ownership(&state, id, user.user_id).await?;

    let executions = sqlx::query_as::<_, SkillExecution>(
        r#"
        SELECT id, skill_id, robot_id, status, started_at, completed_at, parts_processed, error_message
        FROM skill_executions
        WHERE skill_id = $1
        ORDER BY started_at DESC
        LIMIT 50
        "#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(executions))
}

async fn verify_facility_access(state: &Arc<AppState>, facility_id: Uuid, user_id: Uuid) -> AppResult<()> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM facilities WHERE id = $1 AND owner_id = $2)",
    )
    .bind(facility_id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    if !exists {
        return Err(AppError::NotFound("Facility".into()));
    }

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

async fn find_similar_skills(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(facility_id): Path<Uuid>,
    Query(query): Query<SimilarSkillsQuery>,
) -> AppResult<Json<Vec<Skill>>> {
    verify_facility_access(&state, facility_id, user.user_id).await?;

    let limit = query.limit.unwrap_or(10).min(50);

    // Get embedding from ML service
    let client = reqwest::Client::new();
    let embed_resp = client
        .post(format!("{}/api/v1/embed", state.config.ml_service_url))
        .json(&serde_json::json!({ "text": query.q }))
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("ML service unreachable: {e}")))?;

    if !embed_resp.status().is_success() {
        return Err(AppError::Internal("ML service embedding request failed".into()));
    }

    let embed_data: serde_json::Value = embed_resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("ML service response parse error: {e}")))?;

    let embedding_vec: Vec<f64> = serde_json::from_value(
        embed_data["embedding"].clone(),
    )
    .map_err(|_| AppError::Internal("Invalid embedding format from ML service".into()))?;

    let embedding_str = format!(
        "[{}]",
        embedding_vec
            .iter()
            .map(|v| v.to_string())
            .collect::<Vec<_>>()
            .join(",")
    );

    let skills = sqlx::query_as::<_, Skill>(
        r#"
        SELECT s.id, s.facility_id, s.name, s.description, s.task_language, s.confidence,
               s.status, s.policy_data, s.run_count, s.success_count, s.created_by,
               s.created_at, s.updated_at
        FROM skills s
        WHERE s.facility_id = $1
          AND s.status = 'ready'
          AND s.embedding IS NOT NULL
        ORDER BY s.embedding <=> $2::vector
        LIMIT $3
        "#,
    )
    .bind(facility_id)
    .bind(&embedding_str)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(skills))
}

