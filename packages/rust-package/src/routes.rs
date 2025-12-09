use axum::{
    routing::{get},
    Router,
};

pub fn create_routes() -> Router {
    Router::new()
        .route("/", get(root))
        .route("/health", get(health_check))
}

async fn root() -> &'static str {
    "Hello, World!"
}

async fn health_check() -> &'static str {
    "OK"
}