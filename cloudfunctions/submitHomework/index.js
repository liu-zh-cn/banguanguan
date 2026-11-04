// 云函数：submitHomework —— 学生提交作业（写入/更新 submissions）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 北京时间的 YYYY-MM-DD（云函数环境时区是 UTC）
function todayStr() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { homeworkId } = event;
  if (!homeworkId) return { ok: false, msg: '参数错误' };

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];
  // 只有学生提交作业：老师提交会被 listHomework 计进「已交人数」而 total 只统计学生，口径错位
  if (user.role !== 'student') return { ok: false, msg: '仅学生可提交作业' };
  if (!user.classId) return { ok: false, msg: '请先加入班级' };

  // 与 assignHomework 的 2000 字上限对齐：超长内容直接截断，不让它无上限入库
  const content = String(event.content == null ? '' : event.content).slice(0, 2000);

  // 校验作业属于自己班：否则手工构造 homeworkId 就能往别班作业里塞提交记录
  const hw = await db.collection('homeworks').doc(homeworkId).get().catch(() => null);
  if (!hw || !hw.data) return { ok: false, msg: '作业不存在' };
  if ((hw.data.classId || '') !== user.classId) return { ok: false, msg: '无权提交该作业' };

  // 截止日期之前只是展示字段，现在真正参与判定：
  // 过期仍允许提交（学生可能补交），但会打上 late 标记，老师端能看到迟交人数
  const overdue = !!hw.data.deadline && todayStr() > hw.data.deadline;

  const exist = await db
    .collection('submissions')
    .where({ homeworkId, studentOpenid: OPENID })
    .limit(1)
    .get();

  // 以首次提交为准：按时交过的同学，过期后再修改内容不应被改成迟交
  const late = exist.data.length ? !!exist.data[0].late : overdue;

  if (exist.data.length) {
    await db.collection('submissions').doc(exist.data[0]._id).update({
      data: {
        status: '已提交',
        content,
        late,
        submittedAt: db.serverDate(),
        ts: Date.now()
      }
    });
  } else {
    // _id 用「作业id_openid」确定：快速双击提交的两个并发 add 只会有一条成功，
    // 另一条撞唯一 _id 报错后回落到更新分支，避免产生重复提交记录
    try {
      await db.collection('submissions').add({
        data: {
          _id: homeworkId + '_' + OPENID,
          homeworkId,
          classId: user.classId,
          studentOpenid: OPENID,
          studentName: user.name || '',
          status: '已提交',
          content,
          late,
          submittedAt: db.serverDate(),
          ts: Date.now()
        }
      });
    } catch (e) {
      const again = await db
        .collection('submissions')
        .where({ homeworkId, studentOpenid: OPENID })
        .limit(1)
        .get();
      if (!again.data.length) throw e;
      await db.collection('submissions').doc(again.data[0]._id).update({
        data: { status: '已提交', content, late, submittedAt: db.serverDate(), ts: Date.now() }
      });
    }
  }
  return { ok: true, late };
};
