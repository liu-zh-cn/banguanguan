// 云函数：assignHomework —— 老师布置作业（写入本班 homeworks）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { subject, title, content, deadline } = event;
  // String() 兜底：title 若被传成对象，!title.trim() 这步就抛未捕获异常了
  const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  const cleanTitle = clean(title, 100);
  const cleanContent = clean(content, 2000);
  if (!cleanTitle) return { ok: false, msg: '请填写作业标题' };

  let classId = '';
  let className = '';
  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (u.data.length) {
    // 角色以服务端 users 表为准，学生不可布置作业
    if (u.data[0].role !== 'teacher') return { ok: false, msg: '仅老师可布置作业' };
    classId = u.data[0].classId || '';
    className = u.data[0].className || '';
  }
  if (!classId) return { ok: false, msg: '请先创建班级' };

  const add = await db.collection('homeworks').add({
    data: {
      classId,
      className,
      subject: clean(subject, 50),
      title: cleanTitle,
      content: cleanContent,
      deadline: clean(deadline, 30),
      teacherOpenid: OPENID,
      ts: Date.now(),
      createdAt: db.serverDate()
    }
  });
  return { ok: true, id: add._id };
};
