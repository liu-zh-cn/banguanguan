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
        classId: user.classId || '',
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
