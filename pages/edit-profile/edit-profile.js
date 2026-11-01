const app = getApp();

Page({
  data: {
    role: 'teacher',
    genders: ['男', '女'],
    genderIndex: 0,
    profile: {}
  },

  onLoad(options) {
    const role = options.role || wx.getStorageSync('role') || 'teacher';
    const profile = app.getProfile(role);
    this.setData({
      role,
      profile,
      genderIndex: profile.gender === '女' ? 1 : 0
    });
    wx.setNavigationBarTitle({ title: '编辑资料' });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['profile.' + field]: e.detail.value });
  },

  onGender(e) {
    const idx = Number(e.detail.value);
    this.setData({ genderIndex: idx, 'profile.gender': this.data.genders[idx] });
  },

  save() {
    const p = this.data.profile;
    const name = (p.name || '').trim();
    if (!name) {
      wx.showToast({ title: '请填写姓名', icon: 'none' });
      return;
    }
    this.doSave(name);
  },

  // 实际提交
  doSave(name) {
    // 防重复提交：快速双击会触发两次云调用和两个延时 navigateBack，把页面栈多弹一层
    if (this._saving) return;
    this._saving = true;
    const p = this.data.profile;

    // 本地立刻更新，界面不掉帧
    const next = Object.assign({}, p, { name });
    // 本版已不再收集手机号，顺手清掉本地可能残留的历史值
    delete next.phone;
    this.setData({ profile: next });
    app.saveProfile(this.data.role, next);

    // 同步到云端 users 表，失败要明确告诉用户，不能假装成功
    wx.showLoading({ title: '保存中' });
    app
      .cloudUpdateProfile({
        role: this.data.role,
        name,
        gender: next.gender || '',
        title: next.title || '',
        subject: next.subject || '',
        studentNo: next.studentNo || '',
        signature: next.signature || '',
        className: next.className || ''
      })
      .then((r) => {
        wx.hideLoading();
        this._saving = false;
        if (!r.ok) {
          wx.showToast({ title: r.msg || '保存失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: '已保存', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 600);
      })
      .catch(() => {
        wx.hideLoading();
        this._saving = false;
        wx.showModal({
          title: '保存失败',
          content: '资料已更新到本机，但没能同步到云端。请确认已部署 updateProfile 云函数并检查网络后重试。',
          showCancel: false
        });
      });
  }
});
