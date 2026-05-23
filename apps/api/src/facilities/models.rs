use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use time::OffsetDateTime;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct Facility {
    pub id: Uuid,
    pub name: String,
    pub owner_id: Uuid,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateFacilityRequest {
    #[validate(length(min = 1, max = 200, message = "Name is required (max 200 chars)"))]
    pub name: String,
}
