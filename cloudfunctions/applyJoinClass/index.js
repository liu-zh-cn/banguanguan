// 云函数：applyJoinClass —— 老师凭邀请码申请加入别人的班级
// 只写"待审核"状态，不碰 classId：班主任同意前，申请人读不到这个班的任何数据。
// 邀请码校验沿用 _invite-guard.js（与 joinClass / getBroadcast 同一套失败限流）。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const guard = require('./_invite-guard');

const MAX_CLASSES = 10;

// classIds 是成员资格；老数据只有 classId，这里统一成数组再判断
function memberIds(user) {
  const arr = Array.isArray(user.classIds) ? user.classIds.filter(Boolean) : [];
  if (user.classId && arr.indexOf(user.classId) === -1) arr.push(user.classId);
  return arr;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: '未登录' };

  const code = String(event.inviteCode || '').trim().toUpperCase();
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
  if (user.role !== 'teacher') return { ok: false, msg: '仅老师可申请加入班级' };

  const ids = memberIds(user);
  if (ids.indexOf(cls._id) > -1) return { ok: false, msg: '你已在该班级中，无需重复申请' };
  if (cls.ownerOpenid === OPENID) return { ok: false, msg: '你是该班班主任，无需申请' };
  if (ids.length >= MAX_CLASSES) {
    return { ok: false, msg: '最多加入 ' + MAX_CLASSES + ' 个班级，请先退出其他班级' };
  }

  // 同一时间只保留一个待审申请：重复申请会覆盖上一条，由班主任在班级页看到最新状态
  await db.collection('users').doc(user._id).update({
    data: {
      applyClassId: cls._id,
      applyClassName: cls.name || '',
      applyTs: Date.now()
    }
  });

  return { ok: true, pending: true, classId: cls._id, className: cls.name || '' };
};
