const app = getApp();
const { TYPE_MAP } = require('../../../utils/constants');
const { fmtTime } = require('../../../utils/format');
const { applyTheme } = require('../../../utils/theme');

Page({
  data: {
    list: [],
    truncated: false,
    repliedCount: 0
  },

  onShow() {
    applyTheme(this);
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
          truncated: !!r.truncated,
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
