// 云函数：assignHomework —— 老师布置作业（写入本班 homeworks）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { subject, title, content, deadline } = event;
  if (!title || !title.trim()) return { ok: false, msg: '请填写作业标题' };

  let classId = '';
  let className = '';
  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (u.data.length) {
    classId = u.data[0].classId || '';
    className = u.data[0].className || '';
  }
  if (!classId) return { ok: false, msg: '请先创建班级' };

  const add = await db.collection('homeworks').add({
    data: {
      classId,
      className,
      subject: subject || '',
      title: title.trim(),
      content: content || '',
      deadline: deadline || '',
      teacherOpenid: OPENID,
      ts: Date.now(),
      createdAt: db.serverDate()
    }
  });
  return { ok: true, id: add._id };
};
