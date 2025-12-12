# 防QQ预览机制实现完成

## ✅ 测试结果

所有测试均通过! 

```
测试1: 无UA访问 /sub (应该被拒绝) ........................... ✓ 通过
测试2: 错误UA访问 /sub (应该被拒绝) ........................ ✓ 通过
测试3: 正确UA访问 /sub (应该成功) .......................... ✓ 通过
测试4: 访问记录持久性 (模拟Clash定期刷新节点) ............. ✓ 通过
测试5: 二次访问验证 (先/sub后/provider) ................... ✓ 通过
测试6: 大小写混合UA (Clash/clash都应该通过) ............... ✓ 通过
```

## 实现的功能

### 1. User-Agent检测 ✅
- 只允许UA包含"clash"或"Clash"的请求
- 大小写不敏感
- 拒绝QQ预览爬虫、浏览器等其他UA

### 2. 二次访问验证机制 ✅
- Clash客户端首次导入订阅时会依次访问 `/sub` 和 `/provider`
- 只有当两个接口都被访问后,才会绑定IP
- QQ预览只会访问一次链接,不会触发IP绑定

### 3. 访问记录持久性 ✅
- 访问记录在内存中保留5分钟
- 支持Clash定期刷新节点的场景(只访问/provider)
- 5分钟后自动清理过期记录,释放内存

## 代码变更总结

### 新增文件
- `src/services/accessTracker.js` - 访问追踪服务

### 修改文件
- `src/routes/sub.js` - 添加UA检测,记录访问但不绑定IP
- `src/routes/provider.js` - 添加UA检测和二次访问验证,完成二次访问后绑定IP
- `src/db/index.js` - 修复数据库路径以适配monorepo架构
- `src/app.js` - 修复.env文件加载路径以适配monorepo架构

### 测试文件
- `test-anti-qq.sh` - 自动化测试脚本,包含6个测试用例

## 工作原理

### 防御QQ预览的流程

```
QQ预览爬虫访问:
1. GET /sub?token=xxx (UA: QQBot)
2. 服务器检测UA不包含"clash"
3. 返回403拒绝
4. ✅ Token未被消费

Clash客户端访问:
1. GET /sub?token=xxx (UA: clash)
   - 检测UA通过
   - 记录访问:sub=true
   - 返回配置,但不绑定IP
2. GET /provider?token=xxx (UA: clash)
   - 检测UA通过
   - 记录访问:provider=true
   - 检测到二次访问完成
   - 绑定IP并返回节点列表
3. ✅ Token正常使用,IP已绑定

Clash定期刷新节点(5分钟内):
1. GET /provider?token=xxx (UA: clash)
   - 检测UA通过
   - 访问记录仍在(sub=true, provider=true)
   - 检测到二次访问已完成
   - 返回节点列表
2. ✅ 正常刷新,无需再次访问/sub
```

## 使用说明

### 运行测试
```bash
cd /Users/claude/PersonalProject/CloakGate
npm run dev:js

# 在另一个终端
cd packages/javascript-package
./test-anti-qq.sh
```

### 测试订阅链接
```bash
# 使用正确的UA
curl -H "User-Agent: clash" "http://localhost:3000/sub?token=YOUR_TOKEN"

# 错误的UA会被拒绝
curl "http://localhost:3000/sub?token=YOUR_TOKEN"  # 返回403
```

### 在Clash中测试
1. 复制订阅链接: `http://localhost:3000/sub?token=YOUR_TOKEN`
2. 在Clash客户端中导入订阅
3. 检查是否能正常获取节点
4. 查看数据库确认IP已绑定:
   ```bash
   sqlite3 data/cloakgate.db "SELECT * FROM ip_bindings WHERE token='YOUR_TOKEN';"
   ```

### 在QQ中测试
1. 在QQ中发送订阅链接
2. 观察是否触发预览
3. 检查服务器日志,应该看到UA检测失败的记录
4. 查看数据库确认token未被绑定

## 注意事项

### ⚠️ 访问记录有效期
- 访问记录在内存中保留**5分钟**
- 5分钟后会自动清理,用户需要重新完成二次访问
- 对于正常使用的Clash客户端,5分钟的时间窗口足够

### ⚠️ 测试时需要注意
- 使用curl测试时必须设置正确的UA
- 访问记录是全局的,同一个token的记录会影响后续测试
- 如果需要模拟"首次访问"场景,需要等待5分钟或重启服务器

### ⚠️ 生产环境部署
- 确保.env文件配置正确
- 数据库路径已适配monorepo架构
- 建议在真实环境中测试QQ分享链接的行为

## 下一步

1. ✅ 所有测试通过
2. ✅ 代码已提交到Git
3. 🔲 在真实Clash客户端中测试
4. 🔲 在QQ中测试分享链接
5. 🔲 部署到生产环境

## 总结

防QQ预览机制已成功实现!通过**User-Agent检测**和**二次访问验证**两层防护,有效防止了QQ链接预览消费token的问题,同时不影响Clash客户端的正常使用。
