const app = getApp();

Page({
  data: {
    all: [],
    list: [],
    truncated: false,
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
          status: h.myStatus || '待完成',
          late: !!h.myLate,
          expired: !!h.expired
        }));
        this.setData({ all: list, truncated: !!r.truncated });
        this.applyTab();
      })
      .catch(() => app.showError('作业加载失败'));

    app
      .cloudMyClass()
      .then((rr) => {
        if (rr.class && rr.class.name) this.setData({ className: rr.class.name });
        if (rr.user && rr.user.name) this.setData({ name: rr.user.name });
      })
      .catch(() => app.showError('班级信息加载失败'));
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
              // 截止日之后再提交不拦，但要明确告诉学生这是迟交
              wx.showToast({ title: r.late ? '已提交（迟交）' : '已提交', icon: 'success' });
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
