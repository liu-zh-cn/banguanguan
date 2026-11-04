// 云函数：myClass —— 返回当前用户资料、当前班级、学生名单；老师额外带教师团队 / 待审核申请
// 多老师模型：classIds 是成员资格，classId 是「当前班级」。
// 其余老师端接口只读 classId，所以切换班级 = 改 classId，不用逐个接口改造。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 老账号只有 classId；统一成数组，顺手可以把缺失的 classIds 补回去
function memberIds(user) {
  const arr = Array.isArray(user.classIds) ? user.classIds.filter(Boolean) : [];
  if (user.classId && arr.indexOf(user.classId) === -1) arr.push(user.classId);
  return arr;
}

const MAX_SWITCH_CLASSES = 20; // 班级切换列表上限，正常老师用不到这么多

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: '未登录' };

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  const user = u.data[0] || null;

  let cls = null;
  let students = [];
  let teachers = [];
  let pending = [];
  let classes = [];
  let pendingApply = null;
  let isOwner = false;

  // 老师的成员数组懒回填：只有 classId 的老数据，在下次进页面时升级成 classIds
  if (user && user.role === 'teacher' && !Array.isArray(user.classIds) && user.classId) {
    user.classIds = [user.classId];
    await db
      .collection('users')
      .doc(user._id)
      .update({ data: { classIds: user.classIds } })
      .catch(() => {});
  }

  // 我在等谁的审核：只回班级名，不下发任何班级数据（审核通过前等于不存在）
  if (user && user.role === 'teacher' && user.applyClassId) {
    const pc = await db.collection('classes').doc(user.applyClassId).get().catch(() => null);
    if (pc && pc.data) {
      pendingApply = {
        classId: user.applyClassId,
        className: pc.data.name || user.applyClassName || '',
        ts: user.applyTs || 0
      };
    } else {
      // 申请的班级已被删：清掉悬空申请，避免页面一直显示「等待审核」
      await db
        .collection('users')
        .doc(user._id)
        .update({ data: { applyClassId: '', applyClassName: '', applyTs: 0 } })
        .catch(() => {});
      user.applyClassId = '';
    }
  }

  if (user && user.classId) {
    const c = await db.collection('classes').doc(user.classId).get().catch(() => null);
    const raw = (c && c.data) || null;
    if (raw) {
      cls = { ...raw };
      // 邀请码 / 创建者 openid 只对老师下发。
      // 学生拿到邀请码等于能无限拉人进班，拿到 ownerOpenid 也没有任何用处。
      if (user.role !== 'teacher') {
        delete cls.inviteCode;
        delete cls.ownerOpenid;
      }
    } else {
      // 班级已不存在（比如被直接在数据库里删除）：清理悬空的 classId / className / classIds 成员项，
      // 否则各页面会一直显示这个已删除的"幽灵班级"
      const nextIds = memberIds(user).filter((x) => x !== user.classId);
      await db
        .collection('users')
        .doc(user._id)
        .update({ data: { classId: '', className: '', classIds: nextIds } })
        .catch(() => {});
      user.classId = '';
      user.className = '';
      user.classIds = nextIds;
    }

    if (raw && user.role === 'teacher') {
      isOwner = raw.ownerOpenid === OPENID;

      // 教师团队：新数据查 classIds 数组，老数据只有 classId，两条都查再按 openid 去重
      const memberMap = {};
      const byIds = await db
        .collection('users')
        .where({ role: 'teacher', classIds: user.classId })
        .limit(1000)
        .get()
        .catch(() => ({ data: [] }));
      const byLegacy = await db
        .collection('users')
        .where({ role: 'teacher', classId: user.classId })
        .limit(1000)
        .get()
        .catch(() => ({ data: [] }));
      (byIds.data || []).concat(byLegacy.data || []).forEach((t) => {
        if (!t || !t.openid || memberMap[t.openid]) return;
        memberMap[t.openid] = {
          openid: t.openid,
          name: t.name || '未设置姓名',
          subject: t.subject || '',
          isOwner: t.openid === raw.ownerOpenid,
          isMe: t.openid === OPENID
        };
      });
      // 班主任排在第一位
      teachers = Object.keys(memberMap)
        .map((k) => memberMap[k])
        .sort((a, b) => (b.isOwner ? 1 : 0) - (a.isOwner ? 1 : 0));

      // 待审核申请只发给班主任
      if (isOwner) {
        const p = await db
          .collection('users')
          .where({ role: 'teacher', applyClassId: user.classId })
          .limit(100)
          .get()
          .catch(() => ({ data: [] }));
        pending = (p.data || []).map((x) => ({
          openid: x.openid,
          name: x.name || '未设置姓名',
          subject: x.subject || '',
          ts: x.applyTs || 0
        }));
      }

      // 我加入的班级列表（切换用）。班级被删的自动跳过
      const ids = memberIds(user).slice(0, MAX_SWITCH_CLASSES);
      for (const id of ids) {
        const cc = await db.collection('classes').doc(id).get().catch(() => null);
        if (!cc || !cc.data) continue;
        classes.push({
          id,
          name: cc.data.name || '未命名班级',
          isOwner: cc.data.ownerOpenid === OPENID,
          active: id === user.classId
        });
      }
    }

    // 学生名单含全班同学的 openid / 姓名 / 学号，只下发给老师。
    // 学生端只需要 class.name 和 user，拿到名单属于越权读取他人信息。
    if (raw && user.role === 'teacher') {
      // 分页拉全：之前 limit(200) 会让第 201 名学生在名单里静默消失，
      // 且学号兜底成 i+1 后与录入页对不上
      const PAGE = 100;
      for (let skip = 0; skip < 1000; skip += PAGE) {
        const s = await db
          .collection('users')
          .where({ classId: user.classId, role: 'student' })
          .skip(skip)
          .limit(PAGE)
          .get();
        (s.data || []).forEach((x) => students.push(x));
        if (!s.data || s.data.length < PAGE) break;
      }
    }
  }

  return {
    ok: true,
    user,
    class: cls,
    students,
    teachers,
    pending,
    classes,
    pendingApply,
    isOwner
  };
};
