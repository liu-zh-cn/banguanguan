// 云函数：submitHomework —— 学生提交作业（写入/更新 submissions）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { homeworkId, content } = event;
  if (!homeworkId) return { ok: false, msg: '参数错误' };

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];
  if (!user.classId) return { ok: false, msg: '请先加入班级' };

  // 校验作业属于自己班：否则手工构造 homeworkId 就能往别班作业里塞提交记录
  const hw = await db.collection('homeworks').doc(homeworkId).get().catch(() => null);
  if (!hw || !hw.data) return { ok: false, msg: '作业不存在' };
  if ((hw.data.classId || '') !== user.classId) return { ok: false, msg: '无权提交该作业' };

  const exist = await db
    .collection('submissions')
    .where({ homeworkId, studentOpenid: OPENID })
    .limit(1)
    .get();

  if (exist.data.length) {
    await db.collection('submissions').doc(exist.data[0]._id).update({
      data: {
        status: '已提交',
        content: content || '',
        submittedAt: db.serverDate(),
        ts: Date.now()
      }
    });
  } else {
    await db.collection('submissions').add({
      data: {
        homeworkId,
        classId: user.classId,
        studentOpenid: OPENID,
        studentName: user.name || '',
        status: '已提交',
        content: content || '',
        submittedAt: db.serverDate(),
        ts: Date.now()
      }
    });
  }
  return { ok: true };
};
