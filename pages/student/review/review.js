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
    list: []
  },

  onShow() {
    this.loadList();
  },

  loadList() {
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
            reply: x.reply || '',
            replyTime: x.replyTs ? fmtTime(x.replyTs) : '',
            tagCls: t.cls,
            avatarColor: t.color
          };
        });
        this.setData({ list });
      })
      .catch(() => {});
  },

  // 回复老师：已回复过则弹窗预填旧内容，可修改
  reply(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find((x) => x.id === id);
    if (!item) return;
    wx.showModal({
      title: item.reply ? '修改回复' : '回复老师',
      editable: true,
      placeholderText: '写点什么回复老师…（200 字内）',
      content: item.reply || '',
      success: (r) => {
        if (!r.confirm) return;
        const content = (r.content || '').trim();
        if (!content) {
          wx.showToast({ title: '回复内容不能为空', icon: 'none' });
          return;
        }
        if (content.length > 200) {
          wx.showToast({ title: '回复不能超过 200 字', icon: 'none' });
          return;
        }
        wx.showLoading({ title: '发送中' });
        app
          .cloudReplyReview(id, content)
          .then((res) => {
            wx.hideLoading();
            if (!res.ok) {
              wx.showToast({ title: res.msg || '发送失败', icon: 'none' });
              return;
            }
            wx.showToast({ title: '已回复', icon: 'success' });
            // 本地同步更新，避免整页重拉造成闪动
            const idx = this.data.list.findIndex((x) => x.id === id);
            if (idx > -1) {
              this.setData({
                ['list[' + idx + '].reply']: content,
                ['list[' + idx + '].replyTime']: fmtTime(Date.now())
              });
            }
          })
          .catch(() => {
            wx.hideLoading();
            wx.showToast({ title: '网络/云函数错误', icon: 'none' });
          });
      }
    });
  }
});
