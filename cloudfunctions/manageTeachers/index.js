// 云函数：manageTeachers —— 班主任管理本班教师团队
// action: approve 同意申请 / reject 拒绝申请 / remove 移出班级 / transfer 转让班主任
// 四件事都只认「当前班级的 ownerOpenid === 调用者」，普通老师调不动。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// classIds 是成员资格；老数据只有 classId，这里统一成数组
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

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: '未登录' };

  const action = String(event.action || '');
  if (['approve', 'reject', 'remove', 'transfer'].indexOf(action) === -1) {
    return { ok: false, msg: '参数错误' };
  }

  const targetOpenid = String(event.openid || '');
  if (!targetOpenid) return { ok: false, msg: '参数错误' };
  if (targetOpenid === OPENID) return { ok: false, msg: '不能对自己执行该操作' };

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];
  if (user.role !== 'teacher') return { ok: false, msg: '仅老师可操作' };

  const classId = user.classId || '';
  if (!classId) return { ok: false, msg: '请先选择班级' };

  // 管理权限只属于班主任，且只对「当前班级」生效：多班老师在别的班当老师时也管不了人
  const c = await db.collection('classes').doc(classId).get().catch(() => null);
  if (!c || !c.data) return { ok: false, msg: '班级不存在' };
  if (c.data.ownerOpenid !== OPENID) return { ok: false, msg: '仅班主任可管理教师' };

  const t = await db.collection('users').where({ openid: targetOpenid }).limit(1).get();
  if (!t.data.length) return { ok: false, msg: '该用户不存在' };
  const target = t.data[0];
  const ids = memberIds(target);
  const isMember = ids.indexOf(classId) > -1;

  if (action === 'approve') {
    if (target.role !== 'teacher') return { ok: false, msg: '对方不是老师账号' };
    if (target.applyClassId !== classId) return { ok: false, msg: '该申请已失效' };
    if (isMember) {
      // 重复同意：只清掉申请状态，不重复写成员数组
      await db.collection('users').doc(target._id).update({
        data: { applyClassId: '', applyClassName: '', applyTs: 0 }
      });
      return { ok: true, msg: '对方已在本班' };
    }

    const data = {
      classIds: ids.concat(classId),
      applyClassId: '',
      applyClassName: '',
      applyTs: 0
    };
    // 申请人还没有当前班级时自动切到本班；已有班级则保留他原来在看的班，由他自己切换
    if (!target.classId) {
      data.classId = classId;
      data.className = c.data.name || '';
    }
    await db.collection('users').doc(target._id).update({ data });
    return { ok: true, msg: '已同意加入' };
  }

  if (action === 'reject') {
    if (target.applyClassId !== classId) return { ok: false, msg: '该申请已失效' };
    await db.collection('users').doc(target._id).update({
      data: { applyClassId: '', applyClassName: '', applyTs: 0 }
    });
    return { ok: true, msg: '已拒绝申请' };
  }

  if (action === 'remove') {
    if (!isMember) return { ok: false, msg: '对方不在本班' };
    const next = ids.filter((x) => x !== classId);
    const data = { classIds: next };
    // 被移除的正好是他当前的班：切到剩下的第一个班，没有就置空
    if (target.classId === classId) {
      data.classId = next[0] || '';
      data.className = await classNameOf(next[0]);
    }
    await db.collection('users').doc(target._id).update({ data });
    return { ok: true, msg: '已移出班级' };
  }

  // transfer：转让班主任，原班主任降为普通老师，仍留在班里
  if (!isMember) return { ok: false, msg: '对方不在本班，无法转让' };
  await db.collection('users').doc(target._id).update({ data: { classIds: ids } });
  await db.collection('classes').doc(classId).update({ data: { ownerOpenid: targetOpenid } });
  return { ok: true, msg: '已转让班主任' };
};
