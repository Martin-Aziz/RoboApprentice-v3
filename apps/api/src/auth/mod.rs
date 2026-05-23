pub mod middleware;
pub mod models;
pub mod routes;
pub mod service;

pub use routes::router;

#[cfg(test)]
mod tests;
