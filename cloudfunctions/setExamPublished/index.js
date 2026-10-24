// 云函数：setExamPublished —— 老师发布/撤回考试成绩（学生端只能看到已发布的）
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
  // 角色以服务端 users 表为准，学生不可自行发布 / 撤回成绩
  if (user.role !== 'teacher') return { ok: false, msg: '仅老师可发布成绩' };

  const e = await db.collection('exams').doc(examId).get().catch(() => null);
  if (!e || !e.data) return { ok: false, msg: '考试不存在' };
  // 先判 classId 非空再比对，避免「双方都 undefined」误判为同班
  if (!user.classId || e.data.classId !== user.classId) return { ok: false, msg: '无权操作' };

  await db.collection('exams').doc(examId).update({
    data: { published: !!event.published, updatedAt: db.serverDate() }
  });
  return { ok: true, published: !!event.published };
};
