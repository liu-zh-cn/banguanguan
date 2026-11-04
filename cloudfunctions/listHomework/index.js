// 云函数：listHomework —— 按当前用户角色返回本班作业
// 老师：带每个作业的已交人数 done 和班级学生总数 total
// 学生：带我对每个作业的提交状态 myStatus
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 北京时间的 YYYY-MM-DD（云函数环境时区是 UTC）
function todayStr() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];
  const classId = user.classId || '';
  if (!classId) return { ok: true, role: user.role, list: [], total: 0 };

  // 分页拉全：limit(100) 会让第 101 条以后的作业静默消失。
  // 500 条是给学生端渲染留的硬上限，命中时回传 truncated 让页面明示
  const PAGE = 100;
  const MAX_HW = 500;
  const homeworks = [];
  for (let skip = 0; skip < MAX_HW; skip += PAGE) {
    const hw = await db
      .collection('homeworks')
      .where({ classId })
      .orderBy('ts', 'desc')
      .skip(skip)
      .limit(PAGE)
      .get();
    (hw.data || []).forEach((h) => homeworks.push(h));
    if (!hw.data || hw.data.length < PAGE) break;
  }
  const truncated = homeworks.length >= MAX_HW;

  if (user.role === 'teacher') {
    const ids = homeworks.map((h) => h._id);
    const subs = [];
    // 只统计本班现有学生的提交：学生换班后，旧提交仍挂在原作业上，
    // 按条数直接计数会出现「已交 41 / 总人数 40」、进度条超过 100%
    const stu = await db
      .collection('users')
      .where({ classId, role: 'student' })
      .field({ openid: true })
      .limit(1000)
      .get();
    const memberSet = new Set((stu.data || []).map((s) => s.openid));
    if (ids.length) {
      // _.in 的数组长度有上限，单次 get 也最多 1000 条：
      // 先按 100 个作业一组，组内再分页，避免作业多了以后老作业的「已交人数」静默偏小
      const ID_BATCH = 100;
      const PAGE = 1000;
      for (let i = 0; i < ids.length; i += ID_BATCH) {
        const part = ids.slice(i, i + ID_BATCH);
        for (let skip = 0; ; skip += PAGE) {
          const s = await db
            .collection('submissions')
            .where({ homeworkId: _.in(part), status: '已提交' })
            .skip(skip)
            .limit(PAGE)
            .get();
          (s.data || []).forEach((x) => subs.push(x));
          if (!s.data || s.data.length < PAGE) break;
        }
      }
    }
    const totalRes = await db
      .collection('users')
      .where({ classId, role: 'student' })
      .count();
    const list = homeworks.map((h) => ({
      ...h,
      done: subs.filter((x) => x.homeworkId === h._id && memberSet.has(x.studentOpenid)).length,
      // 迟交份数：首次提交晚于截止日的记录（老记录没有 late 字段，按按时交算）
      late: subs.filter((x) => x.homeworkId === h._id && memberSet.has(x.studentOpenid) && x.late).length,
      total: totalRes.total
    }));
    return { ok: true, role: 'teacher', list, total: totalRes.total, truncated };
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
  const today = todayStr();
  const list = homeworks.map((h) => {
    const m = myMap[h._id];
    const item = {
      ...h,
      myStatus: m ? m.status : '待完成',
      myContent: m ? m.content : '',
      // 是否迟交 / 是否已过截止日：学生端据此显示「迟交」「已截止」标签
      myLate: !!(m && m.late),
      expired: !!h.deadline && today > h.deadline
    };
    // openid 不下发给学生（与 myClass 对学生隐藏 ownerOpenid 的约定保持一致）
    delete item.teacherOpenid;
    return item;
  });
  return { ok: true, role: 'student', list, truncated };
};
