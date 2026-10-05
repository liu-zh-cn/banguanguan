// 云函数：inputScores —— 老师录入某一科目的成绩（按 学生openid 逐条 upsert）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { examId, subject, items } = event;
  if (!examId || !subject || !Array.isArray(items)) return { ok: false, msg: '参数错误' };

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];

  const e = await db.collection('exams').doc(examId).get().catch(() => null);
  if (!e || !e.data) return { ok: false, msg: '考试不存在' };
  if (e.data.classId !== user.classId) return { ok: false, msg: '无权操作' };

  // 取出该考试已存在的成绩记录，按 openid 建索引
  const exist = await db.collection('scores').where({ examId }).limit(1000).get();
  const byOpenid = {};
  (exist.data || []).forEach((d) => {
    byOpenid[d.studentOpenid] = d;
  });

  let saved = 0;
  for (const it of items) {
    const openid = it && it.openid;
    const score = Number(it && it.score);
    if (!openid || isNaN(score) || score < 0 || score > 150) continue;
    const doc = byOpenid[openid];
    if (doc) {
      await db.collection('scores').doc(doc._id).update({
        data: {
          ['scores.' + subject]: score,
          studentName: (it.name || doc.studentName || '').trim(),
          updatedAt: db.serverDate(),
          ts: Date.now()
        }
      });
    } else {
      await db.collection('scores').add({
        data: {
          classId: user.classId,
          examId,
          studentOpenid: openid,
          studentName: (it.name || '').trim(),
          scores: { [subject]: score },
          updatedAt: db.serverDate(),
          ts: Date.now()
        }
      });
    }
    saved++;
  }
  return { ok: true, saved };
};
