// 云函数：quitClass —— 退出 / 移除 / 解散，三种「离开班级」的操作都收在这里
//   leave    ：本人退出当前班级（学生、老师都能用；班主任必须先转让）
//   kick     ：班主任把本班某个学生移出班级
//   dissolve ：班主任解散一个空班（没有学生、没有其他老师、没有考试和作业）
// 解散只允许空班，是为了不在这里做级联删除——删考试、删作业已经各有云函数，
// 让老师先清干净再解散，既安全又不会误删别人录的数据。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// classIds 是成员资格；老数据只有 classId，统一成数组再操作
function memberIds(user) {
  const arr = Array.isArray(user.classIds) ? user.classIds.filter(Boolean) : [];
  if (user.classId && arr.indexOf(user.classId) === -1) arr.push(user.classId);
  return arr;
}

async function classNameOf(classId) {
  if (!classId) return '';
  const c = await db.collection('classes').doc(classId).get().catch(() => null);
  return (c && c.data && c.data.name) || '';
}

// 把某个用户从某个班里摘掉：成员数组去掉这一项，
// 如果正好是他当前的班，再切到剩下的第一个班（通常是空）
async function detach(user, classId) {
  const next = memberIds(user).filter((x) => x !== classId);
  const data = { classIds: next };
  if (user.classId === classId) {
    data.classId = next[0] || '';
    data.className = await classNameOf(next[0]);
  }
  await db.collection('users').doc(user._id).update({ data });
  return next[0] || '';
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: '未登录' };

  const action = String(event.action || 'leave');
  if (['leave', 'kick', 'dissolve'].indexOf(action) === -1) {
    return { ok: false, msg: '参数错误' };
  }

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];
  const classId = user.classId || '';
  if (!classId) return { ok: false, msg: '你当前没有加入任何班级' };

  const c = await db.collection('classes').doc(classId).get().catch(() => null);

  // ---------- leave：自己退出 ----------
  if (action === 'leave') {
    if (!c || !c.data) {
      // 班级已经被删了：把这条悬空的成员关系清掉，页面才不会一直显示这个班
      const next = memberIds(user).filter((x) => x !== classId);
      await db.collection('users').doc(user._id).update({
        data: { classId: next[0] || '', className: await classNameOf(next[0]), classIds: next }
      });
      return { ok: true, msg: '已退出（该班级已不存在）', classId: next[0] || '' };
    }
    if (c.data.ownerOpenid === OPENID) {
      return { ok: false, msg: '你是本班班主任，请先转让班主任或解散班级' };
    }
    const nextClassId = await detach(user, classId);
    await db.collection('class_stats').doc(classId).remove().catch(() => null);
    return {
      ok: true,
      msg: '已退出班级',
      classId: nextClassId,
      className: await classNameOf(nextClassId)
    };
  }

  // 下面两个动作都要求「是本班班主任」
  if (user.role !== 'teacher') return { ok: false, msg: '仅老师可执行该操作' };
  if (!c || !c.data) return { ok: false, msg: '班级不存在或已解散' };
  if (c.data.ownerOpenid !== OPENID) return { ok: false, msg: '仅班主任可执行该操作' };

  // ---------- kick：把学生移出班级 ----------
  if (action === 'kick') {
    const targetOpenid = String(event.openid || '');
    if (!targetOpenid) return { ok: false, msg: '参数错误' };
    if (targetOpenid === OPENID) return { ok: false, msg: '不能移除自己' };

    const t = await db.collection('users').where({ openid: targetOpenid }).limit(1).get();
    if (!t.data.length) return { ok: false, msg: '该用户不存在' };
    const target = t.data[0];
    if (target.role !== 'student') return { ok: false, msg: '只能移除学生' };
    if (memberIds(target).indexOf(classId) === -1) return { ok: false, msg: '该学生不在本班' };

    await detach(target, classId);
    await db.collection('class_stats').doc(classId).remove().catch(() => null);
    return { ok: true, msg: '已把「' + (target.name || '该学生') + '」移出班级' };
  }

  // ---------- dissolve：解散空班 ----------
  const stuCnt = await db.collection('users').where({ classId, role: 'student' }).count();
  if ((stuCnt.total || 0) > 0) {
    return { ok: false, msg: '班上还有 ' + stuCnt.total + ' 名学生，请先移除后再解散' };
  }

  // 老师两边都要查：新数据在 classIds 数组里，老数据只有 classId，
  // 只查一边会漏掉另一种，导致「看起来没人了」却把别的老师留在空班里
  const byIds = await db
    .collection('users')
    .where({ role: 'teacher', classIds: classId })
    .field({ openid: true })
    .limit(100)
    .get();
  const byLegacy = await db
    .collection('users')
    .where({ role: 'teacher', classId })
    .field({ openid: true })
    .limit(100)
    .get();
  const seen = {};
  (byIds.data || []).concat(byLegacy.data || []).forEach((x) => {
    if (x && x.openid && x.openid !== OPENID) seen[x.openid] = 1;
  });
  const otherCount = Object.keys(seen).length;
  if (otherCount > 0) {
    return { ok: false, msg: '班上还有 ' + otherCount + ' 位老师，请先移出后再解散' };
  }

  const examCnt = await db.collection('exams').where({ classId }).count();
  if ((examCnt.total || 0) > 0) {
    return { ok: false, msg: '还有 ' + examCnt.total + ' 场考试，请先在「发布成绩」里删除后再解散' };
  }
  const hwCnt = await db.collection('homeworks').where({ classId }).count();
  if ((hwCnt.total || 0) > 0) {
    return { ok: false, msg: '还有 ' + hwCnt.total + ' 份作业，请先撤回后再解散' };
  }

  // 清掉还挂在待审队列里的申请，免得别人一直显示「等待审核」
  const applying = await db
    .collection('users')
    .where({ applyClassId: classId })
    .field({ openid: true })
    .limit(100)
    .get();
  for (const a of applying.data || []) {
    await db
      .collection('users')
      .where({ openid: a.openid })
      .update({ data: { applyClassId: '', applyClassName: '', applyTs: 0 } })
      .catch(() => null);
  }

  await db.collection('classes').doc(classId).remove();
  await db.collection('class_stats').doc(classId).remove().catch(() => null);

  const nextClassId = await detach(user, classId);
  return {
    ok: true,
    msg: '班级已解散',
    classId: nextClassId,
    className: await classNameOf(nextClassId)
  };
};
