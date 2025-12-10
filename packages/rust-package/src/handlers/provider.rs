use axum::{Router, http::StatusCode, response::IntoResponse, routing::get};

pub fn router() -> Router {
    Router::new().route("/", get(provider))
}

async fn provider(token: String) -> impl IntoResponse {
    (StatusCode::OK, format!("Hello, World! {}", token))
}
