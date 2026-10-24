const app = getApp();

const TYPE_MAP = {
  '进步': { cls: 'tag-blue', color: '#5B7CFF' },
  '表扬': { cls: 'tag-green', color: '#24C8A0' },
  '建议': { cls: 'tag-orange', color: '#FFB020' }
};

// 时间戳 → "YYYY-MM-DD HH:mm"；缺 ts 的老数据显示 "—"，不假装是刚刚
function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    '-' + p(d.getMonth() + 1) +
    '-' + p(d.getDate()) +
    ' ' + p(d.getHours()) +
    ':' + p(d.getMinutes())
  );
}

Page({
  data: {
    list: [],
    repliedCount: 0
  },

  onShow() {
    app
      .cloudListReviews()
      .then((r) => {
        if (!r || r.role !== 'teacher') {
          this.setData({ list: [] });
          return;
        }
        const list = ((r && r.list) || []).map((x) => {
          const t = TYPE_MAP[x.type] || TYPE_MAP['建议'];
          return {
            id: x._id,
            student: x.studentName || '学生',
            subject: x.subject || '综合',
            time: fmtTime(x.ts),
            type: x.type || '建议',
            content: x.content || '',
            reply: x.reply || '',
            replyTime: x.replyTs ? fmtTime(x.replyTs) : '',
            tagCls: t.cls,
            avatarColor: t.color
          };
        });
        this.setData({
          list,
          repliedCount: list.filter((x) => x.reply).length
        });
      })
      .catch(() => {
        wx.showToast({ title: '加载失败，下拉重试', icon: 'none' });
      });
  },

  onPullDownRefresh() {
    this.onShow();
    wx.stopPullDownRefresh();
  }
});
