// 页面：privacy —— 用户服务协议 & 隐私政策
// 审核要求：收集手机号等个人信息前，须以《用户服务协议》及《隐私政策》明确告知
Page({
  data: {
    tab: 'privacy' // 'privacy' | 'agreement'
  },

  onLoad(options) {
    const opts = options || {};
    if (opts.tab === 'agreement') {
      this.setData({ tab: 'agreement' });
    }
    wx.setNavigationBarTitle({
      title: this.data.tab === 'agreement' ? '用户服务协议' : '隐私政策'
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.tab) return;
    this.setData({ tab });
    wx.setNavigationBarTitle({
      title: tab === 'agreement' ? '用户服务协议' : '隐私政策'
    });
  }
});
