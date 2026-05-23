use sqlx::PgPool;

pub async fn check_health(pool: &PgPool) -> bool {
    sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(pool)
        .await
        .is_ok()
}

pub async fn check_redis(client: &redis::Client) -> bool {
    match client.get_multiplexed_tokio_connection().await {
        Ok(mut conn) => redis::cmd("PING")
            .query_async::<_, String>(&mut conn)
            .await
            .is_ok(),
        Err(_) => false,
    }
}
