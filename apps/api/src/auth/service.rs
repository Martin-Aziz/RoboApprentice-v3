use std::sync::Arc;

use argon2::{
    password_hash::{rand_core::OsRng, SaltString},
    Argon2, PasswordHash, PasswordHasher, PasswordVerifier,
};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use sqlx::PgPool;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::state::{AppState, JwtKeys};

use super::models::{AccessTokenClaims, AuthUser, RegisterRequest, User};

pub async fn register_user(pool: &PgPool, req: &RegisterRequest) -> AppResult<User> {
    let existing = sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)")
        .bind(&req.email)
        .fetch_one(pool)
        .await?;

    if existing {
        return Err(AppError::Conflict("Email already registered".into()));
    }

    let password_hash = hash_password(&req.password)?;

    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'admin', NOW(), NOW())
        RETURNING id, email, password_hash, name, role, created_at, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(&req.email)
    .bind(&password_hash)
    .bind(&req.name)
    .fetch_one(pool)
    .await?;

    tracing::info!(user_id = %user.id, email = %user.email, "User registered");
    Ok(user)
}

pub async fn authenticate_user(pool: &PgPool, email: &str, password: &str) -> AppResult<User> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, email, password_hash, name, role, created_at, updated_at FROM users WHERE email = $1",
    )
    .bind(email)
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::Unauthorized)?;

    verify_password(password, &user.password_hash)?;

    Ok(user)
}

pub fn create_access_token(user: &User, keys: &JwtKeys, expiry_minutes: u64) -> AppResult<String> {
    let now = OffsetDateTime::now_utc();
    let exp = now + time::Duration::minutes(expiry_minutes as i64);

    let claims = AccessTokenClaims {
        sub: user.id.to_string(),
        email: user.email.clone(),
        role: user.role.clone(),
        iat: now.unix_timestamp(),
        exp: exp.unix_timestamp(),
    };

    let header = Header::new(Algorithm::RS256);
    let key = EncodingKey::from_rsa_pem(&keys.private_key)
        .map_err(|e| AppError::Internal(format!("JWT encoding key error: {e}")))?;

    encode(&header, &claims, &key).map_err(|e| AppError::Internal(format!("JWT encode error: {e}")))
}

pub fn validate_access_token(token: &str, keys: &JwtKeys) -> AppResult<AuthUser> {
    let key = DecodingKey::from_rsa_pem(&keys.public_key)
        .map_err(|e| AppError::Internal(format!("JWT decoding key error: {e}")))?;

    let mut validation = Validation::new(Algorithm::RS256);
    validation.validate_exp = true;

    let data = decode::<AccessTokenClaims>(token, &key, &validation).map_err(|_| AppError::Unauthorized)?;

    let user_id =
        Uuid::parse_str(&data.claims.sub).map_err(|_| AppError::Internal("Invalid user ID in token".into()))?;

    Ok(AuthUser {
        user_id,
        email: data.claims.email,
        role: data.claims.role,
    })
}

pub async fn create_refresh_token(pool: &PgPool, user_id: Uuid, expiry_days: u64) -> AppResult<String> {
    let token = Uuid::new_v4().to_string();
    let token_hash = hash_token(&token);
    let expires_at = OffsetDateTime::now_utc() + time::Duration::days(expiry_days as i64);

    sqlx::query(
        r#"
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(&token_hash)
    .bind(expires_at)
    .fetch_optional(pool)
    .await?;

    Ok(token)
}

pub async fn rotate_refresh_token(
    state: &Arc<AppState>,
    old_token: &str,
) -> AppResult<(User, String, String)> {
    let old_hash = hash_token(old_token);

    let record = sqlx::query_as::<_, (Uuid, Uuid, OffsetDateTime)>(
        "SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = $1",
    )
    .bind(&old_hash)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let (token_id, user_id, expires_at) = record;

    if expires_at < OffsetDateTime::now_utc() {
        sqlx::query("DELETE FROM refresh_tokens WHERE id = $1")
            .bind(token_id)
            .execute(&state.db)
            .await?;
        return Err(AppError::Unauthorized);
    }

    // Delete old token (rotation)
    sqlx::query("DELETE FROM refresh_tokens WHERE id = $1")
        .bind(token_id)
        .execute(&state.db)
        .await?;

    let user = sqlx::query_as::<_, User>(
        "SELECT id, email, password_hash, name, role, created_at, updated_at FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let access_token = create_access_token(&user, &state.jwt_keys, state.config.jwt_access_token_expiry_minutes)?;
    let new_refresh = create_refresh_token(&state.db, user.id, state.config.jwt_refresh_token_expiry_days).await?;

    Ok((user, access_token, new_refresh))
}

pub async fn revoke_refresh_token(pool: &PgPool, token: &str) -> AppResult<()> {
    let token_hash = hash_token(token);
    sqlx::query("DELETE FROM refresh_tokens WHERE token_hash = $1")
        .bind(&token_hash)
        .execute(pool)
        .await?;
    Ok(())
}

fn hash_password(password: &str) -> AppResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("Password hashing error: {e}")))?;
    Ok(hash.to_string())
}

fn verify_password(password: &str, hash: &str) -> AppResult<()> {
    let parsed = PasswordHash::new(hash).map_err(|e| AppError::Internal(format!("Password hash parse: {e}")))?;
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .map_err(|_| AppError::Unauthorized)
}

fn hash_token(token: &str) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}
