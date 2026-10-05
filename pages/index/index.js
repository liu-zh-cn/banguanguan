const app = getApp();

Page({
  data: {},

  go(url) {
    wx.navigateTo({
      url,
      fail: (err) => {
        wx.showModal({
          title: '跳转失败',
          content: (err && err.errMsg) || String(err),
          showCancel: false
        });
      }
    });
  },

  enter(e) {
    const role = e.currentTarget.dataset.role;
    this.go('/pages/register/register?role=' + role);
  },

  goRegister() {
    this.go('/pages/register/register');
  },

  goLogin() {
    this.go('/pages/login/login');
  },

  goScreen() {
    this.go('/pages/screen/screen');
  }
});
