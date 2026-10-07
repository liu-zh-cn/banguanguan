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
      studentCount: Number(studentCount) || 0,
      createdAt: db.serverDate()
    }
  });

  // 把班级绑定到当前老师
  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (u.data.length) {
    await db.collection('users').doc(u.data[0]._id).update({
      data: { classId: add._id, className: name, role: 'teacher' }
    });
  }

  return { ok: true, classId: add._id, inviteCode, name };
};
