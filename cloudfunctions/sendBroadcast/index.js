// 云函数：sendBroadcast —— 老师发送广播，自动带上其所在班级（按班级隔离大屏）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const text = (event.text || '').trim();
  if (!text) return { ok: false, msg: '内容不能为空' };

  // 以服务端记录为准：查发送者所在班级
  let classId = '';
  let className = '';
  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (u.data.length) {
    classId = u.data[0].classId || '';
    className = u.data[0].className || '';
  }
  // 允许前端显式指定（如校长/公共广播），否则用发送者班级
  if (event.classId) classId = event.classId;

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
