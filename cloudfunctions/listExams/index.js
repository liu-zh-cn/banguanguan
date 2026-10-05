// 云函数：listExams —— 列出本班考试；老师看全部（附平均分），学生只看已发布
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];
  const classId = user.classId || '';
  if (!classId) return { ok: true, list: [], role: user.role };

  const isTeacher = user.role === 'teacher';
  const where = isTeacher ? { classId } : { classId, published: true };
  const res = await db.collection('exams').where(where).orderBy('ts', 'desc').limit(50).get();
  const exams = res.data || [];

  // 老师的列表附带平均分（所有学生、所有科目的均分）
  if (isTeacher && exams.length) {
    const ids = exams.map((e) => e._id);
    const s = await db.collection('scores').where({ examId: _.in(ids) }).limit(1000).get();
    const map = {};
    (s.data || []).forEach((doc) => {
      map[doc.examId] = map[doc.examId] || [];
      map[doc.examId].push(doc);
    });
    exams.forEach((e) => {
      let sum = 0;
      let cnt = 0;
      (map[e._id] || []).forEach((d) => {
        Object.values(d.scores || {}).forEach((v) => {
          if (typeof v === 'number') {
            sum += v;
            cnt++;
          }
        });
      });
      e.avg = cnt ? Number((sum / cnt).toFixed(1)) : 0;
    });
  }

  return { ok: true, list: exams, role: user.role };
};
