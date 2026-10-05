const app = getApp();

Page({
  data: {
    all: [],
    list: [],
    tab: 'all',
    className: '未设置班级',
    name: '',
    tabs: [
      { key: 'all', label: '全部' },
      { key: '待完成', label: '待完成' },
      { key: '已提交', label: '已提交' }
    ]
  },

  onShow() {
    const p = app.getProfile('student');
    this.setData({
      className: p.className || '未设置班级',
      name: p.name || ''
    });
    this.load();
  },

  load() {
    app
      .cloudListHomework()
      .then((r) => {
        const list = (r.list || []).map((h) => ({
          id: h._id,
          subject: h.subject,
          title: h.title,
          deadline: h.deadline || '未设置',
          status: h.myStatus || '待完成'
        }));
        this.setData({ all: list });
        this.applyTab();
      })
      .catch(() => {});

    app
      .cloudMyClass()
      .then((rr) => {
        if (rr.class && rr.class.name) this.setData({ className: rr.class.name });
        if (rr.user && rr.user.name) this.setData({ name: rr.user.name });
      })
      .catch(() => {});
  },

  setTab(e) {
    this.setData({ tab: e.currentTarget.dataset.key });
    this.applyTab();
  },

  applyTab() {
    const { all, tab } = this.data;
    this.setData({
      list: tab === 'all' ? all : all.filter((h) => h.status === tab)
    });
  },

  onSubmit(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提交作业',
      editable: true,
      placeholderText: '可填写答案要点 / 说明（选填）',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '提交中' });
        app
          .cloudSubmitHomework(id, res.content || '')
          .then((r) => {
            wx.hideLoading();
            if (r.ok) {
              wx.showToast({ title: '已提交', icon: 'success' });
              this.load();
            } else {
              wx.showToast({ title: r.msg || '提交失败', icon: 'none' });
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
