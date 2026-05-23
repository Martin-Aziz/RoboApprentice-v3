use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Authentication required")]
    Unauthorized,

    #[error("Insufficient permissions")]
    Forbidden,

    #[error("{0} not found")]
    NotFound(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Rate limit exceeded")]
    RateLimited,

    #[error("Database error")]
    Database(#[from] sqlx::Error),

    #[error("Redis error")]
    Redis(#[from] redis::RedisError),

    #[error("Internal error")]
    Internal(String),
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<String>,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message, details) = match &self {
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "Authentication required", None),
            AppError::Forbidden => (StatusCode::FORBIDDEN, "Insufficient permissions", None),
            AppError::NotFound(entity) => (
                StatusCode::NOT_FOUND,
                "Resource not found",
                Some(format!("{entity} not found")),
            ),
            AppError::Validation(msg) => (StatusCode::UNPROCESSABLE_ENTITY, "Validation error", Some(msg.clone())),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, "Conflict", Some(msg.clone())),
            AppError::RateLimited => (StatusCode::TOO_MANY_REQUESTS, "Rate limit exceeded", None),
            AppError::Database(err) => {
                tracing::error!(error = %err, "Database error");
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error", None)
            }
            AppError::Redis(err) => {
                tracing::error!(error = %err, "Redis error");
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error", None)
            }
            AppError::Internal(msg) => {
                tracing::error!(error = %msg, "Internal error");
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error", None)
            }
        };

        let body = ErrorResponse {
            error: error_message.to_string(),
            details,
        };

        (status, Json(body)).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;
