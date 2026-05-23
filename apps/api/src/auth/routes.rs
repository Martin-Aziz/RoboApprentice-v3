use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use axum_extra::extract::cookie::{Cookie, SameSite};
use axum_extra::extract::CookieJar;
use validator::Validate;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

use super::models::{AuthResponse, LoginRequest, RegisterRequest, UserResponse};
use super::service;

async fn check_auth_rate_limit(state: &Arc<AppState>, identifier: &str) -> AppResult<()> {
    let key = format!("rate_limit:auth:{identifier}");
    let mut conn = state.redis_conn().await.map_err(AppError::Redis)?;

    let count: u64 = redis::cmd("INCR")
        .arg(&key)
        .query_async(&mut conn)
        .await
        .unwrap_or(1);

    if count == 1 {
        let _: () = redis::cmd("EXPIRE")
            .arg(&key)
            .arg(state.config.rate_limit_window_seconds)
            .query_async(&mut conn)
            .await
            .unwrap_or(());
    }

    if count > state.config.rate_limit_requests {
        return Err(AppError::RateLimited);
    }

    Ok(())
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/refresh", post(refresh))
        .route("/auth/logout", post(logout))
        .route("/auth/me", get(me))
}

async fn me(
    auth: super::models::AuthUser,
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<UserResponse>> {
    let user = sqlx::query_as::<_, super::models::User>(
        "SELECT id, email, password_hash, name, role, created_at, updated_at FROM users WHERE id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::Unauthorized)?;
    Ok(Json(UserResponse::from(user)))
}

async fn register(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterRequest>,
) -> AppResult<(StatusCode, Json<AuthResponse>)> {
    req.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    check_auth_rate_limit(&state, &req.email).await?;

    let user = service::register_user(&state.db, &req).await?;

    let access_token = service::create_access_token(
        &user,
        &state.jwt_keys,
        state.config.jwt_access_token_expiry_minutes,
    )?;

    let _refresh_token = service::create_refresh_token(
        &state.db,
        user.id,
        state.config.jwt_refresh_token_expiry_days,
    )
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(AuthResponse {
            access_token,
            token_type: "Bearer",
            expires_in: state.config.jwt_access_token_expiry_minutes * 60,
            user: UserResponse::from(user),
        }),
    ))
}

async fn login(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
    Json(req): Json<LoginRequest>,
) -> AppResult<(CookieJar, Json<AuthResponse>)> {
    req.validate().map_err(|e| AppError::Validation(e.to_string()))?;

    check_auth_rate_limit(&state, &req.email).await?;

    let user = service::authenticate_user(&state.db, &req.email, &req.password).await?;

    let access_token = service::create_access_token(
        &user,
        &state.jwt_keys,
        state.config.jwt_access_token_expiry_minutes,
    )?;

    let refresh_token = service::create_refresh_token(
        &state.db,
        user.id,
        state.config.jwt_refresh_token_expiry_days,
    )
    .await?;

    let cookie = Cookie::build(("refresh_token", refresh_token))
        .path("/api/v1/auth")
        .http_only(true)
        .same_site(SameSite::Strict)
        .secure(state.config.is_production())
        .max_age(time::Duration::days(
            state.config.jwt_refresh_token_expiry_days as i64,
        ))
        .build();

    Ok((
        jar.add(cookie),
        Json(AuthResponse {
            access_token,
            token_type: "Bearer",
            expires_in: state.config.jwt_access_token_expiry_minutes * 60,
            user: UserResponse::from(user),
        }),
    ))
}

async fn refresh(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
) -> AppResult<(CookieJar, Json<AuthResponse>)> {
    let old_token = jar
        .get("refresh_token")
        .map(|c| c.value().to_string())
        .ok_or(AppError::Unauthorized)?;

    let (user, access_token, new_refresh) = service::rotate_refresh_token(&state, &old_token).await?;

    let cookie = Cookie::build(("refresh_token", new_refresh))
        .path("/api/v1/auth")
        .http_only(true)
        .same_site(SameSite::Strict)
        .secure(state.config.is_production())
        .max_age(time::Duration::days(
            state.config.jwt_refresh_token_expiry_days as i64,
        ))
        .build();

    Ok((
        jar.add(cookie),
        Json(AuthResponse {
            access_token,
            token_type: "Bearer",
            expires_in: state.config.jwt_access_token_expiry_minutes * 60,
            user: UserResponse::from(user),
        }),
    ))
}

async fn logout(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
) -> AppResult<(CookieJar, StatusCode)> {
    if let Some(token) = jar.get("refresh_token") {
        service::revoke_refresh_token(&state.db, token.value()).await?;
    }

    let removal = Cookie::build(("refresh_token", ""))
        .path("/api/v1/auth")
        .max_age(time::Duration::ZERO)
        .build();

    Ok((jar.remove(removal), StatusCode::NO_CONTENT))
}
