// 云函数：deleteHomework —— 老师撤回（删除）自己班的作业，连带清理学生提交记录
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 单次最多删多少轮、每轮多少条：避免提交记录特别多时云函数超时
const BATCH = 100;
const MAX_ROUNDS = 100;

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const homeworkId = (event.homeworkId || '').trim();
  if (!homeworkId) return { ok: false, msg: '参数错误' };

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];
  // 只有老师能撤回；再校验作业属于本班，避免跨班删除
  if (user.role !== 'teacher') return { ok: false, msg: '仅老师可撤回作业' };

  const hw = await db.collection('homeworks').doc(homeworkId).get().catch(() => null);
  if (!hw || !hw.data) return { ok: false, msg: '作业不存在' };
  // 先判 classId 非空再比对，避免「双方都 undefined」误判为同班
  if (!user.classId || hw.data.classId !== user.classId) return { ok: false, msg: '无权操作' };

  // 先删提交记录，再删作业本身（顺序反了会留下孤儿提交记录）
  let removed = 0;
  for (let i = 0; i < MAX_ROUNDS; i++) {
    const s = await db
      .collection('submissions')
      .where({ homeworkId })
      .limit(BATCH)
      .get()
      .catch(() => null);
    const docs = (s && s.data) || [];
    if (!docs.length) break;
    const ids = docs.map((d) => d._id);
    // 云数据库没有批量删除，只能并发多条 remove
    const results = await Promise.all(
      ids.map((id) => db.collection('submissions').doc(id).remove().catch(() => null))
    );
    const n = results.filter((r) => r && r.stats && r.stats.removed).length;
    removed += n;
    if (n === 0) break; // 一条都没删掉，别再空转
  }

  // 兜底校验：如果因为超轮次上限或批量删除持续失败导致提交没删完，
  // 就不要删作业本体——否则留下永远无人可见的孤儿提交记录
  const left = await db
    .collection('submissions')
    .where({ homeworkId })
    .count()
    .catch(() => null);
  if (left && left.total > 0) {
    return { ok: false, msg: '提交记录未清理完（剩 ' + left.total + ' 条），作业已保留，请重试撤回' };
  }

  const del = await db.collection('homeworks').doc(homeworkId).remove();
  if (!del || !del.stats || !del.stats.removed) return { ok: false, msg: '撤回失败，请重试' };

  return { ok: true, submissionsRemoved: removed };
};
