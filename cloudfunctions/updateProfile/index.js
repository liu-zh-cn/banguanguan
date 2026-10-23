// 云函数：updateProfile —— 更新当前用户的资料（服务端白名单，不改 openid / role / classId）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 允许修改的字段：按角色区分，其余字段一律过滤，防止前端提权或改归属班级
// 手机号只对老师开放：家长联系老师的场景才需要，学生手机号在本小程序里没有任何消费方
const ROLE_FIELDS = {
  teacher: ['name', 'gender', 'phone', 'title', 'subject', 'signature', 'className'],
  student: ['name', 'gender', 'studentNo', 'signature']
};

const MAX_LEN = 200;

function clean(v) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, MAX_LEN);
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: '未登录' };

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];
  // 与 register 保持一致：缺 role 的老记录按老师处理
  const role = user.role || 'teacher';

  // 手机号选填。传了非空值就要合法；传空字符串表示"删除该信息"，允许
  const phone = clean(event.phone);
  if (phone && !/^1\d{10}$/.test(phone)) return { ok: false, msg: '手机号格式不正确' };

  const name = clean(event.name);
  if (!name) return { ok: false, msg: '姓名不能为空' };

  // 关键：区分「没传这个字段」和「传了空字符串」
  //   没传     → 保持原值，不动（兼容老版本前端、避免误删）
  //   传空字符串 → 明确要求删除该信息（隐私政策承诺的"用户可自行修改或删除"）
  const has = (k) => Object.prototype.hasOwnProperty.call(event, k);

  const allow = ROLE_FIELDS[role] || ROLE_FIELDS.student;
  const data = { updatedAt: db.serverDate() };
  allow.forEach((k) => {
    if (!has(k)) return;
    // 姓名已在上面校验过非空，其余字段允许写空字符串以清空
    data[k] = k === 'name' ? name : clean(event[k]);
  });

  // 学生不收集手机号（白名单里已移除）。老数据里若存过，借这次保存一并清掉
  if (role === 'student' && user.phone) data.phone = '';

  await db.collection('users').doc(user._id).update({ data });

  // 老师改了班级名称时，同步 classes 集合，避免班级管理页显示旧名
  const newClassName = clean(event.className);
  if (role === 'teacher' && newClassName && user.classId && newClassName !== user.className) {
    await db
      .collection('classes')
      .doc(user.classId)
      .update({ data: { name: newClassName, updatedAt: db.serverDate() } })
      .catch(() => null); // 班级可能已被删除，不阻断资料保存
  }

  return {
    ok: true,
    role,
    name: data.name || user.name || '',
    className: data.className || user.className || ''
  };
};
