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
    if (!p.name || !p.name.trim()) {
      wx.showToast({ title: '请填写姓名', icon: 'none' });
      return;
    }
    app.saveProfile(this.data.role, p);
    wx.showToast({ title: '已保存', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 600);
  }
});
