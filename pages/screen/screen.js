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
    if (classId) {
      this.setData({ bound: true, classId, className });
      this.startWatch();
    } else {
      this.setData({ status: '请绑定班级' });
    }
  },

  onUnload() {
    this.closeWatch();
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
        wx.setStorageSync('screen_classId', r.classId);
        wx.setStorageSync('screen_className', r.className);
        this.closeWatch();
        this.setData({
          bound: true,
          classId: r.classId,
          className: r.className,
          text: '',
          code: ''
        });
        this.startWatch();
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
        this.closeWatch();
        wx.removeStorageSync('screen_classId');
        wx.removeStorageSync('screen_className');
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

  startWatch() {
    if (!wx.cloud) {
      this.setData({ status: '环境不支持云开发' });
      return;
    }
    const db = wx.cloud.database();
    this._lastText = '';
    // 首次快照只是"当前状态"（含进入页面前就存在的旧广播），不能当成新消息朗读；再点「重播」即可
    this._speakReady = false;
    this.setData({ status: '正在连接…' });
    this._watcher = db
      .collection('broadcasts')
      .where({ classId: this.data.classId })
      .orderBy('ts', 'desc')
      .limit(1)
      .watch({
        onChange: (snapshot) => {
          this.setData({
            connected: true,
            status: '已连接 · ' + (this.data.className || '')
          });
          const doc = snapshot.docs && snapshot.docs[0];
          if (!this._speakReady) {
            this._speakReady = true;
            if (doc && doc.text) {
              this._lastText = doc.text;
              this.setData({ text: doc.text });
            }
            return;
          }
          if (doc && doc.text && doc.text !== this._lastText) {
            this._lastText = doc.text;
            this.setData({ text: doc.text });
            this.speak(doc.text);
          }
        },
        onError: (e) => {
          console.error(e);
          this.setData({
            connected: false,
            status: '监听中断：检查 broadcasts 集合权限（需所有人可读）'
          });
        }
      });
  },

  closeWatch() {
    if (this._watcher) {
      this._watcher.close();
      this._watcher = null;
    }
  },

  // 调 tts 云函数拿到音频并播放
  speak(text) {
    this.setData({ speaking: true });
    wx.cloud
      .callFunction({ name: 'tts', data: { text } })
      .then((res) => {
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
      .catch(() => this.setData({ speaking: false }));
  },

  replay() {
    if (this.data.text) this.speak(this.data.text);
  }
});
