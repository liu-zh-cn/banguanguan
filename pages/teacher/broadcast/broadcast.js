const app = getApp();

Page({
  data: {
    name: '',
    location: '办公室',
    custom: '',
    sending: false,
    classId: '',
    className: '',
    history: []
  },

  onShow() {
    app.cloudMyClass()
      .then((r) => {
        if (r.user) {
          this.setData({
            classId: r.user.classId || '',
            className: r.user.className || ''
          });
        }
      })
      .catch(() => {});
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },

  // 组装要播报的文字
  buildText() {
    const custom = this.data.custom.trim();
    if (custom) return custom;
    const name = this.data.name.trim();
    const loc = this.data.location.trim() || '办公室';
    if (!name) return '';
    return '请 ' + name + ' 同学立即到 ' + loc + '。';
  },

  send() {
    if (this.data.sending) return;
    const text = this.buildText();
    if (!text) {
      wx.showToast({ title: '请填写姓名或广播内容', icon: 'none' });
      return;
    }
    if (!this.data.classId) {
      wx.showModal({
        title: '还没有班级',
        content: '广播按班级隔离，请先创建班级（我的 → 我的班级）。',
        showCancel: false
      });
      return;
    }
    this.setData({ sending: true });
    wx.showLoading({ title: '发送中' });
    app
      .cloudSendBroadcast(text)
      .then((res) => {
        wx.hideLoading();
        this.setData({ sending: false });
        if (res.ok) {
          this.setData({
            history: [{ text, time: this.now() }].concat(this.data.history).slice(0, 8),
            name: '',
            custom: ''
          });
          wx.showToast({ title: '已发送到大屏', icon: 'success' });
        } else {
          wx.showToast({ title: res.msg || '发送失败', icon: 'none' });
        }
      })
      .catch(() => {
        wx.hideLoading();
        this.setData({ sending: false });
        wx.showToast({ title: '请检查云函数/网络', icon: 'none' });
      });
  },

  now() {
    const d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  },

  openScreen() {
    wx.navigateTo({ url: '/pages/screen/screen' });
  }
});
