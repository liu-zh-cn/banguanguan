// 云函数：getClassByCode —— 大屏凭班级邀请码解析出 classId（只读，不改变用户身份）
// 带失败次数限流：同一 openid 10 分钟内错 5 次锁定 15 分钟，防止邀请码被暴力枚举
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const guard = require('./_invite-guard');

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const code = (event.inviteCode || '').trim().toUpperCase();
  if (!code) return { ok: false, msg: '请输入邀请码' };

  // 先看有没有被锁定，锁定期间直接拒绝，省一次数据库查询
  const gate = await guard.allowed(cloud, OPENID);
  if (!gate.ok) return gate;

  const res = await db.collection('classes').where({ inviteCode: code }).limit(1).get();
  if (!res.data.length) {
    await guard.failed(cloud, OPENID);
    return { ok: false, msg: '邀请码无效，找不到班级' };
  }

  await guard.passed(cloud, OPENID);
  const c = res.data[0];
  return { ok: true, classId: c._id, className: c.name };
};
