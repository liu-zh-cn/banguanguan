// 云函数：joinClass —— 学生凭邀请码加入班级
// 带失败次数限流：同一 openid 10 分钟内错 5 次锁定 15 分钟，防止邀请码被暴力枚举
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const guard = require('./_invite-guard');

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: '未登录' };

  const code = (event.inviteCode || '').trim().toUpperCase();
  if (!code) return { ok: false, msg: '请输入邀请码' };

  const gate = await guard.allowed(cloud, OPENID);
  if (!gate.ok) return gate;

  const res = await db.collection('classes').where({ inviteCode: code }).limit(1).get();
  if (!res.data.length) {
    await guard.failed(cloud, OPENID);
    return { ok: false, msg: '邀请码无效' };
  }
  const cls = res.data[0];
  await guard.passed(cloud, OPENID);

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '请先注册' };
  const user = u.data[0];

  // 已在该班，直接返回，不重复计数
  const oldClassId = user.classId || '';
  if (oldClassId === cls._id) {
    return { ok: true, classId: cls._id, className: cls.name };
  }

  await db.collection('users').doc(user._id).update({
    data: { classId: cls._id, className: cls.name, role: 'student' }
  });
  await db.collection('classes').doc(cls._id).update({
    data: { studentCount: _.inc(1) }
  });
  // 换班时旧班人数要减回去，否则 studentCount 只增不减、越用越虚
  if (oldClassId) {
    await db
      .collection('classes')
      .doc(oldClassId)
      .update({ data: { studentCount: _.inc(-1) } })
      .catch(() => null); // 旧班可能已被删除，不阻断加入流程
  }

  return { ok: true, classId: cls._id, className: cls.name };
};
