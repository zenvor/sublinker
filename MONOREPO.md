# CloakGate Monorepo 架构

本项目已迁移为monorepo架构，支持多语言实现。

## 项目结构

```
CloakGate/
├── packages/
│   ├── javascript-package/     # 原始JavaScript实现
│   └── rust-package/          # Rust实现（待开发）
├── Cargo.toml                 # Rust workspace配置
├── package.json               # Node.js workspace配置
└── MONOREPO.md               # 本文档
```

## 开发指南

### JavaScript版本
```bash
# 安装依赖
npm install

# 开发模式
npm run dev:js

# 生产模式
npm run start:js
```

### Rust版本
```bash
# 构建
cd packages/rust-package && cargo build

# 运行
cd packages/rust-package && cargo run
```

## 脚本命令

- `npm run dev:js` - 启动JavaScript开发服务器
- `npm run dev:rust` - 启动Rust开发服务器
- `npm run start:js` - 启动JavaScript生产服务器
- `npm run start:rust` - 启动Rust生产服务器
- `npm run install:all` - 安装所有依赖

## 注意事项

1. JavaScript版本是原始实现，功能完整
2. Rust版本目前只有基本结构，待后续开发
3. 两个版本共享相同的数据库结构
4. 使用不同的端口避免冲突