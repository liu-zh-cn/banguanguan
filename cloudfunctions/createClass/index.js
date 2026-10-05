// 云函数：createClass —— 老师创建班级，生成邀请码，并把班级绑定到该老师
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: '未登录' };

  const { name, grade, motto, studentCount } = event;
  if (!name) return { ok: false, msg: '班级名称不能为空' };

  const inviteCode = genCode();
  const add = await db.collection('classes').add({
    data: {
      name,
      grade: grade || '',
      motto: motto || '',
      inviteCode,
      ownerOpenid: OPENID,
      studentCount: Number(studentCount) || 0,
      createdAt: db.serverDate()
    }
  });

  // 把班级绑定到当前老师
  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (u.data.length) {
    await db.collection('users').doc(u.data[0]._id).update({
      data: { classId: add._id, className: name, role: 'teacher' }
    });
  }

  return { ok: true, classId: add._id, inviteCode, name };
};
