use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use time::OffsetDateTime;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum RobotStatus {
    Online,
    Idle,
    Running,
    Error,
    Offline,
}

impl std::fmt::Display for RobotStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Online => write!(f, "online"),
            Self::Idle => write!(f, "idle"),
            Self::Running => write!(f, "running"),
            Self::Error => write!(f, "error"),
            Self::Offline => write!(f, "offline"),
        }
    }
}

impl From<String> for RobotStatus {
    fn from(s: String) -> Self {
        match s.as_str() {
            "online" => Self::Online,
            "idle" => Self::Idle,
            "running" => Self::Running,
            "error" => Self::Error,
            _ => Self::Offline,
        }
    }
}

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct Robot {
    pub id: Uuid,
    pub facility_id: Uuid,
    pub name: String,
    pub brand: String,
    pub model: String,
    pub urdf_hash: Option<String>,
    pub status: String,
    pub ip_address: Option<String>,
    pub last_seen_at: Option<OffsetDateTime>,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateRobotRequest {
    #[validate(length(min = 1, max = 100, message = "Name is required"))]
    pub name: String,
    #[validate(length(min = 1, max = 50, message = "Brand is required"))]
    pub brand: String,
    #[validate(length(min = 1, max = 100, message = "Model is required"))]
    pub model: String,
    pub ip_address: Option<String>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateRobotRequest {
    pub name: Option<String>,
    pub ip_address: Option<String>,
    pub status: Option<String>,
}
