// 云函数：saveTimetable —— 保存本班课程表
// 课程表直接写在 classes 文档的 timetable 字段里（二维字符串数组，行 = 节次，列 = 星期），
// 不新建集合；读取走 myClass 返回的 class.timetable，学生端也拿得到。
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const DAYS = 5; // 周一到周五
const PERIODS = 8; // 每天 8 节
const MAX_LEN = 10; // 单格文字长度上限

// 把前端传来的二维数组规整成固定的 5 × 8：
// 行数/列数超限直接判错（防止有人塞进来一个巨大的数组把文档撑爆），
// 少于预期则补空，保证文档结构稳定，读的时候不用再做兼容
function normalize(grid) {
  if (!Array.isArray(grid)) return null;
  if (grid.length > DAYS) return null;

  const out = [];
  for (let r = 0; r < DAYS; r++) {
    const src = Array.isArray(grid[r]) ? grid[r] : [];
    if (src.length > PERIODS) return null;
    const row = [];
    for (let c = 0; c < PERIODS; c++) {
      const v = typeof src[c] === 'string' ? src[c].replace(/[\r\n\t]/g, ' ').trim() : '';
      row.push(v.slice(0, MAX_LEN));
    }
    out.push(row);
  }
  return out;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: '未登录' };

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];
  if (user.role !== 'teacher') return { ok: false, msg: '仅老师可编辑课程表' };
  if (!user.classId) return { ok: false, msg: '请先创建或加入班级' };

  const grid = normalize(event.grid);
  if (!grid) return { ok: false, msg: '课程表格式错误' };

  // 班级必须还在：classId 指向一个被删掉的班时不要新写一份孤儿数据
  const c = await db.collection('classes').doc(user.classId).get().catch(() => null);
  if (!c || !c.data) return { ok: false, msg: '班级不存在或已解散' };

  const ts = Date.now();
  await db.collection('classes').doc(user.classId).update({
    data: {
      timetable: grid,
      timetableTs: ts,
      timetableBy: OPENID
    }
  });

  return { ok: true, updatedAt: ts, className: c.data.name || '' };
};
