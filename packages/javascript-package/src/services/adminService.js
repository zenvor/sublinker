// 管理员服务
// 处理管理员账号管理和认证

import bcrypt from 'bcryptjs';
import db from '../db/index.js';
import { adminConfig } from '../config/authConfig.js';

/**
 * 初始化管理员账号
 * 如果数据库中没有管理员，则创建一个默认管理员
 */
export async function initAdmin() {
  try {
    const row = db.prepare('SELECT count(*) as count FROM admins').get();
    
    if (row.count === 0) {
      console.log('检测到无管理员账号，正在初始化默认管理员...');
      
      const { username, password } = adminConfig;
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      const insert = db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)');
      insert.run(username, hashedPassword);
      
      console.log(`默认管理员已创建: ${username}`);
    }
  } catch (error) {
    console.error('初始化管理员账号失败:', error);
  }
}

/**
 * 验证管理员凭证
 * @param {string} username 用户名
 * @param {string} password 密码
 * @returns {Promise<boolean>} 是否验证通过
 */
export async function verifyCredentials(username, password) {
  const user = db.prepare('SELECT password FROM admins WHERE username = ?').get(username);
  
  if (!user) {
    return false;
  }
  
  return await bcrypt.compare(password, user.password);
}

/**
 * 修改管理员密码
 * @param {string} username 用户名
 * @param {string} newPassword 新密码
 * @returns {Promise<boolean>} 是否修改成功
 */
export async function changePassword(username, newPassword) {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    const result = db.prepare('UPDATE admins SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?')
      .run(hashedPassword, username);
      
    return result.changes > 0;
  } catch (error) {
    console.error('修改密码失败:', error);
    throw error;
  }
}
