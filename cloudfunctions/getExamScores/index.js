// 云函数：getExamScores —— 老师打开「录入成绩」页：返回考试信息 + 学生名单 + 已录成绩
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { examId } = event;
  if (!examId) return { ok: false, msg: '参数错误' };

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];
  // 这里返回全班学生的成绩，属于老师端数据，学生不可读
  if (user.role !== 'teacher') return { ok: false, msg: '仅老师可查看班级成绩' };

  const e = await db.collection('exams').doc(examId).get().catch(() => null);
  if (!e || !e.data) return { ok: false, msg: '考试不存在' };
  if (e.data.classId !== user.classId) return { ok: false, msg: '无权查看' };

  const s = await db
    .collection('users')
    .where({ classId: user.classId, role: 'student' })
    .limit(200)
    .get();
  const students = (s.data || []).map((x, i) => ({
    openid: x.openid,
    name: x.name || '未命名',
    no: x.studentNo || String(i + 1).padStart(2, '0')
  }));

  const sc = await db.collection('scores').where({ examId }).limit(1000).get();
  const scores = {};
  (sc.data || []).forEach((d) => {
    scores[d.studentOpenid] = d.scores || {};
  });

  return {
    ok: true,
    exam: {
      name: e.data.name,
      date: e.data.date || '',
      subjects: e.data.subjects || []
    },
    students,
    scores
  };
};
