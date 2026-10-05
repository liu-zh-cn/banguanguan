// 云函数：sendBroadcast —— 老师发送一条广播消息到大屏
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const text = (event.text || '').trim();
  if (!text) return { ok: false, msg: '内容不能为空' };

  const add = await db.collection('broadcasts').add({
    data: {
      text,
      from: OPENID || '',
      ts: Date.now(),
      createdAt: db.serverDate()
    }
  });
  return { ok: true, id: add._id };
};
