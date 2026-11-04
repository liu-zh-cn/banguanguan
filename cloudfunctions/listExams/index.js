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
  // 删除考试是班主任专属：把身份一并下发，前端据此隐藏删除入口（服务端 deleteExam 还会再拦）
  let isOwner = false;
  if (isTeacher) {
    const c = await db.collection('classes').doc(classId).get().catch(() => null);
    isOwner = !!(c && c.data && c.data.ownerOpenid === OPENID);
  }
  const where = isTeacher ? { classId } : { classId, published: true };
  // 分页拉全：limit(50) 会让第 51 场以后的考试静默消失
  const PAGE = 50;
  const MAX_EXAMS = 500;
  const exams = [];
  for (let skip = 0; skip < MAX_EXAMS; skip += PAGE) {
    const res = await db
      .collection('exams')
      .where(where)
      .orderBy('ts', 'desc')
      .skip(skip)
      .limit(PAGE)
      .get();
    (res.data || []).forEach((e) => exams.push(e));
    if (!res.data || res.data.length < PAGE) break;
  }
  const truncated = exams.length >= MAX_EXAMS;

  // 老考试记录没有 fullScore，统一按 100 分兜底，前端不用再判空
  exams.forEach((e) => {
    const f = Number(e.fullScore);
    e.fullScore = f > 0 ? f : 100;
  });

  // 老师的列表附带平均分（所有学生、所有科目的均分）
  if (isTeacher && exams.length) {
    const ids = exams.map((e) => e._id);
    const map = {};
    // _.in 数组有长度上限，单次 get 也最多 1000 条：
    // 按 10 场考试一批、批内再分页，否则考试一多平均分和成绩条数都会算错
    for (let i = 0; i < ids.length; i += 10) {
      const part = ids.slice(i, i + 10);
      for (let skip = 0; ; skip += 1000) {
        const s = await db
          .collection('scores')
          .where({ examId: _.in(part) })
          .skip(skip)
          .limit(1000)
          .get();
        (s.data || []).forEach((doc) => {
          map[doc.examId] = map[doc.examId] || [];
          map[doc.examId].push(doc);
        });
        if (!s.data || s.data.length < 1000) break;
      }
    }
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
      // 录了几条分数。前端不能靠 avg 判断"有没有录成绩"：平均分就是 0 分时会被误判
      e.scoreCount = cnt;
    });
  }

  return { ok: true, list: exams, role: user.role, truncated, isOwner };
};
