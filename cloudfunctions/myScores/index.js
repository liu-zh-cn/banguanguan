// 云函数：myScores —— 学生查看自己某次（默认最近一次）已发布考试的成绩、班级均分与排名
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function mean(arr) {
  if (!arr.length) return 0;
  return Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1));
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];
  const classId = user.classId || '';
  if (!classId) return { ok: true, hasExam: false, exams: [] };

  // 已发布的考试（新→旧）
  const ex = await db
    .collection('exams')
    .where({ classId, published: true })
    .orderBy('ts', 'desc')
    .limit(50)
    .get();
  const exams = (ex.data || []).map((e) => ({
    _id: e._id,
    name: e.name,
    date: e.date || '',
    subjects: e.subjects || []
  }));
  if (!exams.length) return { ok: true, hasExam: false, exams: [] };

  const wantId = event.examId || '';
  const exam = exams.find((e) => e._id === wantId) || exams[0];

  // 本次考试的全体成绩
  const sc = await db.collection('scores').where({ examId: exam._id }).limit(1000).get();
  const docs = (sc.data || []).filter((d) => d.scores && typeof d.scores === 'object');

  const my = docs.find((d) => d.studentOpenid === OPENID);
  const myScores = (my && my.scores) || {};

  // 每科的班级均分与我我的排名；顺带算总分
  const rows = [];
  let myTotal = 0;
  exam.subjects.forEach((sub) => {
    const mine = myScores[sub];
    if (typeof mine !== 'number') return;
    const all = docs.map((d) => d.scores[sub]).filter((v) => typeof v === 'number');
    const classAvg = mean(all);
    const classRank = all.filter((v) => v > mine).length + 1;
    rows.push({ subject: sub, score: mine, classAvg, classRank });
    myTotal += mine;
  });

  // 总分排名（只在已出分的同学之间排）
  const totals = docs
    .map((d) => Object.values(d.scores).filter((v) => typeof v === 'number'))
    .filter((arr) => arr.length)
    .map((arr) => arr.reduce((a, b) => a + b, 0));
  const rank = my ? totals.filter((t) => t > myTotal).length + 1 : 0;

  return {
    ok: true,
    hasExam: true,
    exams,
    examId: exam._id,
    examName: exam.name,
    date: exam.date,
    rows,
    total: myTotal,
    avg: mean(rows.map((r) => r.score)),
    rank: my ? rank : 0
  };
};
