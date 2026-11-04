// 云函数：joinClass —— 学生凭邀请码加入班级
// 带失败次数限流：同一 openid 10 分钟内错 5 次锁定 15 分钟，防止邀请码被暴力枚举
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
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

  // 老师误调「加入班级」不应被降级成学生，也不该覆盖他已管理的班级
  if (user.role === 'teacher') {
    return { ok: false, msg: '老师请用「创建班级」页的申请加入，等班主任审核' };
  }

  // 已在该班，直接返回，不重复计数
  const oldClassId = user.classId || '';
  if (oldClassId === cls._id) {
    return { ok: true, classId: cls._id, className: cls.name };
  }

  await db.collection('users').doc(user._id).update({
    data: { classId: cls._id, className: cls.name, role: 'student' }
  });
  // 班级人数不再维护 studentCount 副本：页面统一按 users 表实时 count，
  // 避免转班/删号后计数只增不减，出现两套对不上的人数

  // 人数变化会影响数据看板，清掉缓存让下次进入重新计算
  await db.collection('class_stats').doc(cls._id).remove().catch(() => null);
  if (oldClassId) {
    await db.collection('class_stats').doc(oldClassId).remove().catch(() => null);
  }

  return { ok: true, classId: cls._id, className: cls.name };
};
