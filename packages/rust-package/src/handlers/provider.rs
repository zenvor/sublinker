use axum::{
  routing::{get},
  Router,
  http::StatusCode,
  response::{IntoResponse},
};

pub fn router() -> Router {
  Router::new().route("/", get(provider))
}

async fn provider(token: String) -> impl IntoResponse {
  (StatusCode::OK, format!("Hello, World! {}", token))
}