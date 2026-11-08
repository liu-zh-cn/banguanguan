const app = getApp();
const { markDirty, clearDirty } = require('../../../utils/guard');
const { DEFAULT_SUBJECTS } = require('../../../utils/constants');

Page({
  data: {
    subjects: DEFAULT_SUBJECTS,
    subjectIndex: 0,
    title: '',
    content: '',
    deadline: '',
    list: [],
    truncated: false,
    loading: false
  },

  onShow() {
    this.loadList();
  },

  loadList() {
    this.setData({ loading: true });
    app
      .cloudListHomework()
      .then((r) => {
        const list = ((r && r.list) || []).map((h) => ({
          ...h,
          id: h._id,
          lateCount: h.late || 0,
          // done 已由云函数限定为「本班在册学生的提交」，这里再限一次上限兜底
          pct: h.total ? Math.min(100, Math.round((h.done / h.total) * 100)) : 0
        }));
        this.setData({ loading: false, list, truncated: !!(r && r.truncated) });
      })
      .catch(() => {
        this.setData({ loading: false });
        // 失败不能静默：否则页面看起来像「没有作业」
        wx.showToast({ title: '网络/云函数错误', icon: 'none' });
      });
  },

  onSubject(e) {
    markDirty(this, '作业还没发布，确定离开吗？');
    this.setData({ subjectIndex: Number(e.detail.value) });
  },
  onTitle(e) {
    markDirty(this, '作业还没发布，确定离开吗？');
    this.setData({ title: e.detail.value });
  },
  onContent(e) {
    markDirty(this, '作业还没发布，确定离开吗？');
    this.setData({ content: e.detail.value });
  },
  onDate(e) {
    markDirty(this, '作业还没发布，确定离开吗？');
    this.setData({ deadline: e.detail.value });
  },

  submit() {
    // 防重复提交：布置作业不幂等，网络慢时连点会建出多条同名作业
    if (this._submitting) return;
    const { subjects, subjectIndex, title, content, deadline } = this.data;
    if (!title.trim()) {
      wx.showToast({ title: '请填写作业标题', icon: 'none' });
      return;
    }
    this._submitting = true;
    wx.showLoading({ title: '发布中', mask: true });
    app
      .cloudAssignHomework({
        subject: subjects[subjectIndex],
        title,
        content,
        deadline
      })
      .then((res) => {
        wx.hideLoading();
        this._submitting = false;
        if (!res.ok) {
          wx.showToast({ title: res.msg || '发布失败', icon: 'none' });
          return;
        }
        clearDirty(this);
        this.setData({ title: '', content: '', deadline: '' });
        wx.showToast({ title: '布置成功', icon: 'success' });
        this.loadList();
      })
      .catch(() => {
        wx.hideLoading();
        this._submitting = false;
        wx.showToast({ title: '请检查云函数/网络', icon: 'none' });
      });
  },

  // 撤回作业：连带学生提交记录一起删，删前必须确认
  // 点进度看未交名单：一次弹窗，确认即复制全部姓名（上屏只显示前 20 个，避免弹窗被撑爆）
  showMissing(e) {
    const id = e.currentTarget.dataset.id;
    const title = e.currentTarget.dataset.title || '作业';
    if (!id) return;

    wx.showLoading({ title: '统计中', mask: true });
    app
      .cloudHomeworkDetail(id)
      .then((r) => {
        wx.hideLoading();
        if (!r || !r.ok) {
          wx.showToast({ title: (r && r.msg) || '查询失败', icon: 'none' });
          return;
        }
        const missing = r.missing || [];
        if (!missing.length) {
          wx.showModal({
            title: '未交名单',
            content: '「' + title + '」全班 ' + r.total + ' 人都交了 👍',
            showCancel: false
          });
          return;
        }
        const full = missing.map((x) => (x.no ? x.no + ' ' : '') + x.name).join('、');
        const shown = missing.slice(0, 20).map((x) => (x.no ? x.no + ' ' : '') + x.name).join('、');
        wx.showModal({
          title: '未交 ' + missing.length + '/' + r.total + ' 人',
          content: shown + (missing.length > 20 ? ' 等 ' + missing.length + ' 人' : ''),
          confirmText: '复制名单',
          success: (res) => {
            if (res.confirm) wx.setClipboardData({ data: full });
          }
        });
      })
      .catch(() => {
        wx.hideLoading();
        app.showError('查询失败，请检查网络');
      });
  },

  remove(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find((h) => h.id === id);
    if (!item) return;
    if (this._removing) return;
    wx.showModal({
      title: '撤回作业',
      content: '确定撤回「' + item.title + '」？\n已交的 ' + (item.done || 0) + ' 份提交记录会一并删除，且无法恢复。',
      confirmText: '撤回',
      confirmColor: '#E23B41',
      success: (res) => {
        if (!res.confirm) return;
        this._removing = true;
        wx.showLoading({ title: '撤回中' });
        app
          .cloudDeleteHomework(id)
          .then((r) => {
            wx.hideLoading();
            this._removing = false;
            if (!r.ok) {
              wx.showToast({ title: r.msg || '撤回失败', icon: 'none' });
              return;
            }
            wx.showToast({ title: '已撤回', icon: 'success' });
            this.loadList();
          })
          .catch(() => {
            wx.hideLoading();
            this._removing = false;
            wx.showToast({ title: '网络/云函数错误', icon: 'none' });
          });
      }
    });
  }
});
