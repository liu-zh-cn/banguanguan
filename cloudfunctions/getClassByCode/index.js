// 云函数：getClassByCode —— 大屏凭班级邀请码解析出 classId（只读，不改变用户身份）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const code = (event.inviteCode || '').trim().toUpperCase();
  if (!code) return { ok: false, msg: '请输入邀请码' };

  const res = await db.collection('classes').where({ inviteCode: code }).limit(1).get();
  if (!res.data.length) return { ok: false, msg: '邀请码无效，找不到班级' };
  const c = res.data[0];
  return { ok: true, classId: c._id, className: c.name };
};
