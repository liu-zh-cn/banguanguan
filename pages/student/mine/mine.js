const app = getApp();

Page({
  data: {
    profile: {},
    stats: { rank: '—', todo: '—', review: '—' },
    menus: [
      { icon: '➕', label: '加入班级', extra: '输入邀请码', action: 'join' },
      { icon: '📇', label: '我的资料', extra: '查看 / 编辑', action: 'edit' },
      { icon: '✅', label: '我的作业', action: 'homework' },
      { icon: '🏆', label: '我的成绩', action: 'score' },
      { icon: '💬', label: '老师点评', action: 'review' },
      { icon: '⚙️', label: '设置', action: 'setting' }
    ]
  },

  onShow() {
    this.setData({ profile: app.getProfile('student') });
    app
      .cloudListHomework()
      .then((r) => {
        const todo = (r.list || []).filter((h) => (h.myStatus || '待完成') === '待完成').length;
        this.setData({ 'stats.todo': todo });
      })
      .catch(() => {});
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/edit-profile/edit-profile?role=student' });
  },

  onMenu(e) {
    const { action } = e.currentTarget.dataset;
    if (action === 'edit') {
      this.goEdit();
      return;
    }
    if (action === 'join') {
      this.joinClass();
      return;
    }
    const tabMap = {
      homework: '/pages/student/homework/homework',
      score: '/pages/student/score/score',
      review: '/pages/student/review/review'
    };
    if (tabMap[action]) {
      wx.reLaunch({ url: tabMap[action] });
      return;
    }
    if (action === 'setting') {
      wx.navigateTo({ url: '/pages/setting/setting' });
    }
  },

  joinClass() {
    wx.showModal({
      title: '加入班级',
      editable: true,
      placeholderText: '请输入班级邀请码',
      success: (res) => {
        if (!res.confirm || !res.content) return;
        wx.showLoading({ title: '加入中' });
        app.cloudJoinClass(res.content.trim())
          .then((r) => {
            wx.hideLoading();
            if (r.ok) {
              const p = app.getProfile('student');
              p.className = r.className;
              app.saveProfile('student', p);
              app.globalData.classId = r.classId;
              app.globalData.className = r.className;
              this.setData({ profile: p });
              wx.showToast({ title: '加入成功', icon: 'success' });
            } else {
              wx.showToast({ title: r.msg || '加入失败', icon: 'none' });
            }
          })
          .catch(() => {
            wx.hideLoading();
            wx.showToast({ title: '网络/云函数错误', icon: 'none' });
          });
      }
    });
  },

  switchRole() {
    wx.showModal({
      title: '切换身份',
      content: '确定要退出并切换身份吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('role');
          wx.removeStorageSync('openid');
          app.globalData.openid = '';
          app.globalData.userInfo = null;
          wx.reLaunch({ url: '/pages/index/index' });
        }
      }
    });
  }
});
