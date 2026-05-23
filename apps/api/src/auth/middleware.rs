use std::sync::Arc;

use axum::{
    extract::{FromRequestParts, State},
    http::{header::AUTHORIZATION, request::Parts},
};

use crate::error::AppError;
use crate::state::AppState;

use super::models::AuthUser;
use super::service::validate_access_token;

#[axum::async_trait]
impl FromRequestParts<Arc<AppState>> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or(AppError::Unauthorized)?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or(AppError::Unauthorized)?;

        validate_access_token(token, &state.jwt_keys)
    }
}
