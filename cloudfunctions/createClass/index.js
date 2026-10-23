// 云函数：createClass —— 老师创建班级，生成唯一邀请码，并把班级绑定到该老师
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混的 I O 0 1
const MAX_RETRY = 4;

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

  const { name, grade, motto, studentCount } = event;
  if (!name) return { ok: false, msg: '班级名称不能为空' };

  let inviteCode = '';
  try {
    inviteCode = await genUniqueCode();
  } catch (e) {
    return { ok: false, msg: '邀请码生成失败，请重试' };
  }

  const add = await db.collection('classes').add({
    data: {
      name,
      grade: grade || '',
      motto: motto || '',
      inviteCode,
      ownerOpenid: OPENID,
      // studentCount 由 joinClass 递减/递增维护，是"实际加入人数"；
      // 老师建班时填的是"预计人数"，另存 expectedCount，两者不能混用
      studentCount: 0,
      expectedCount: Number(studentCount) || 0,
      createdAt: db.serverDate()
    }
  });

  // 把班级绑定到当前老师；role 上面已校验为 teacher，这里不再改写
  await db.collection('users').doc(user._id).update({
    data: { classId: add._id, className: name }
  });

  return { ok: true, classId: add._id, inviteCode, name };
};
