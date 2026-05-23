use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use time::OffsetDateTime;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct Demonstration {
    pub id: Uuid,
    pub skill_id: Uuid,
    pub video_path: Option<String>,
    pub voice_transcript: Option<String>,
    pub source_robot_id: Option<Uuid>,
    pub quality_score: Option<f64>,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateDemonstrationRequest {
    pub voice_transcript: Option<String>,
    pub source_robot_id: Option<Uuid>,
}
