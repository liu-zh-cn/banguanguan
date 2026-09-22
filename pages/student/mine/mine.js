const app = getApp();

Page({
  data: {
    profile: {},
    menus: [
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
    wx.showToast({ title: label, icon: 'none' });
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
