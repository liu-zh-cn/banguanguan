const app = getApp();
const { applyTheme, getMode, setMode } = require('../../utils/theme');

// 当前小程序版本 / 环境：正式版有 version，开发版和体验版取不到，用环境标识兜底
function getVersionInfo() {
  try {
    const mp = (wx.getAccountInfoSync() || {}).miniProgram || {};
    const envText = { develop: '开发版', trial: '体验版', release: '正式版' };
    return {
      version: mp.version || '开发预览',
      envText: envText[mp.envVersion] || '未知环境'
    };
  } catch (e) {
    return { version: '未知', envText: '未知环境' };
  }
}

Page({
  data: {
    role: 'teacher',
    profile: {},
    openidShort: '',
    version: '未知',
    envText: '',
    themeMode: 'auto',
    themeText: '跟随系统'
  },

  onShow() {
    applyTheme(this);
    const role = wx.getStorageSync('role') || 'teacher';
    const openid = app.globalData.openid || wx.getStorageSync('openid') || '';
    const ver = getVersionInfo();
    const mode = getMode();
    this.setData({
      role,
      profile: app.getProfile(role),
      openidShort: openid ? openid.slice(0, 12) + '…' : '未登录',
      version: ver.version,
      envText: ver.envText,
      themeMode: mode,
      themeText: { auto: '跟随系统', dark: '深色', light: '浅色' }[mode]
    });
  },

  // 主题：跟随系统 / 深色 / 浅色。改完立刻应用到当前页，返回其它页时 onShow 也会重新应用
  pickTheme() {
    const list = ['跟随系统', '深色', '浅色'];
    const keys = ['auto', 'dark', 'light'];
    wx.showActionSheet({
      itemList: list,
      success: (res) => {
        const mode = keys[res.tapIndex];
        if (!mode || mode === this.data.themeMode) return;
        setMode(mode);
        applyTheme(this);
        this.setData({
          themeMode: mode,
          themeText: list[res.tapIndex]
        });
        wx.showToast({ title: '已切换为' + list[res.tapIndex], icon: 'none' });
      }
    });
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/edit-profile/edit-profile?role=' + this.data.role });
  },

  // 隐私政策 / 用户服务协议：审核要求的长期可查入口
  goPrivacy() {
    app.openPrivacy('privacy');
  },

  goAgreement() {
    app.openPrivacy('agreement');
  },

  clearCache() {
    wx.showModal({
      title: '清除本地缓存',
      content: '将清除本机保存的资料、班级绑定等（云端数据不受影响）',
      success: (r) => {
        if (!r.confirm) return;
        ['profile_teacher', 'profile_student', 'myClasses', 'screen_classId', 'screen_className', 'screen_code']
          .forEach((k) => wx.removeStorageSync(k));
        wx.showToast({ title: '已清除', icon: 'success' });
        this.onShow();
      }
    });
  },

  about() {
    wx.showModal({
      title: '关于 班管管',
      content: this.data.version + '（' + this.data.envText + '）\n帮助老师管理班级：统计 · 作业 · 成绩 · 点评 · 大屏广播',
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
