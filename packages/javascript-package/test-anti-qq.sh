#!/bin/bash

# 防QQ预览机制测试脚本
# 测试UA检测和二次访问验证功能

echo "=========================================="
echo "防QQ预览机制测试"
echo "=========================================="
echo ""

# 配置
BASE_URL="http://localhost:3000"

# 从数据库获取一个有效的token
VALID_TOKEN=$(sqlite3 ../../data/cloakgate.db "SELECT token FROM subscriptions WHERE status='active' LIMIT 1;" 2>/dev/null)

if [ -z "$VALID_TOKEN" ]; then
  echo "错误: 数据库中没有有效的token,请先创建一个订阅"
  echo "可以使用: cd packages/javascript-package && node scripts/create-token.js"
  exit 1
fi

echo "使用Token: ${VALID_TOKEN:0:16}..."
echo ""

# 测试1: 无UA访问 /sub - 应该被拒绝
echo "测试1: 无UA访问 /sub (应该被拒绝)"
echo "----------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BASE_URL/sub?token=$VALID_TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
echo "HTTP状态码: $HTTP_CODE"
if [ "$HTTP_CODE" = "403" ]; then
  echo "✓ 通过: 正确拒绝了无UA的请求"
else
  echo "✗ 失败: 应该返回403,实际返回$HTTP_CODE"
fi
echo ""

# 测试2: 错误UA访问 /sub - 应该被拒绝
echo "测试2: 错误UA访问 /sub (应该被拒绝)"
echo "----------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -H "User-Agent: Mozilla/5.0" "$BASE_URL/sub?token=$VALID_TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
echo "HTTP状态码: $HTTP_CODE"
if [ "$HTTP_CODE" = "403" ]; then
  echo "✓ 通过: 正确拒绝了非Clash UA的请求"
else
  echo "✗ 失败: 应该返回403,实际返回$HTTP_CODE"
fi
echo ""

# 测试3: 正确UA访问 /sub - 应该成功
echo "测试3: 正确UA访问 /sub (应该成功)"
echo "----------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -H "User-Agent: clash" "$BASE_URL/sub?token=$VALID_TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
echo "HTTP状态码: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ 通过: 正确允许了Clash UA的请求"
else
  echo "✗ 失败: 应该返回200,实际返回$HTTP_CODE"
fi
echo ""

# 测试4: 访问记录持久性测试
# 说明: 在测试3中已经访问了/sub,访问记录会保留5分钟
# 在这个时间窗口内,直接访问/provider应该成功(模拟Clash定期刷新节点)
echo "测试4: 访问记录持久性 (已访问/sub,直接访问/provider应该成功)"
echo "----------------------------------------"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -H "User-Agent: clash" "$BASE_URL/provider?token=$VALID_TOKEN")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
echo "HTTP状态码: $HTTP_CODE"
if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ 通过: 访问记录持久性正常,5分钟内可直接访问provider"
else
  echo "✗ 失败: 应该返回200,实际返回$HTTP_CODE"
fi
echo ""

# 测试5: 先访问 /sub 再访问 /provider - 应该成功
echo "测试5: 二次访问验证 (先/sub后/provider,应该成功)"
echo "----------------------------------------"

echo "  步骤1: 访问 /sub"
RESPONSE1=$(curl -s -w "\nHTTP_CODE:%{http_code}" -H "User-Agent: clash" "$BASE_URL/sub?token=$VALID_TOKEN")
HTTP_CODE1=$(echo "$RESPONSE1" | grep "HTTP_CODE" | cut -d: -f2)
echo "  /sub HTTP状态码: $HTTP_CODE1"

echo "  步骤2: 访问 /provider"
RESPONSE2=$(curl -s -w "\nHTTP_CODE:%{http_code}" -H "User-Agent: clash" "$BASE_URL/provider?token=$VALID_TOKEN")
HTTP_CODE2=$(echo "$RESPONSE2" | grep "HTTP_CODE" | cut -d: -f2)
echo "  /provider HTTP状态码: $HTTP_CODE2"

if [ "$HTTP_CODE1" = "200" ] && [ "$HTTP_CODE2" = "200" ]; then
  echo "✓ 通过: 二次访问验证成功"
else
  echo "✗ 失败: /sub应该返回200(实际$HTTP_CODE1), /provider应该返回200(实际$HTTP_CODE2)"
fi
echo ""

# 测试6: 大小写混合的UA - 应该成功
echo "测试6: 大小写混合UA (Clash/clash都应该通过)"
echo "----------------------------------------"

echo "  测试 'Clash' (大写C)"
RESPONSE1=$(curl -s -w "\nHTTP_CODE:%{http_code}" -H "User-Agent: Clash" "$BASE_URL/sub?token=$VALID_TOKEN")
HTTP_CODE1=$(echo "$RESPONSE1" | grep "HTTP_CODE" | cut -d: -f2)
echo "  HTTP状态码: $HTTP_CODE1"

echo "  测试 'clash' (小写c)"
RESPONSE2=$(curl -s -w "\nHTTP_CODE:%{http_code}" -H "User-Agent: clash" "$BASE_URL/sub?token=$VALID_TOKEN")
HTTP_CODE2=$(echo "$RESPONSE2" | grep "HTTP_CODE" | cut -d: -f2)
echo "  HTTP状态码: $HTTP_CODE2"

if [ "$HTTP_CODE1" = "200" ] && [ "$HTTP_CODE2" = "200" ]; then
  echo "✓ 通过: 大小写不敏感检测正常"
else
  echo "✗ 失败: Clash应该返回200(实际$HTTP_CODE1), clash应该返回200(实际$HTTP_CODE2)"
fi
echo ""

echo "=========================================="
echo "测试完成"
echo "=========================================="
