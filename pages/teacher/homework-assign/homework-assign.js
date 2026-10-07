const app = getApp();

Page({
  data: {
    subjects: ['语文', '数学', '英语', '物理', '化学', '生物'],
    subjectIndex: 0,
    title: '',
    content: '',
    deadline: '',
    list: [],
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
          pct: h.total ? Math.round((h.done / h.total) * 100) : 0
        }));
        this.setData({ loading: false, list });
      })
      .catch(() => this.setData({ loading: false }));
  },

  onSubject(e) {
    this.setData({ subjectIndex: Number(e.detail.value) });
  },
  onTitle(e) {
    this.setData({ title: e.detail.value });
  },
  onContent(e) {
    this.setData({ content: e.detail.value });
  },
  onDate(e) {
    this.setData({ deadline: e.detail.value });
  },

  submit() {
    const { subjects, subjectIndex, title, content, deadline } = this.data;
    if (!title.trim()) {
      wx.showToast({ title: '请填写作业标题', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '发布中' });
    app
      .cloudAssignHomework({
        subject: subjects[subjectIndex],
        title,
        content,
        deadline
      })
      .then((res) => {
        wx.hideLoading();
        if (!res.ok) {
          wx.showToast({ title: res.msg || '发布失败', icon: 'none' });
          return;
        }
        this.setData({ title: '', content: '', deadline: '' });
        wx.showToast({ title: '布置成功', icon: 'success' });
        this.loadList();
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '请检查云函数/网络', icon: 'none' });
      });
  },

  // 撤回作业：连带学生提交记录一起删，删前必须确认
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
