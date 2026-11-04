// 云函数：deleteExam —— 删除一场还没有成绩的考试
// 有成绩或已发布的考试不允许删：学生端可能已经看到分数，静默删除会让成绩凭空消失
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: '未登录' };

  const examId = String(event.examId || '');
  if (!examId) return { ok: false, msg: '参数错误' };

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];
  if (user.role !== 'teacher') return { ok: false, msg: '仅老师可删除考试' };
  if (!user.classId) return { ok: false, msg: '请先创建班级' };

  const e = await db.collection('exams').doc(examId).get().catch(() => null);
  if (!e || !e.data) return { ok: false, msg: '考试不存在' };
  if (e.data.classId !== user.classId) return { ok: false, msg: '无权操作' };
  if (e.data.published) return { ok: false, msg: '已发布的考试不能删除，请先撤回发布' };

  const cnt = await db.collection('scores').where({ examId }).count();
  if ((cnt.total || 0) > 0) return { ok: false, msg: '已有成绩，不能删除' };

  await db.collection('exams').doc(examId).remove();
  // 看板缓存里可能还留着这场考试，删掉让下次重新计算
  await db.collection('class_stats').doc(user.classId).remove().catch(() => null);

  return { ok: true };
};
