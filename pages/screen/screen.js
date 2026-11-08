// 大屏页：凭邀请码轮询本班最新广播。
// 为什么不用 db.watch：broadcasts 集合需要「所有用户可读」才能前端监听，
// 那等于任何人都能读全部班级的广播。改走云函数后集合可收紧为「仅创建者可读写」。
const POLL_MS = 5000; // 有新消息后的基础间隔；太密会吃云函数调用配额
const POLL_MAX_MS = 30000; // 长时间没有新消息时退避到这个上限
const { applyTheme } = require('../../utils/theme');

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
    applyTheme(this);
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
    this.stopAudio();
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
        // 换绑前先停掉上一个班的语音，否则新班页面会继续播旧班的内容
        this.stopAudio();
        this._inviteCode = code.toUpperCase();
        // 换绑新班级：重置静默基线，新班的当前广播只显示不朗读，避免拿旧 _lastTs 误判
        this._speakReady = undefined;
        this._lastTs = 0;
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
        this.stopAudio();
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
    if (this._pollActive) return;
    if (!this._inviteCode) return;
    this._pollActive = true;
    this._polling = false;
    this._pollDelay = POLL_MS;
    // 首次拿到的是"当前状态"（可能含进页面之前就存在的旧广播），只显示不朗读；想听点「重播」。
    // 注意：只有"从未就绪"才建立静默基线。息屏/切后台（onHide 停轮询）回来恢复时要保留
    // _lastTs，否则隐藏期间收到的新广播回来后只显示不播报——语音播报就白做了
    if (this._speakReady === undefined) {
      this._speakReady = false;
      this._lastTs = 0;
    }
    this.setData({ status: '正在连接…', connected: false });
    this.poll();
  },

  stopPolling() {
    this._pollActive = false;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  },

  // 没有新广播时逐步退避到 30 秒，收到新消息立即回到 5 秒：
  // 大屏常开一天，固定 5 秒轮询是上万次调用；退避后新消息最迟 30 秒上屏
  scheduleNext(delay) {
    if (!this._pollActive || this._unloaded) return;
    this._pollDelay = delay;
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this.poll(), delay);
  },

  poll() {
    if (this._unloaded || this._polling || !this._pollActive) return;
    this._polling = true;
    getApp()
      .cloudGetBroadcast(this._inviteCode)
      .then((r) => {
        this._polling = false;
        if (this._unloaded || !this._pollActive) return;
        if (!r || !r.ok) {
          const msg = (r && r.msg) || '获取广播失败';
          // 邀请码失效（班级被删/码被改）属于不可恢复错误：
          // 继续轮询只会整夜白烧云函数调用配额，停轮询让用户重新绑定。
          // 优先按云函数返回的 code 判断；msg 兜底兼容尚未重新部署的旧云函数
          const fatalCode = r && (r.code === 'INVALID_INVITE' || r.code === 'MISSING_INVITE_CODE');
          const legacyFatal = msg === '邀请码无效' || msg === '缺少邀请码';
          if (fatalCode || legacyFatal) {
            this.stopPolling();
            wx.removeStorageSync('screen_classId');
            wx.removeStorageSync('screen_code');
            this.setData({
              bound: false,
              classId: '',
              connected: false,
              text: '',
              status: '邀请码已失效，请重新绑定班级'
            });
            return;
          }
          this.setData({ connected: false, status: msg });
          this.scheduleNext(Math.min(this._pollDelay * 2, POLL_MAX_MS));
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
          this.scheduleNext(POLL_MS);
          return;
        }
        if (b && b.ts && b.ts !== this._lastTs) {
          this._lastTs = b.ts;
          this.setData({ text: b.text || '' });
          this.speak(b.text);
          this.scheduleNext(POLL_MS);
          return;
        }
        this.scheduleNext(Math.min(this._pollDelay * 2, POLL_MAX_MS));
      })
      .catch(() => {
        this._polling = false;
        if (this._unloaded || !this._pollActive) return;
        this.setData({ connected: false, status: '网络异常，重试中…' });
        this.scheduleNext(Math.min(this._pollDelay * 2, POLL_MAX_MS));
      });
  },

  // 停止并释放当前音频：切班 / 解绑 / 退出页面后不能继续播上一个班的内容
  stopAudio() {
    if (this._audio) {
      this._audio.destroy();
      this._audio = null;
    }
    if (!this._unloaded && this.data.speaking) this.setData({ speaking: false });
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
