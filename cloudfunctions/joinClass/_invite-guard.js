// 邀请码校验的失败次数限制（getClassByCode / joinClass 共用）
// 说明：云函数各自独立打包、无法跨目录 require，所以这个文件在两个函数目录里各放一份
//
// 规则：同一 openid 在 10 分钟内失败 5 次，锁定 15 分钟；验证成功即清零。
// 记录写在 code_fails 集合，由云函数管理端读写（不受集合权限配置影响）。

const COLLECTION = 'code_fails';
const MAX_FAILS = 5;
const WINDOW_MS = 10 * 60 * 1000; // 统计窗口
const BLOCK_MS = 15 * 60 * 1000; // 锁定时长

function keyOf(openid) {
  return 'invite:' + (openid || 'anonymous');
}

function fmtMinutes(ms) {
  return Math.max(1, Math.ceil(ms / 60000)) + ' 分钟';
}

// 读失败记录。集合不存在（从没人失败过）或读失败都按“0 次”处理，不能因为这步挂掉主流程
async function readRecord(db, key) {
  try {
    const r = await db.collection(COLLECTION).where({ key }).limit(1).get();
    return (r.data && r.data[0]) || null;
  } catch (e) {
    return null;
  }
}

// 验证邀请码之前调用：被锁定则返回 { ok: false, msg }
async function allowed(cloud, openid) {
  const rec = await readRecord(cloud.database(), keyOf(openid));
  if (!rec) return { ok: true };
  const now = Date.now();
  const until = rec.blockedUntil || 0;
  if (until > now) {
    return { ok: false, msg: '尝试次数过多，请 ' + fmtMinutes(until - now) + '后再试' };
  }
  return { ok: true };
}

// 记录一次失败，返回 { blocked, blockedUntil }
async function failed(cloud, openid) {
  const db = cloud.database();
  const key = keyOf(openid);
  const now = Date.now();
  const rec = await readRecord(db, key);
  const lastFail = (rec && rec.lastFail) || 0;

  // 超出统计窗口就重新计数
  let count = lastFail && now - lastFail > WINDOW_MS ? 0 : (rec && rec.count) || 0;
  count += 1;
  const blockedUntil = count >= MAX_FAILS ? now + BLOCK_MS : 0;
  if (blockedUntil) count = 0; // 锁定后清零，解封即重新计数

  const data = { key, openid: openid || '', count, lastFail: now, blockedUntil };
  try {
    if (rec) await db.collection(COLLECTION).doc(rec._id).update({ data });
    else await db.collection(COLLECTION).add({ data });
  } catch (e) {
    // 写失败不阻断主流程：宁可少记一次，也不要让正常用户加不进班级
  }
  return { blocked: !!blockedUntil, blockedUntil };
}

// 验证成功时清掉失败记录
async function passed(cloud, openid) {
  const db = cloud.database();
  try {
    const r = await db.collection(COLLECTION).where({ key: keyOf(openid) }).limit(1).get();
    const rec = (r.data && r.data[0]) || null;
    if (rec) await db.collection(COLLECTION).doc(rec._id).remove();
  } catch (e) {
    // 清理失败无副作用，下次成功还会再清一次
  }
}

module.exports = { allowed, failed, passed, MAX_FAILS, WINDOW_MS, BLOCK_MS, COLLECTION };
