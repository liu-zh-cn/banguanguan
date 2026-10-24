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
    const raw = (c && c.data) || null;
    if (raw) {
      cls = { ...raw };
      // 邀请码 / 创建者 openid 只对老师下发。
      // 学生拿到邀请码等于能无限拉人进班，拿到 ownerOpenid 也没有任何用处。
      if (user.role !== 'teacher') {
        delete cls.inviteCode;
        delete cls.ownerOpenid;
      }
    } else {
      // 班级已不存在（比如被直接在数据库里删除）：清理悬空的 classId / className，
      // 否则各页面会一直显示这个已删除的"幽灵班级"
      await db
        .collection('users')
        .doc(user._id)
        .update({ data: { classId: '', className: '' } })
        .catch(() => {});
      user.classId = '';
      user.className = '';
    }

    // 学生名单含全班同学的 openid / 姓名 / 学号 / 电话，只下发给老师。
    // 学生端只需要 class.name 和 user，拿到名单属于越权读取他人信息。
    if (user.role === 'teacher') {
      const s = await db
        .collection('users')
        .where({ classId: user.classId, role: 'student' })
        .limit(200)
        .get();
      students = s.data || [];
    }
  }

  return { ok: true, user, class: cls, students };
};
