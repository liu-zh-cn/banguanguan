// 云函数：register —— 用 openid 作为唯一键，写入/更新用户资料
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const users = db.collection('users');

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: '未获取到 openid' };

  const { role, name, className, subject, studentNo } = event;
  if (!name) return { ok: false, msg: '姓名不能为空' };

  const exist = await users.where({ openid: OPENID }).limit(1).get();
  const hasUser = !!(exist.data && exist.data.length);

  // 身份规则（服务端说了算，前端传的 role 只作为首次注册的初始值）：
  // 1. 已是学生的，永远保持学生，防止重新调用 register 把自己提成老师；
  // 2. 已有身份的，register 不改 role，只更新资料；
  // 3. 首次注册按前端选择，未传时默认老师。
  const finalRole = hasUser
    ? (exist.data[0].role === 'student' ? 'student' : (exist.data[0].role || 'teacher'))
    : (role || 'teacher');

  const data = {
    role: finalRole,
    name,
    className: className || '',
    subject: subject || '',
    studentNo: studentNo || '',
    updatedAt: db.serverDate()
  };

  if (hasUser) {
    await users.doc(exist.data[0]._id).update({ data });
    return { ok: true, userId: exist.data[0]._id, role: finalRole, ...data };
  }

  // 首次注册才写 openid 与创建时间
  const add = await users.add({
    data: { ...data, openid: OPENID, createdAt: db.serverDate() }
  });
  return { ok: true, userId: add._id, role: finalRole, ...data };
};
