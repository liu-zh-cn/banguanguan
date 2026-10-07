// 云函数：sendBroadcast —— 老师发送广播，班级一律以服务端记录为准（按班级隔离大屏）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const text = (event.text || '').trim();
  if (!text) return { ok: false, msg: '内容不能为空' };

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];

  // 角色以服务端 users 表为准，学生不可往大屏推消息
  if (user.role !== 'teacher') return { ok: false, msg: '仅老师可发送广播' };

  // 目标班级只取发送者自己的班级：不接受前端传 classId，避免给别的班大屏推消息
  const classId = user.classId || '';
  if (!classId) return { ok: false, msg: '请先创建班级' };
  const className = user.className || '';

  const add = await db.collection('broadcasts').add({
    data: {
      text,
      classId,
      className,
      from: OPENID || '',
      ts: Date.now(),
      createdAt: db.serverDate()
    }
  });
  return { ok: true, id: add._id, classId };
};
