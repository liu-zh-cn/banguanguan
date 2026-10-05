// 云函数：joinClass —— 学生凭邀请码加入班级
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: '未登录' };

  const code = (event.inviteCode || '').trim().toUpperCase();
  if (!code) return { ok: false, msg: '请输入邀请码' };

  const res = await db.collection('classes').where({ inviteCode: code }).limit(1).get();
  if (!res.data.length) return { ok: false, msg: '邀请码无效' };
  const cls = res.data[0];

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '请先注册' };
  const user = u.data[0];

  // 已在该班，直接返回，不重复计数
  if (user.classId === cls._id) {
    return { ok: true, classId: cls._id, className: cls.name };
  }

  await db.collection('users').doc(user._id).update({
    data: { classId: cls._id, className: cls.name, role: 'student' }
  });
  await db.collection('classes').doc(cls._id).update({
    data: { studentCount: _.inc(1) }
  });

  return { ok: true, classId: cls._id, className: cls.name };
};
