// 云函数：inputScores —— 老师录入某一科目的成绩（按 学生openid 逐条 upsert / 清空）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const examId = String(event.examId || '');
  const { subject, items } = event;
  if (!examId || !subject || !Array.isArray(items)) return { ok: false, msg: '参数错误' };

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];
  // 角色以服务端 users 表为准：成绩只能由老师录入，学生不可改自己的分
  if (user.role !== 'teacher') return { ok: false, msg: '仅老师可录入成绩' };

  const e = await db.collection('exams').doc(examId).get().catch(() => null);
  if (!e || !e.data) return { ok: false, msg: '考试不存在' };
  if (!user.classId || e.data.classId !== user.classId) return { ok: false, msg: '无权操作' };

  // 科目必须是这场考试建过的：含 . 或 $ 的自定义键名会污染 scores 对象结构，
  // 混进 Object.values(scores) 的统计口径（classStats / myScores）
  const subjects = Array.isArray(e.data.subjects) ? e.data.subjects : [];
  if (subjects.indexOf(subject) === -1) return { ok: false, msg: '科目无效：' + subject };

  // 超过试卷满分就拒收，避免录入时手滑把 150 填进 100 分的卷子
  const fullScore = Number(e.data.fullScore) > 0 ? Number(e.data.fullScore) : 100;

  // 学生名单：只接受本班学生的 openid。否则手工构造请求就能给任意 openid 造成绩记录，
  // 这些记录会混进 classStats / myScores 的全班统计
  const stu = await db
    .collection('users')
    .where({ classId: user.classId, role: 'student' })
    .field({ openid: true, name: true })
    .limit(1000)
    .get()
    .catch(() => null);
  if (!stu) return { ok: false, msg: '校验学生名单失败，请重试' };
  const memberSet = new Set();
  const memberName = {};
  (stu.data || []).forEach((s) => {
    memberSet.add(s.openid);
    memberName[s.openid] = s.name || '';
  });

  // 取出该考试已存在的成绩记录，按 openid 建索引
  const exist = await db.collection('scores').where({ examId }).limit(1000).get();
  const byOpenid = {};
  (exist.data || []).forEach((d) => {
    byOpenid[d.studentOpenid] = d;
  });

  let saved = 0;
  let cleared = 0;
  let skipped = 0;
  for (const it of items) {
    const openid = it && it.openid;
    if (!openid) continue;
    // 不在本班名单里的 openid 一律丢弃，绝不入库
    if (!memberSet.has(openid)) {
      skipped++;
      continue;
    }
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
          // 姓名以 users 表为准，不采信前端传的 it.name（可能被传成对象，也可能被改错）
          studentName: String(memberName[openid] || doc.studentName || '').trim(),
          updatedAt: db.serverDate(),
          ts: Date.now()
        }
      });
    } else {
      // _id 用「考试id_openid」确定：并发保存（手机 + 平板）或网络重试时，
      // 两个 add 只有一条成功，另一条撞 _id 后回落到更新分支，
      // 不会出现同一学生的两条成绩文档（否则统计会把他算两遍）
      try {
        await db.collection('scores').add({
          data: {
            _id: examId + '_' + openid,
            classId: user.classId,
            examId,
            studentOpenid: openid,
            studentName: String(memberName[openid] || '').trim(),
            scores: { [subject]: score },
            updatedAt: db.serverDate(),
            ts: Date.now()
          }
        });
      } catch (err) {
        const again = await db
          .collection('scores')
          .where({ examId, studentOpenid: openid })
          .limit(1)
          .get();
        if (!again.data || !again.data.length) throw err;
        await db.collection('scores').doc(again.data[0]._id).update({
          data: {
            ['scores.' + subject]: score,
            studentName: String(memberName[openid] || again.data[0].studentName || '').trim(),
            updatedAt: db.serverDate(),
            ts: Date.now()
          }
        });
      }
    }
    saved++;
  }
  return { ok: true, saved, cleared, skipped };
};
