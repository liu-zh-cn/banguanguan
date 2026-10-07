// 云函数：addReview —— 老师给学生写点评
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const TYPES = ['表扬', '进步', '建议'];

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { studentOpenid } = event;
  const content = (event.content || '').trim();
  if (!studentOpenid) return { ok: false, msg: '参数错误' };
  if (!content) return { ok: false, msg: '点评内容不能为空' };

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];
  // 角色以服务端 users 表为准，学生不可伪造老师点评
  if (user.role !== 'teacher') return { ok: false, msg: '仅老师可写点评' };
  if (!user.classId) return { ok: false, msg: '请先创建班级' };

  const s = await db
    .collection('users')
    .where({ openid: studentOpenid, classId: user.classId })
    .limit(1)
    .get();
  if (!s.data.length) return { ok: false, msg: '该学生不在你的班级' };
  const stu = s.data[0];

  const type = TYPES.indexOf(event.type) > -1 ? event.type : '表扬';
  const add = await db.collection('reviews').add({
    data: {
      classId: user.classId,
      studentOpenid,
      studentName: stu.name || '',
      teacherOpenid: OPENID,
      teacherName: user.name || '老师',
      subject: user.subject || '综合',
      type,
      content,
      ts: Date.now(),
      createdAt: db.serverDate()
    }
  });
  return { ok: true, id: add._id };
};
