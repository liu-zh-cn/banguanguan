// 云函数：createExam —— 老师新建考试（本班），带考试科目列表
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const DEFAULT_SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物'];

// 北京时间的 YYYY-MM-DD（云函数环境时区是 UTC）
function todayStr() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const name = (event.name || '').trim();
  if (!name) return { ok: false, msg: '考试名称不能为空' };

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];
  if (!user.classId) return { ok: false, msg: '请先创建班级' };

  // 科目：去空、去重（云数据库字段名里不能带 . 和 $，一并过滤）；留空则用默认六科
  let subjects = (event.subjects || [])
    .map((s) => String(s).trim())
    .filter((s) => s && s.indexOf('.') === -1 && s.indexOf('$') === -1);
  subjects = subjects.filter((s, i) => subjects.indexOf(s) === i).slice(0, 12);
  if (!subjects.length) subjects = DEFAULT_SUBJECTS.slice();

  const add = await db.collection('exams').add({
    data: {
      classId: user.classId,
      className: user.className || '',
      name,
      date: todayStr(),
      subjects,
      published: false,
      teacherOpenid: OPENID,
      ts: Date.now(),
      createdAt: db.serverDate()
    }
  });
  return { ok: true, examId: add._id };
};
