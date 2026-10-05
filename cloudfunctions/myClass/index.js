// 云函数：myClass —— 返回当前用户的资料、所在班级、以及班里的学生名单
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: '未登录' };

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  const user = u.data[0] || null;

  let cls = null;
  let students = [];
  if (user && user.classId) {
    const c = await db.collection('classes').doc(user.classId).get().catch(() => null);
    cls = c && c.data ? c.data : null;
    const s = await db
      .collection('users')
      .where({ classId: user.classId, role: 'student' })
      .limit(200)
      .get();
    students = s.data || [];
  }

  return { ok: true, user, class: cls, students };
};
