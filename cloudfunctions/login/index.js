// 云函数：login —— 获取 openid 并查询该用户是否已注册
const cloud = require('wx-server-sdk');

// 使用当前云开发环境
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async () => {
  // 核心：从云函数上下文中直接拿到用户 openid，无需前端传 code
  const { OPENID, APPID, UNIONID } = cloud.getWXContext();

  let user = null;
  if (OPENID) {
    const res = await db.collection('users').where({ openid: OPENID }).limit(1).get();
    if (res.data && res.data.length) user = res.data[0];
  }

  return {
    openid: OPENID,
    appid: APPID,
    unionid: UNIONID || '',
    user // 为 null 表示还没注册
  };
};
