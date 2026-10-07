// 云函数：classStats —— 老师数据看板：总览 + 四张图 + 每位学生最新均分
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function mean(arr) {
  if (!arr.length) return 0;
  return Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1));
}

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];
  // 数据看板是老师端功能：总览与全班分布不对学生开放
  if (user.role !== 'teacher') return { ok: false, msg: '仅老师可查看班级数据' };
  const classId = user.classId || '';

  let studentCount = 0;
  if (classId) {
    const cnt = await db.collection('users').where({ classId, role: 'student' }).count();
    studentCount = cnt.total || 0;
  }

  // 没有班级 / 考试 / 成绩时的统一空返回
  const empty = {
    ok: true,
    hasData: false,
    overview: { studentCount, avgScore: '—', excellentRate: '—', passRate: '—' },
    subjectAvg: { labels: [], values: [], max: 100 },
    trend: { labels: [], values: [] },
    dist: { items: [] },
    radar: { labels: [], values: [], max: 100 },
    fullScore: 100,
    studentLatest: {}
  };
  if (!classId) return empty;

  const ex = await db.collection('exams').where({ classId }).orderBy('ts', 'asc').limit(50).get();
  const exams = ex.data || [];
  if (!exams.length) return empty;

  const sc = await db.collection('scores').where({ classId }).limit(5000).get();
  const docs = sc.data || [];
  if (!docs.length) return empty;

  // 按考试分组
  const byExam = {};
  docs.forEach((d) => {
    byExam[d.examId] = byExam[d.examId] || [];
    byExam[d.examId].push(d);
  });

  const latest = exams[exams.length - 1]; // ts 升序，最后一条就是最新
  const latestDocs = byExam[latest._id] || [];
  // 优秀 / 及格线按试卷满分等比换算：100 分卷为 90 / 60，150 分卷为 135 / 90
  const fullScore = Number(latest.fullScore) > 0 ? Number(latest.fullScore) : 100;
  const excellentLine = fullScore === 100 ? 90 : Math.round(fullScore * 0.9);
  const passLine = fullScore === 100 ? 60 : Math.round(fullScore * 0.6);

  // 最近一次考试：每位学生的均分 → 总览 + 分布 + class 页的「最新分」
  const studentLatest = {};
  latestDocs.forEach((d) => {
    const vals = Object.values(d.scores || {}).filter((v) => typeof v === 'number');
    if (vals.length) studentLatest[d.studentOpenid] = mean(vals);
  });
  const stuAvgs = Object.values(studentLatest);
  const allVals = [];
  latestDocs.forEach((d) => {
    Object.values(d.scores || {}).forEach((v) => {
      if (typeof v === 'number') allVals.push(v);
    });
  });

  const overview = {
    studentCount,
    avgScore: allVals.length ? mean(allVals) : '—',
    excellentRate: stuAvgs.length ? Math.round((stuAvgs.filter((v) => v >= excellentLine).length / stuAvgs.length) * 100) : '—',
    passRate: stuAvgs.length ? Math.round((stuAvgs.filter((v) => v >= passLine).length / stuAvgs.length) * 100) : '—'
  };

  // 柱状图：最近一次考试各科均分（纵轴按满分）
  const subjectAvg = { labels: [], values: [], max: fullScore };
  (latest.subjects || []).forEach((sub) => {
    const vals = latestDocs.map((d) => d.scores && d.scores[sub]).filter((v) => typeof v === 'number');
    if (vals.length) {
      subjectAvg.labels.push(sub);
      subjectAvg.values.push(mean(vals));
    }
  });

  // 折线图：每次考试的整体均分
  const trend = { labels: [], values: [] };
  exams.forEach((e) => {
    const vals = [];
    (byExam[e._id] || []).forEach((d) => {
      Object.values(d.scores || {}).forEach((v) => {
        if (typeof v === 'number') vals.push(v);
      });
    });
    if (vals.length) {
      trend.labels.push(e.name);
      trend.values.push(mean(vals));
    }
  });

  // 饼图：按学生均分段的成绩分布（分段线同样按满分换算）
  const goodLine = Math.round(fullScore * 0.8);
  const dist = {
    items: [
      { name: '优秀(≥' + excellentLine + ')', value: stuAvgs.filter((v) => v >= excellentLine).length, color: '#5B7CFF' },
      { name: '良好(' + goodLine + '-' + (excellentLine - 1) + ')', value: stuAvgs.filter((v) => v >= goodLine && v < excellentLine).length, color: '#24C8A0' },
      { name: '及格(' + passLine + '-' + (goodLine - 1) + ')', value: stuAvgs.filter((v) => v >= passLine && v < goodLine).length, color: '#FFB020' },
      { name: '不及格(<' + passLine + ')', value: stuAvgs.filter((v) => v < passLine).length, color: '#FF5A5F' }
    ]
  };

  return {
    ok: true,
    hasData: true,
    overview,
    subjectAvg,
    trend,
    dist,
    radar: subjectAvg, // 各科均分雷达（与柱状图同源）
    fullScore,
    studentLatest
  };
};
