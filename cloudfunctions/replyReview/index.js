// 云函数：replyReview —— 学生回复老师给自己的点评（可重复修改自己的回复）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  const { reviewId } = event;
  // String() 兜底：content 被传成对象时 trim 会直接抛未捕获异常
  const content = String(event.content || '').trim();
  if (!reviewId) return { ok: false, msg: '参数错误' };
  if (!content) return { ok: false, msg: '回复内容不能为空' };
  if (content.length > 200) return { ok: false, msg: '回复不能超过 200 字' };

  // doc().get() 在文档不存在时会抛错，统一 catch 成 null
  const r = await db.collection('reviews').doc(reviewId).get().catch(() => null);
  const review = r && r.data;
  if (!review) return { ok: false, msg: '点评不存在' };
  // 只允许被点评的学生本人回复，防止按 id 越权回复别人的点评
  if (review.studentOpenid !== OPENID) return { ok: false, msg: '只能回复自己收到的点评' };

  await db.collection('reviews').doc(reviewId).update({
    data: { reply: content, replyTs: Date.now() }
  });
  return { ok: true };
};
