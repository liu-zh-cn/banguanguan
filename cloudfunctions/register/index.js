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

  const data = {
    openid: OPENID,
    role: role || 'teacher',
    name,
    className: className || '',
    subject: subject || '',
    studentNo: studentNo || '',
    createdAt: db.serverDate(),
    updatedAt: db.serverDate()
  };

  const exist = await users.where({ openid: OPENID }).limit(1).get();
  if (exist.data && exist.data.length) {
    delete data.openid; // 不覆盖唯一标识
    await users.doc(exist.data[0]._id).update({ data });
    return { ok: true, userId: exist.data[0]._id, ...data };
  }

  const add = await users.add({ data });
  return { ok: true, userId: add._id, ...data };
};
