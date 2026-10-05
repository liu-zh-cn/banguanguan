const app = getApp();

Page({
  data: {
    profile: {},
    menus: [
      { icon: '🏫', label: '我的班级', extra: '管理 / 创建', action: 'class' },
      { icon: '🎟️', label: '班级邀请码', extra: '分享给学生', action: 'code' },
      { icon: '🔔', label: '消息通知', extra: '3 条未读' },
      { icon: '👨‍👩‍👧', label: '家长联系' },
      { icon: '📅', label: '课程表' },
      { icon: '⚙️', label: '设置' },
      { icon: '❓', label: '帮助与反馈' }
    ]
  },

  onShow() {
    this.setData({ profile: app.getProfile('teacher') });
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/edit-profile/edit-profile?role=teacher' });
  },

  onMenu(e) {
    const { label, action } = e.currentTarget.dataset;
    if (action === 'class') {
      wx.navigateTo({ url: '/pages/create-class/create-class' });
      return;
    }
    if (action === 'code') {
      this.showInviteCode();
      return;
    }
    wx.showToast({ title: label, icon: 'none' });
  },

  showInviteCode() {
    wx.showLoading({ title: '查询中' });
    app.cloudMyClass()
      .then((r) => {
        wx.hideLoading();
        if (r.class && r.class.inviteCode) {
          wx.showModal({
            title: r.class.name,
            content: '邀请码：' + r.class.inviteCode + '\n学生注册或“加入班级”时填写即可加入',
            confirmText: '复制',
            success: (res) => {
              if (res.confirm) wx.setClipboardData({ data: r.class.inviteCode });
            }
          });
        } else {
          wx.showToast({ title: '你还没有班级', icon: 'none' });
        }
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '查询失败', icon: 'none' });
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
