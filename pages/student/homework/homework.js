const app = getApp();

Page({
  data: {
    all: [],
    list: [],
    truncated: false,
    dueTip: null,
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
        this.setData({ all: list, truncated: !!r.truncated, dueTip: this.buildDueTip(list) });
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

  // 今天的截止提醒：只数「今天/明天截止且还没交」的，超过两天的不打扰
  buildDueTip(list) {
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const now = new Date();
    const today = fmt(now);
    const tomorrow = fmt(new Date(now.getTime() + 24 * 3600 * 1000));

    let dueToday = 0;
    let dueTomorrow = 0;
    list.forEach((h) => {
      if (h.status === '已提交' || !h.deadline) return;
      if (h.deadline === today) dueToday++;
      else if (h.deadline === tomorrow) dueTomorrow++;
    });

    if (dueToday > 0) return { text: '今天有 ' + dueToday + ' 份作业截止', urgent: true };
    if (dueTomorrow > 0) return { text: '明天有 ' + dueTomorrow + ' 份作业截止', urgent: false };
    return null;
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
        const content = res.content || '';
        if (content.length > 2000) {
          wx.showToast({ title: '内容不能超过 2000 字', icon: 'none' });
          return;
        }
        wx.showLoading({ title: '提交中' });
        app
          .cloudSubmitHomework(id, content)
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
