const app = getApp();

Page({
  data: {
    role: 'teacher',
    logging: false,
    // 体验登录（不校验身份）只在开发版/体验版展示，正式版不给入口
    isDemoEnv: true
  },

  onLoad() {
    let env = 'develop';
    try {
      env = (wx.getAccountInfoSync() || {}).miniProgram.envVersion || 'develop';
    } catch (e) {
      // 取不到就按开发环境处理，避免影响本地调试
    }
    this.setData({ isDemoEnv: env !== 'release' });
  },

  setRole(e) {
    this.setData({ role: e.currentTarget.dataset.role });
  },

  // 微信一键登录：调云函数拿 openid，再判断是否已注册
  wechatLogin() {
    if (this.data.logging) return;
    this.setData({ logging: true });
    wx.showLoading({ title: '登录中...' });

    app.cloudLogin()
      .then((r) => {
        wx.hideLoading();
        this.setData({ logging: false });

        if (!r.openid) {
          wx.showToast({ title: '未获取到 openid', icon: 'none' });
          return;
        }
        if (r.user) {
          // 已注册，拉取班级上下文后进入对应端
          app.cloudMyClass()
            .then(() => this.enter(r.user.role || 'teacher'))
            .catch(() => this.enter(r.user.role || 'teacher'));
        } else {
          // 未注册，去完善资料
          wx.showModal({
            title: '欢迎',
            content: '检测到你的微信尚未注册，去完善资料？',
            confirmText: '去注册',
            cancelText: '以后再说',
            success: (res) => {
              if (res.confirm) {
                wx.navigateTo({ url: '/pages/register/register?from=login' });
              }
            }
          });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({ logging: false });
        console.error('云登录失败：', err);
        wx.showModal({
          title: '登录失败',
          content: '请确认已开通云开发、已部署 login 云函数、并新建了 users 集合。',
          showCancel: false
        });
      });
  },

  // 本地体验登录（不依赖云，使用演示资料）；正式版已隐藏入口，这里再兜一道
  quickDemo() {
    if (!this.data.isDemoEnv) {
      wx.showToast({ title: '请使用微信一键登录', icon: 'none' });
      return;
    }
    this.enter(this.data.role);
  },

  enter(role) {
    app.setRole(role);
    const url = role === 'teacher'
      ? '/pages/teacher/stats/stats'
      : '/pages/student/homework/homework';
    wx.reLaunch({ url });
  },

  goRegister() {
    wx.navigateTo({ url: '/pages/register/register' });
  }
});
