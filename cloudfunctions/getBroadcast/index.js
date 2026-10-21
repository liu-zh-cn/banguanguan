// 云函数：getBroadcast —— 大屏凭邀请码取本班最新一条广播
// 为什么要走云函数：broadcasts 集合若设为「所有用户可读」，任何人都能读全部班级的广播；
// 改为「仅创建者可读写」后前端不再直连数据库，只有本云函数（管理权限）能读。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const code = (event.inviteCode || '').trim().toUpperCase();
  if (!code) return { ok: false, msg: '缺少邀请码' };

  const c = await db.collection('classes').where({ inviteCode: code }).limit(1).get();
  if (!c.data.length) return { ok: false, msg: '邀请码无效' };
  const cls = c.data[0];

  const b = await db
    .collection('broadcasts')
    .where({ classId: cls._id })
    .orderBy('ts', 'desc')
    .limit(1)
    .get();

  const doc = (b.data || [])[0] || null;
  return {
    ok: true,
    className: cls.name || '',
    // 只回传大屏需要的两个字段，不回传 openid 等发送者信息
    broadcast: doc ? { ts: doc.ts || 0, text: doc.text || '' } : null
  };
};
