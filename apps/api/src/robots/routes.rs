use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use uuid::Uuid;
use validator::Validate;

use crate::auth::models::AuthUser;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

use super::models::{CreateRobotRequest, Robot, UpdateRobotRequest};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/facilities/:facility_id/robots",
            post(create_robot).get(list_robots),
        )
        .route("/robots/:id", get(get_robot).patch(update_robot))
        .route("/robots/:id/estop", post(emergency_stop))
}

async fn create_robot(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(facility_id): Path<Uuid>,
    Json(req): Json<CreateRobotRequest>,
) -> AppResult<(StatusCode, Json<Robot>)> {
    req.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    verify_facility_ownership(&state, facility_id, user.user_id).await?;

    let robot = sqlx::query_as::<_, Robot>(
        r#"
        INSERT INTO robots (id, facility_id, name, brand, model, status, ip_address, created_at)
        VALUES ($1, $2, $3, $4, $5, 'offline', $6::inet, NOW())
        RETURNING id, facility_id, name, brand, model, urdf_hash, status, ip_address::text, last_seen_at, created_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(facility_id)
    .bind(&req.name)
    .bind(&req.brand)
    .bind(&req.model)
    .bind(&req.ip_address)
    .fetch_one(&state.db)
    .await?;

    tracing::info!(robot_id = %robot.id, name = %robot.name, brand = %robot.brand, "Robot registered");
    Ok((StatusCode::CREATED, Json(robot)))
}

async fn list_robots(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(facility_id): Path<Uuid>,
) -> AppResult<Json<Vec<Robot>>> {
    verify_facility_ownership(&state, facility_id, user.user_id).await?;

    let robots = sqlx::query_as::<_, Robot>(
        r#"
        SELECT id, facility_id, name, brand, model, urdf_hash, status, ip_address::text, last_seen_at, created_at
        FROM robots WHERE facility_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(facility_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(robots))
}

async fn get_robot(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Robot>> {
    let robot = sqlx::query_as::<_, Robot>(
        r#"
        SELECT r.id, r.facility_id, r.name, r.brand, r.model, r.urdf_hash, r.status, r.ip_address::text, r.last_seen_at, r.created_at
        FROM robots r
        JOIN facilities f ON r.facility_id = f.id
        WHERE r.id = $1 AND f.owner_id = $2
        "#,
    )
    .bind(id)
    .bind(user.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Robot".into()))?;

    Ok(Json(robot))
}

async fn update_robot(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateRobotRequest>,
) -> AppResult<Json<Robot>> {
    // Verify ownership via facility join
    let existing = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM robots r JOIN facilities f ON r.facility_id = f.id
            WHERE r.id = $1 AND f.owner_id = $2
        )
        "#,
    )
    .bind(id)
    .bind(user.user_id)
    .fetch_one(&state.db)
    .await?;

    if !existing {
        return Err(AppError::NotFound("Robot".into()));
    }

    let robot = sqlx::query_as::<_, Robot>(
        r#"
        UPDATE robots SET
            name = COALESCE($2, name),
            ip_address = COALESCE($3::inet, ip_address),
            status = COALESCE($4, status)
        WHERE id = $1
        RETURNING id, facility_id, name, brand, model, urdf_hash, status, ip_address::text, last_seen_at, created_at
        "#,
    )
    .bind(id)
    .bind(&req.name)
    .bind(&req.ip_address)
    .bind(&req.status)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(robot))
}

async fn emergency_stop(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Robot>> {
    // Verify ownership
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM robots r JOIN facilities f ON r.facility_id = f.id WHERE r.id = $1 AND f.owner_id = $2)",
    )
    .bind(id)
    .bind(user.user_id)
    .fetch_one(&state.db)
    .await?;

    if !exists {
        return Err(AppError::NotFound("Robot".into()));
    }

    let robot = sqlx::query_as::<_, Robot>(
        r#"
        UPDATE robots SET status = 'offline'
        WHERE id = $1
        RETURNING id, facility_id, name, brand, model, urdf_hash, status, ip_address::text, last_seen_at, created_at
        "#,
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    // In production: send immediate stop command via robot dispatch service
    tracing::warn!(robot_id = %id, user_id = %user.user_id, "EMERGENCY STOP triggered");

    Ok(Json(robot))
}

async fn verify_facility_ownership(
    state: &Arc<AppState>,
    facility_id: Uuid,
    user_id: Uuid,
) -> AppResult<()> {
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
