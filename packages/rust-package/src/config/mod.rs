use serde::{Deserialize, Serialize};
use std::env;
use std::net::TcpListener;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    pub server: ServerConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: "0.0.0.0".to_string(),
                port: 3000,
            },
        }
    }
}

impl Config {
    pub fn from_env() -> Result<Self, config::ConfigError> {
        let mut cfg = config::Config::builder()
            .add_source(config::File::with_name("config/default").required(false))
            .add_source(config::Environment::with_prefix("APP").separator("__"));

        // 环境变量覆盖
        if let Ok(port) = env::var("PORT") {
            cfg = cfg.set_override("server.port", port)?;
        }

        if let Ok(host) = env::var("HOST") {
            cfg = cfg.set_override("server.host", host)?;
        }

        cfg.build()?.try_deserialize()
    }

    pub fn auto_env() -> Result<Self, config::ConfigError> {
        // TODO: 使用dotenvy去实现读取env环境的数据
        dotenvy::dotenv().ok();
        let cfg = config::Config::builder()
            .set_default("port", 3000)?
            // .set_default("", value)
            .add_source(
                // 加载APP开头的变量 支持嵌套结构 example: APP_DATABESE__USER
                config::Environment::with_prefix("APP")
                    .prefix_separator("_")
                    .separator("__"),
            )
            .build()?;

          cfg.try_deserialize()
    }

    pub fn server_addr(&self) -> String {
        format!("{}:{}", self.server.host, self.server.port)
    }

    /// 尝试绑定端口，如果被占用则自动尝试下一个端口
    pub async fn bind_with_port_retry(
        &mut self,
        max_retry: u16,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let current_port = self.server.port;
        let max_port = current_port + max_retry;

        for port in current_port..=max_port {
            let addr = format!("{}:{}", self.server.host, port);

            // 尝试绑定端口
            match TcpListener::bind(&addr) {
                Ok(listener) => {
                    // 绑定成功，释放监听器并更新配置
                    drop(listener);
                    self.server.port = port;
                    return Ok(addr);
                }
                Err(e) => {
                    if port == max_port {
                        // 最后一个端口也失败了
                        return Err(format!(
                            "无法在端口范围 {}-{} 内找到可用端口: {}",
                            current_port, max_port, e
                        )
                        .into());
                    }
                    tracing::info!("端口 {} 被占用，尝试下一个端口: {}", port, e);
                }
            }
        }

        Err("端口重试失败".into())
    }
}
