// 云函数：inputScores —— 老师录入某一科目的成绩（按 学生openid 逐条 upsert / 清空）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { examId, subject, items } = event;
  if (!examId || !subject || !Array.isArray(items)) return { ok: false, msg: '参数错误' };

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];
  // 角色以服务端 users 表为准：成绩只能由老师录入，学生不可改自己的分
  if (user.role !== 'teacher') return { ok: false, msg: '仅老师可录入成绩' };

  const e = await db.collection('exams').doc(examId).get().catch(() => null);
  if (!e || !e.data) return { ok: false, msg: '考试不存在' };
  if (e.data.classId !== user.classId) return { ok: false, msg: '无权操作' };

  // 超过试卷满分就拒收，避免录入时手滑把 150 填进 100 分的卷子
  const fullScore = Number(e.data.fullScore) > 0 ? Number(e.data.fullScore) : 100;

  // 取出该考试已存在的成绩记录，按 openid 建索引
  const exist = await db.collection('scores').where({ examId }).limit(1000).get();
  const byOpenid = {};
  (exist.data || []).forEach((d) => {
    byOpenid[d.studentOpenid] = d;
  });

  let saved = 0;
  let cleared = 0;
  for (const it of items) {
    const openid = it && it.openid;
    if (!openid) continue;
    const doc = byOpenid[openid];
    const raw = it.score;

    // 空值 = 老师主动清空这位同学该科目的分数（录错了要能删）
    const isEmpty = raw === null || raw === undefined || raw === '';
    if (isEmpty) {
      if (!doc) continue; // 本来就没录，无需处理
      await db.collection('scores').doc(doc._id).update({
        data: {
          ['scores.' + subject]: _.remove(),
          updatedAt: db.serverDate(),
          ts: Date.now()
        }
      });
      cleared++;
      continue;
    }

    const score = Number(raw);
    if (isNaN(score) || score < 0 || score > fullScore) continue;
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
  return { ok: true, saved, cleared };
};
