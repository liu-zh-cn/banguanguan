// 云函数：createClass —— 老师创建班级，生成唯一邀请码，并把班级绑定到该老师
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混的 I O 0 1
const MAX_RETRY = 4;
const MAX_CLASSES = 10; // 一个老师最多同时管理的班级数，防止误点/脚本刷出一堆空班

function genCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

// 生成一个库里没被占用的邀请码；撞码会导致两个班共用一个码，这里必须查重
async function genUniqueCode() {
  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const code = genCode();
    const dup = await db.collection('classes').where({ inviteCode: code }).limit(1).get();
    if (!dup.data.length) return code;
  }
  throw new Error('invite-code-collision');
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: '未登录' };

  // 角色以服务端 users 表为准。
  // 注意：原实现在建班后把当前用户写成 role:'teacher'，等于给了学生一条提权路径
  //（前端无入口，但云函数可以被任意调用），这里必须先校验再建班。
  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '请先注册' };
  const user = u.data[0];
  if (user.role !== 'teacher') return { ok: false, msg: '仅老师可创建班级' };

  // 可选闸门：云函数环境变量 REQUIRE_TEACHER_APPROVAL=1 时，
  // 只有 users.verifiedTeacher === true 的老师才能建班。
  // 默认不开启，保持现有自助注册流程；需要审核时在云函数配置里加这个变量即可
  if (process.env.REQUIRE_TEACHER_APPROVAL === '1' && user.verifiedTeacher !== true) {
    return { ok: false, msg: '教师身份尚未审核，请联系管理员' };
  }

  const { name, grade, motto, studentCount } = event;
  const cleanName = String(name || '').trim().slice(0, 50);
  if (!cleanName) return { ok: false, msg: '班级名称不能为空' };
  const cleanStr = (v) => String(v == null ? '' : v).trim().slice(0, 100);

  // 多班模型：classIds 记成员资格，classId 是当前班级。
  // 旧实现会拦住「已有班级再建班」并要求 force，是因为旧模型下换班会弄丢原班；
  // 现在原班级仍然留在 classIds 里、照常可管，所以不再需要强制确认
  const ids = Array.isArray(user.classIds) ? user.classIds.filter(Boolean) : [];
  if (user.classId && ids.indexOf(user.classId) === -1) ids.push(user.classId);
  if (ids.length >= MAX_CLASSES) {
    return { ok: false, msg: '最多同时管理 ' + MAX_CLASSES + ' 个班级' };
  }

  let inviteCode = '';
  try {
    inviteCode = await genUniqueCode();
  } catch (e) {
    return { ok: false, msg: '邀请码生成失败，请重试' };
  }

  const add = await db.collection('classes').add({
    data: {
      name: cleanName,
      grade: cleanStr(grade),
      motto: cleanStr(motto),
      inviteCode,
      ownerOpenid: OPENID,
      // 只存老师填的"预计人数"。实际人数统一按 users 表 count，
      // 不再维护 studentCount 副本，避免两个数字长期对不上
      expectedCount: Math.max(0, Math.floor(Number(studentCount) || 0)),
      createdAt: db.serverDate()
    }
  });

  // 把班级写进成员数组，并切换到新班；原班级留在 classIds 里，仍然可管理
  await db.collection('users').doc(user._id).update({
    data: { classId: add._id, className: cleanName, classIds: ids.concat(add._id) }
  });

  return { ok: true, classId: add._id, inviteCode, name, classCount: ids.length + 1 };
};
