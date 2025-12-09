mod provider;

use axum::{
  routing::{get},
  Router,
};

pub fn create_routes() -> Router {
  Router::new()
      .route("/health", get(health_check))
      .nest("/provider", provider::router())
}

async fn health_check() -> &'static str {
  "Alive"
}