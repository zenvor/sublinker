# 防 QQ 预览机制

## ✅ 当前实现

### 1. User-Agent 检测 ✅

- 允许 UA 包含 "clash"、"Clash"、"shadowrocket" 或 "Shadowrocket" 的请求
- 大小写不敏感
- 拒绝 QQ 预览爬虫、浏览器等其他 UA

### 2. IP 绑定策略 ✅

- `/sub` 接口：仅返回订阅配置 YAML，不进行 IP 绑定
- `/provider` 接口：进行 IP 绑定检查和绑定操作
- 只需通过 UA 和订阅校验，即可在 `/provider` 接口进行 IP 绑定

## 工作原理

### 防御 QQ 预览的流程

```
QQ 预览爬虫访问:
1. GET /sub?token=xxx (UA: QQBot)
2. 服务器检测 UA 不包含 "clash"
3. 返回 403 拒绝
4. ✅ Token 未被消费，IP 未被绑定

Clash 客户端访问:
1. GET /sub?token=xxx (UA: clash)
   - 检测 UA 通过
   - 返回订阅配置（包含 provider URL）
2. GET /provider?token=xxx (UA: clash)
   - 检测 UA 通过
   - 进行 IP 绑定检查
   - 绑定 IP 并返回节点列表
3. ✅ Token 正常使用，IP 已绑定

Clash 定期刷新节点:
1. GET /provider?token=xxx (UA: clash)
   - 检测 UA 通过
   - 检查 IP 是否已绑定，或尝试绑定新 IP
   - 返回节点列表
2. ✅ 正常刷新
```

## 代码结构

### 核心文件

- `src/routes/sub.js` - 返回一级订阅 YAML（不绑定 IP）
- `src/routes/provider.js` - 返回节点列表，执行 IP 绑定检查
- `src/services/ipTracker.js` - IP 绑定服务（数据库持久化）

## 使用说明

### 测试订阅链接

```bash
# 使用正确的 UA
curl -H "User-Agent: clash" "http://localhost:3000/sub?token=YOUR_TOKEN"

# 错误的 UA 会被拒绝
curl "http://localhost:3000/sub?token=YOUR_TOKEN"  # 返回 403
```

### 在 Clash 中测试

1. 复制订阅链接: `http://localhost:3000/sub?token=YOUR_TOKEN`
2. 在 Clash 客户端中导入订阅
3. 检查是否能正常获取节点
4. 查看数据库确认 IP 已绑定:
   ```bash
   sqlite3 data/cloakgate.db "SELECT * FROM ip_bindings WHERE token='YOUR_TOKEN';"
   ```

### 在 QQ 中测试

1. 在 QQ 中发送订阅链接
2. 观察是否触发预览
3. 检查服务器日志，应该看到 UA 检测失败的记录
4. 查看数据库确认 token 未被绑定

## 注意事项

### ⚠️ UA 检测

- 仅允许 Clash 和 Shadowrocket 客户端访问
- 浏览器直接访问会被拒绝
- 使用 curl 测试时必须设置正确的 UA

### ⚠️ IP 绑定

- IP 绑定仅在 `/provider` 接口进行
- 当槽位已满时，新 IP 会被拒绝
- 不活跃的 IP 会被自动清理（可配置）

## 总结

通过 **User-Agent 检测** 有效防止了 QQ 链接预览消费 token 的问题，同时不影响 Clash 客户端的正常使用。IP 绑定逻辑简化为仅在 `/provider` 接口执行，逻辑更清晰一致。
