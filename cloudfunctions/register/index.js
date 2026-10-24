// 云函数：register —— 用 openid 作为唯一键，写入/更新用户资料
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const users = db.collection('users');

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { ok: false, msg: '未获取到 openid' };

  const { role, name, className, subject, studentNo } = event;
  // String() 兜底：name 等字段被传成对象/数组时不至于原样入库或让后续渲染炸掉
  const cleanName = String(name || '').trim().slice(0, 50);
  if (!cleanName) return { ok: false, msg: '姓名不能为空' };
  const cleanStr = (v) => String(v == null ? '' : v).trim().slice(0, 100);
  const cleanClassName = cleanStr(className);
  const cleanSubject = cleanStr(subject);
  const cleanStudentNo = cleanStr(studentNo);

  const exist = await users.where({ openid: OPENID }).limit(1).get();
  const hasUser = !!(exist.data && exist.data.length);

  // 身份规则（服务端说了算，前端传的 role 只作为首次注册的初始值）：
  // 1. 已是学生的，永远保持学生，防止重新调用 register 把自己提成老师；
  // 2. 已有身份的，register 不改 role，只更新资料；
  // 3. 首次注册按前端选择，未传时默认老师。
  const finalRole = hasUser
    ? (exist.data[0].role === 'student' ? 'student' : (exist.data[0].role || 'teacher'))
    : (role || 'teacher');

  const data = {
    role: finalRole,
    name: cleanName,
    className: cleanClassName,
    subject: cleanSubject,
    studentNo: cleanStudentNo,
    updatedAt: db.serverDate()
  };

  if (hasUser) {
    // 已注册用户重复调 register 时，只覆盖本次确实填了值的字段。
    // 否则表单里留空的 className / subject / studentNo 会把云端已存的值清掉
    // （例如学生误入注册页再提交一次，班级名就被清空了）
    const patch = { role: finalRole, name: cleanName, updatedAt: db.serverDate() };
    if (cleanClassName) patch.className = cleanClassName;
    if (cleanSubject) patch.subject = cleanSubject;
    if (cleanStudentNo) patch.studentNo = cleanStudentNo;
    await users.doc(exist.data[0]._id).update({ data: patch });
    return { ok: true, userId: exist.data[0]._id, role: finalRole, ...patch };
  }

  // 首次注册才写 openid 与创建时间。
  // 并发竞态兜底：两个请求同时读到「未注册」时先后 add，配合 users.openid 唯一索引
  // 第二个会撞唯一键报错——catch 后按「已注册」分支更新资料，避免同一 openid 产生两条用户
  const add = await users
    .add({ data: { ...data, openid: OPENID, createdAt: db.serverDate() } })
    .catch(async (err) => {
      const again = await users.where({ openid: OPENID }).limit(1).get();
      if (!again.data || !again.data.length) throw err;
      const u = again.data[0];
      const finalRole2 = u.role === 'student' ? 'student' : u.role || 'teacher';
      const patch2 = { role: finalRole2, name: cleanName, updatedAt: db.serverDate() };
      if (cleanClassName) patch2.className = cleanClassName;
      if (cleanSubject) patch2.subject = cleanSubject;
      if (cleanStudentNo) patch2.studentNo = cleanStudentNo;
      await users.doc(u._id).update({ data: patch2 });
      return { _id: u._id, deduped: true, role: finalRole2 };
    });
  // 并发去重命中时 role 以库里已存在的为准（...data 里也带 role，须放在前面避免覆盖）
  return { ok: true, userId: add._id, ...data, role: add.role || finalRole };
};
