#!/usr/bin/env node
// 创建测试 Token 脚本

import { createToken } from '../src/services/tokenService.js';

const token = createToken({
  remark: '测试用 Token',
  nodeProfile: 'default'
});

console.log('='.repeat(50));
console.log('创建 Token 成功!');
console.log('='.repeat(50));
console.log('Token:', token.token);
console.log('备注:', token.remark);
console.log('节点配置:', token.nodeProfile);
console.log('='.repeat(50));
console.log('');
console.log('测试订阅链接:');
console.log(`http://localhost:9007/sub?token=${token.token}`);
console.log('');
