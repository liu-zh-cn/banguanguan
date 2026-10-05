const app = getApp();

Page({
  data: {},
  enter(e) {
    const role = e.currentTarget.dataset.role;
    wx.navigateTo({ url: '/pages/register/register?role=' + role });
  },

  goRegister() {
    wx.navigateTo({ url: '/pages/register/register' });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goScreen() {
    wx.navigateTo({ url: '/pages/screen/screen' });
  }
});
