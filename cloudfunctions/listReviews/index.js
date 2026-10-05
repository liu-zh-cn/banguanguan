// 云函数：listReviews —— 学生看我收到的点评；老师看我写过的点评
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];

  const where = user.role === 'teacher' ? { teacherOpenid: OPENID } : { studentOpenid: OPENID };
  const res = await db.collection('reviews').where(where).orderBy('ts', 'desc').limit(100).get();
  return { ok: true, role: user.role, list: res.data || [] };
};
