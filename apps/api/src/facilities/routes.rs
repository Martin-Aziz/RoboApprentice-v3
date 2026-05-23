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

use super::models::{CreateFacilityRequest, Facility};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/facilities", post(create_facility).get(list_facilities))
        .route("/facilities/:id", get(get_facility))
}

async fn create_facility(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Json(req): Json<CreateFacilityRequest>,
) -> AppResult<(StatusCode, Json<Facility>)> {
    req.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    let facility = sqlx::query_as::<_, Facility>(
        r#"
        INSERT INTO facilities (id, name, owner_id, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id, name, owner_id, created_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(&req.name)
    .bind(user.user_id)
    .fetch_one(&state.db)
    .await?;

    tracing::info!(facility_id = %facility.id, name = %facility.name, "Facility created");
    Ok((StatusCode::CREATED, Json(facility)))
}

async fn list_facilities(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
) -> AppResult<Json<Vec<Facility>>> {
    let facilities = sqlx::query_as::<_, Facility>(
        "SELECT id, name, owner_id, created_at FROM facilities WHERE owner_id = $1 ORDER BY created_at DESC",
    )
    .bind(user.user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(facilities))
}

async fn get_facility(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<Facility>> {
    let facility = sqlx::query_as::<_, Facility>(
        "SELECT id, name, owner_id, created_at FROM facilities WHERE id = $1 AND owner_id = $2",
    )
    .bind(id)
    .bind(user.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Facility".into()))?;

    Ok(Json(facility))
}
