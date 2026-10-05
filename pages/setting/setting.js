const app = getApp();

Page({
  data: {
    role: 'teacher',
    profile: {},
    openidShort: ''
  },

  onShow() {
    const role = wx.getStorageSync('role') || 'teacher';
    const openid = app.globalData.openid || wx.getStorageSync('openid') || '';
    this.setData({
      role,
      profile: app.getProfile(role),
      openidShort: openid ? openid.slice(0, 12) + '…' : '未登录'
    });
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/edit-profile/edit-profile?role=' + this.data.role });
  },

  clearCache() {
    wx.showModal({
      title: '清除本地缓存',
      content: '将清除本机保存的资料、班级绑定等（云端数据不受影响）',
      success: (r) => {
        if (!r.confirm) return;
        ['profile_teacher', 'profile_student', 'myClasses', 'screen_classId', 'screen_className']
          .forEach((k) => wx.removeStorageSync(k));
        wx.showToast({ title: '已清除', icon: 'success' });
        this.onShow();
      }
    });
  },

  about() {
    wx.showModal({
      title: '关于 班管管',
      content: 'v1.0.0\n帮助老师管理班级：统计 · 作业 · 成绩 · 点评 · 大屏广播',
      showCancel: false
    });
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定退出并切换身份？',
      success: (r) => {
        if (!r.confirm) return;
        wx.removeStorageSync('role');
        wx.removeStorageSync('openid');
        app.globalData.openid = '';
        app.globalData.userInfo = null;
        wx.reLaunch({ url: '/pages/index/index' });
      }
    });
  }
});
