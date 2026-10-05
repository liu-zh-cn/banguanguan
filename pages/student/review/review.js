const app = getApp();

const TYPE_MAP = {
  '进步': { cls: 'tag-blue', color: '#5B7CFF' },
  '表扬': { cls: 'tag-green', color: '#24C8A0' },
  '建议': { cls: 'tag-orange', color: '#FFB020' }
};

// 时间戳 → "YYYY-MM-DD HH:mm"
function fmtTime(ts) {
  const d = new Date(ts || Date.now());
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
    list: []
  },

  onShow() {
    app
      .cloudListReviews()
      .then((r) => {
        const list = ((r && r.list) || []).map((x) => {
          const t = TYPE_MAP[x.type] || TYPE_MAP['建议'];
          return {
            id: x._id,
            teacher: x.teacherName || '老师',
            subject: x.subject || '综合',
            time: fmtTime(x.ts),
            type: x.type || '建议',
            content: x.content || '',
            tagCls: t.cls,
            avatarColor: t.color
          };
        });
        this.setData({ list });
      })
      .catch(() => {});
  },

  reply(e) {
    wx.showToast({ title: '感谢老师！', icon: 'none' });
  }
});
