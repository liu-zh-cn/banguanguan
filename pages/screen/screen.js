// 大屏页：凭邀请码轮询本班最新广播。
// 为什么不用 db.watch：broadcasts 集合需要「所有用户可读」才能前端监听，
// 那等于任何人都能读全部班级的广播。改走云函数后集合可收紧为「仅创建者可读写」。
const POLL_MS = 5000; // 5 秒一轮；太密会吃云函数调用配额，5 秒对"请学生到办公室"够用

Page({
  data: {
    bound: false,
    classId: '',
    className: '',
    code: '',
    text: '',
    status: '',
    connected: false,
    speaking: false
  },

  onLoad() {
    const classId = wx.getStorageSync('screen_classId') || '';
    const className = wx.getStorageSync('screen_className') || '';
    const inviteCode = wx.getStorageSync('screen_code') || '';
    this._inviteCode = inviteCode;
    if (classId && inviteCode) {
      this.setData({ bound: true, classId, className });
    } else if (classId) {
      // 老版本只存了 classId，没有邀请码就没法通过云函数校验，需要重新绑一次
      this.setData({ status: '请重新输入邀请码完成绑定' });
    } else {
      this.setData({ status: '请绑定班级' });
    }
  },

  onShow() {
    if (this.data.bound) this.startPolling();
  },

  onHide() {
    // 页面不可见时停掉，避免白烧调用次数
    this.stopPolling();
  },

  onUnload() {
    // 标记已卸载：tts 是异步的，回来时页面可能已经销毁，不能再 setData
    this._unloaded = true;
    this.stopPolling();
    if (this._audio) this._audio.destroy();
  },

  onCode(e) {
    this.setData({ code: e.detail.value });
  },

  bind() {
    const code = this.data.code.trim();
    if (!code) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '绑定中' });
    getApp()
      .cloudGetClassByCode(code)
      .then((r) => {
        wx.hideLoading();
        if (!r.ok) {
          wx.showToast({ title: r.msg || '绑定失败', icon: 'none' });
          return;
        }
        this._inviteCode = code.toUpperCase();
        wx.setStorageSync('screen_classId', r.classId);
        wx.setStorageSync('screen_className', r.className);
        wx.setStorageSync('screen_code', this._inviteCode);
        this.stopPolling();
        this.setData({
          bound: true,
          classId: r.classId,
          className: r.className,
          text: '',
          code: ''
        });
        this.startPolling();
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '网络/云函数错误', icon: 'none' });
      });
  },

  unbind() {
    wx.showModal({
      title: '切换班级',
      content: '解除当前班级绑定？',
      success: (res) => {
        if (!res.confirm) return;
        this.stopPolling();
        this._inviteCode = '';
        wx.removeStorageSync('screen_classId');
        wx.removeStorageSync('screen_className');
        wx.removeStorageSync('screen_code');
        this.setData({
          bound: false,
          classId: '',
          className: '',
          text: '',
          connected: false,
          status: '请绑定班级'
        });
      }
    });
  },

  startPolling() {
    if (this._timer) return;
    if (!this._inviteCode) return;
    this._polling = false;
    // 首次拿到的是"当前状态"（可能含进页面之前就存在的旧广播），只显示不朗读；想听点「重播」
    this._speakReady = false;
    this._lastTs = 0;
    this.setData({ status: '正在连接…' });
    this.poll();
    this._timer = setInterval(() => this.poll(), POLL_MS);
  },

  stopPolling() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  poll() {
    if (this._unloaded || this._polling) return;
    this._polling = true;
    getApp()
      .cloudGetBroadcast(this._inviteCode)
      .then((r) => {
        this._polling = false;
        if (this._unloaded) return;
        if (!r || !r.ok) {
          this.setData({ connected: false, status: (r && r.msg) || '获取广播失败' });
          return;
        }
        if (r.className && r.className !== this.data.className) {
          wx.setStorageSync('screen_className', r.className);
          this.setData({ className: r.className });
        }
        this.setData({
          connected: true,
          status: '已连接 · ' + (r.className || this.data.className || '')
        });

        const b = r.broadcast;
        // 第一次轮询只记录当前状态：即使此时还没有广播，也算"已就绪"，
        // 否则第一条广播会被当成首屏旧消息、只显示不朗读
        if (!this._speakReady) {
          this._speakReady = true;
          this._lastTs = b ? b.ts || 0 : 0;
          if (b) this.setData({ text: b.text || '' });
          return;
        }
        if (b && b.ts && b.ts !== this._lastTs) {
          this._lastTs = b.ts;
          this.setData({ text: b.text || '' });
          this.speak(b.text);
        }
      })
      .catch(() => {
        this._polling = false;
        if (this._unloaded) return;
        this.setData({ connected: false, status: '网络异常，重试中…' });
      });
  },

  // 调 tts 云函数拿到音频并播放
  speak(text) {
    if (this._unloaded || !text) return;
    this.setData({ speaking: true });
    wx.cloud
      .callFunction({ name: 'tts', data: { text } })
      .then((res) => {
        if (this._unloaded) return; // 页面已退出，丢弃结果
        const r = (res && res.result) || {};
        if (!r.ok || !r.fileID) {
          this.setData({ speaking: false });
          return;
        }
        if (this._audio) this._audio.destroy();
        const audio = wx.createInnerAudioContext();
        audio.src = r.fileID;
        audio.autoplay = true;
        audio.onEnded(() => this.setData({ speaking: false }));
        audio.onError(() => this.setData({ speaking: false }));
        audio.play();
        this._audio = audio;
      })
      .catch(() => {
        if (!this._unloaded) this.setData({ speaking: false });
      });
  },

  replay() {
    if (this.data.text) this.speak(this.data.text);
  }
});
