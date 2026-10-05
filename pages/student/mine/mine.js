const app = getApp();

Page({
  data: {
    profile: {},
    menus: [
      { icon: '➕', label: '加入班级', extra: '输入邀请码', action: 'join' },
      { icon: '📇', label: '个人档案', extra: '查看 / 编辑', action: 'edit' },
      { icon: '📅', label: '我的课表' },
      { icon: '✅', label: '作业记录', extra: '12 次' },
      { icon: '🏅', label: '我的荣誉', extra: '3 项' },
      { icon: '🔔', label: '消息通知', extra: '2 条未读' },
      { icon: '⚙️', label: '设置' }
    ]
  },

  onShow() {
    this.setData({ profile: app.getProfile('student') });
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/edit-profile/edit-profile?role=student' });
  },

  onMenu(e) {
    const { label, action } = e.currentTarget.dataset;
    if (action === 'edit') {
      this.goEdit();
      return;
    }
    if (action === 'join') {
      this.joinClass();
      return;
    }
    wx.showToast({ title: label, icon: 'none' });
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
