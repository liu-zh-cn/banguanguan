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
  // 白名单字段下发：原始文档里的 teacherOpenid / studentOpenid / classId 不下发，
  // 与 myClass 对学生隐藏 openid 的约定保持一致
  const list = (res.data || []).map((d) => ({
    _id: d._id,
    type: d.type,
    content: d.content,
    subject: d.subject,
    teacherName: d.teacherName,
    studentName: d.studentName,
    reply: d.reply || '',
    replyTs: d.replyTs || 0,
    ts: d.ts
  }));
  return { ok: true, role: user.role, list };
};
