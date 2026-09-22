const app = getApp();

Page({
  data: {},
  enter(e) {
    const role = e.currentTarget.dataset.role;
    app.setRole(role);
    const url = role === 'teacher'
      ? '/pages/teacher/stats/stats'
      : '/pages/student/homework/homework';
    wx.reLaunch({ url });
  },

  goRegister() {
    wx.navigateTo({ url: '/pages/register/register' });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  }
});
