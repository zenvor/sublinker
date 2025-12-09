mod config;
mod handlers;

use crate::{config::Config, handlers::create_routes};
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 初始化日志
    tracing_subscriber::fmt::init();

    // 加载配置
    let mut config = Config::from_env().unwrap_or_else(|e| {
        tracing::warn!("无法从环境加载配置，使用默认配置: {}", e);
        Config::default()
    });

    info!("🚀 启动应用...");
    info!("原始配置: {:?}", config);

    // 创建路由
    let app = create_routes();

    // 尝试绑定端口，支持端口自增重试（最多重试10次）
    let server_addr = config.bind_with_port_retry(10).await?;
    info!("成功绑定地址: {}", server_addr);

    // 使用成功绑定的地址创建监听器
    let listener = tokio::net::TcpListener::bind(&server_addr).await?;

    info!("🌐 服务器运行在: {}", config.server_addr());
    info!("📊 健康检查: http://{}/health", config.server_addr());

    // 启动服务器
    axum::serve(listener, app).await?;

    Ok(())
}