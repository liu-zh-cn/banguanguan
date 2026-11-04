// 云函数：sendBroadcast —— 老师发送广播，班级一律以服务端记录为准（按班级隔离大屏）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 跨实例限流：同一老师每分钟最多 6 条。
// 进程内计数在云函数扩容后会失效，所以计数落在 rate_limits 集合
const RATE_LIMIT = 6;
const RATE_WINDOW = 60 * 1000;

async function rateLimited(openid) {
  const bucket = Math.floor(Date.now() / RATE_WINDOW);
  const id = 'sb_' + openid + '_' + bucket;
  const coll = db.collection('rate_limits');
  try {
    const cur = await coll.doc(id).get().catch(() => null);
    if (cur && cur.data) {
      if ((cur.data.count || 0) >= RATE_LIMIT) return true;
      await coll.doc(id).update({ data: { count: _.inc(1), ts: Date.now() } });
      return false;
    }
    await coll.add({
      data: { _id: id, openid, scope: 'sendBroadcast', count: 1, ts: Date.now() }
    });
    return false;
  } catch (e) {
    // 并发首写撞 _id 或限流表异常：放行，不能因为限流组件坏了就发不了广播
    await coll
      .doc(id)
      .update({ data: { count: _.inc(1), ts: Date.now() } })
      .catch(() => null);
    return false;
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: '未登录' };
  // String() 兜底 + 限长：text 被传成对象会抛异常，超长文本会直接怼上大屏
  const text = String(event.text || '').trim().slice(0, 200);
  if (!text) return { ok: false, msg: '内容不能为空' };

  const u = await db.collection('users').where({ openid: OPENID }).limit(1).get();
  if (!u.data.length) return { ok: false, msg: '未注册' };
  const user = u.data[0];

  // 角色以服务端 users 表为准，学生不可往大屏推消息
  if (user.role !== 'teacher') return { ok: false, msg: '仅老师可发送广播' };

  // 目标班级只取发送者自己的班级：不接受前端传 classId，避免给别的班大屏推消息
  const classId = user.classId || '';
  if (!classId) return { ok: false, msg: '请先创建班级' };
  const className = user.className || '';

  if (await rateLimited(OPENID)) {
    return { ok: false, code: 'RATE_LIMITED', msg: '发送太频繁，请一分钟后再试' };
  }

  const add = await db.collection('broadcasts').add({
    data: {
      text,
      classId,
      className,
      from: OPENID || '',
      ts: Date.now(),
      createdAt: db.serverDate()
    }
  });
  return { ok: true, id: add._id, classId };
};
