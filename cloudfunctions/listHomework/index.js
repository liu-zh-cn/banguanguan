// 云函数：listHomework —— 按当前用户角色返回本班作业
// 老师：带每个作业的已交人数 done 和班级学生总数 total
// 学生：带我对每个作业的提交状态 myStatus
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
  if (!classId) return { ok: true, role: user.role, list: [], total: 0 };

  const hw = await db
    .collection('homeworks')
    .where({ classId })
    .orderBy('ts', 'desc')
    .limit(100)
    .get();
  const homeworks = hw.data || [];

  if (user.role === 'teacher') {
    const ids = homeworks.map((h) => h._id);
    let subs = [];
    if (ids.length) {
      const s = await db
        .collection('submissions')
        .where({ homeworkId: _.in(ids), status: '已提交' })
        .limit(1000)
        .get();
      subs = s.data || [];
    }
    const totalRes = await db
      .collection('users')
      .where({ classId, role: 'student' })
      .count();
    const list = homeworks.map((h) => ({
      ...h,
      done: subs.filter((x) => x.homeworkId === h._id).length,
      total: totalRes.total
    }));
    return { ok: true, role: 'teacher', list, total: totalRes.total };
  }

  // 学生
  const my = await db
    .collection('submissions')
    .where({ studentOpenid: OPENID })
    .limit(1000)
    .get();
  const myMap = {};
  (my.data || []).forEach((s) => {
    myMap[s.homeworkId] = s;
  });
  const list = homeworks.map((h) => {
    const m = myMap[h._id];
    return {
      ...h,
      myStatus: m ? m.status : '待完成',
      myContent: m ? m.content : ''
    };
  });
  return { ok: true, role: 'student', list };
};
