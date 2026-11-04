// 云函数：switchClass —— 多班老师切换「当前班级」
// 现有十几个老师端接口都只读 users.classId，所以只要把当前班切对，其它接口无需改动。
// 只允许切到自己 classIds 里的班，不能越权看别的班。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function memberIds(user) {
  const arr = Array.isArray(user.classIds) ? user.classIds.filter(Boolean) : [];
  if (user.classId && arr.indexOf(user.classId) === -1) arr.push(user.classId);
  return arr;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: '未登录' };

  const classId = String(event.classId || '');
  if (!classId) return { ok: false, msg: '参数错误' };

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];
  if (user.role !== 'teacher') return { ok: false, msg: '仅老师可切换班级' };

  const ids = memberIds(user);
  if (ids.indexOf(classId) === -1) return { ok: false, msg: '你不在该班级中' };

  const c = await db.collection('classes').doc(classId).get().catch(() => null);
  if (!c || !c.data) return { ok: false, msg: '班级不存在或已解散' };

  const className = c.data.name || '';
  await db.collection('users').doc(user._id).update({
    // 顺手补上 classIds：老账号只有 classId，切一次班就升级成数组格式
    data: { classId, className, classIds: ids }
  });

  return { ok: true, classId, className };
};
