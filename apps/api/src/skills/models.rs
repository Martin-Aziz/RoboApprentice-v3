use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use time::OffsetDateTime;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct Skill {
    pub id: Uuid,
    pub facility_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub task_language: String,
    pub confidence: Option<f64>,
    pub status: String,
    pub policy_data: Option<serde_json::Value>,
    pub run_count: i32,
    pub success_count: i32,
    pub created_by: Uuid,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateSkillRequest {
    #[validate(length(min = 1, max = 200, message = "Skill name is required"))]
    pub name: String,
    pub description: Option<String>,
    #[validate(length(min = 1, max = 2000, message = "Task description is required"))]
    pub task_language: String,
    pub target_robot_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateSkillRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub task_language: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SkillQuery {
    pub status: Option<String>,
    pub search: Option<String>,
    pub sort_by: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SkillListResponse {
    pub skills: Vec<Skill>,
    pub total: i64,
}

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct SkillExecution {
    pub id: Uuid,
    pub skill_id: Uuid,
    pub robot_id: Uuid,
    pub status: String,
    pub started_at: Option<OffsetDateTime>,
    pub completed_at: Option<OffsetDateTime>,
    pub parts_processed: i32,
    pub error_message: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SimilarSkillsQuery {
    pub q: String,
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ExecuteSkillRequest {
    pub robot_id: Uuid,
}

