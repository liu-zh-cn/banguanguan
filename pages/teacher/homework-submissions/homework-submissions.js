const app = getApp();
const { applyTheme } = require('../../../utils/theme');

Page({
  data: {
    homeworkId: '',
    title: '作业',
    loading: true,
    done: [],
    missing: [],
    total: 0,
    doneCount: 0,
    lateCount: 0
  },

  onLoad(options) {
    applyTheme(this);
    const homeworkId = (options && options.homeworkId) || '';
    if (!homeworkId) {
      wx.showToast({ title: '缺少作业参数', icon: 'none' });
      return;
    }
    this.setData({
      homeworkId,
      title: decodeURIComponent((options && options.title) || '作业')
    });
    this.load();
  },

  load() {
    this.setData({ loading: true });
    app
      .cloudHomeworkDetail(this.data.homeworkId)
      .then((r) => {
        this.setData({ loading: false });
        if (!r || !r.ok) {
          wx.showToast({ title: (r && r.msg) || '加载失败', icon: 'none' });
          return;
        }
        const done = (r.done || []).map((x) => ({
          ...x,
          images: Array.isArray(x.images) ? x.images : []
        }));
        this.setData({
          done,
          missing: r.missing || [],
          total: r.total || 0,
          doneCount: r.doneCount || 0,
          lateCount: r.lateCount || 0
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        app.showError('提交详情加载失败');
      });
  },

  previewImage(e) {
    const { urls, current } = e.currentTarget.dataset;
    if (urls && urls.length) wx.previewImage({ urls, current });
  },

  copyMissing() {
    const missing = this.data.missing || [];
    if (!missing.length) {
      wx.showToast({ title: '全班都交了', icon: 'none' });
      return;
    }
    const text = missing.map((x) => (x.no ? x.no + ' ' : '') + x.name).join('、');
    wx.setClipboardData({ data: text });
  }
});
