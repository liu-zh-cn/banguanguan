Page({
  data: {
    text: '',
    status: '正在连接大屏…',
    connected: false,
    speaking: false
  },

  onLoad() {
    if (!wx.cloud) {
      this.setData({ status: '当前环境不支持云开发' });
      return;
    }
    const db = wx.cloud.database();
    this._lastText = '';
    this._watcher = db
      .collection('broadcasts')
      .orderBy('ts', 'desc')
      .limit(1)
      .watch({
        onChange: (snapshot) => {
          this.setData({ connected: true, status: '大屏已连接 · 实时监听中' });
          const doc = snapshot.docs && snapshot.docs[0];
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
            status: '监听中断：请检查 broadcasts 集合权限（需所有人可读）'
          });
        }
      });
  },

  onUnload() {
    if (this._watcher) this._watcher.close();
    if (this._audio) this._audio.destroy();
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
