const app = getApp();

Page({
  data: {
    role: 'teacher',
    genders: ['男', '女'],
    genderIndex: 0,
    profile: {},
    // 手机号为个人信息，收集前须用户主动同意（审核要求）
    phoneAgree: false
  },

  onLoad(options) {
    const role = options.role || wx.getStorageSync('role') || 'teacher';
    const profile = app.getProfile(role);
    const agree = app.hasPhoneConsent();
    this.setData({
      role,
      profile,
      genderIndex: profile.gender === '女' ? 1 : 0,
      phoneAgree: agree
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

  // 同意 / 撤回同意保存手机号
  onPhoneAgree(e) {
    this.setData({ phoneAgree: !!e.detail.value });
    if (!e.detail.value) {
      wx.showToast({ title: '已撤回手机号授权', icon: 'none' });
    }
  },

  openPrivacy(e) {
    const tab = e.currentTarget.dataset.tab;
    app.openPrivacy(tab);
  },

  save() {
    const p = this.data.profile;
    const name = (p.name || '').trim();
    if (!name) {
      wx.showToast({ title: '请填写姓名', icon: 'none' });
      return;
    }

    // 手机号只对老师收集；学生端不显示该字段，这里固定传空（云端白名单也会忽略）
    const isTeacher = this.data.role === 'teacher';
    const phone = isTeacher ? (p.phone || '').trim() : '';
    const agree = isTeacher ? !!this.data.phoneAgree : false;

    // 手机号：格式校验
    if (phone && !/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }

    // 手机号：未同意不收集。填了但没勾选 → 引导去勾选，不静默丢弃
    if (phone && !agree) {
      wx.showModal({
        title: '需要你的同意',
        content:
          '手机号为个人信息。请先阅读《隐私政策》并打开「我同意」开关；选择「清除手机号」会删除已保存的手机号。',
        confirmText: '去勾选',
        cancelText: '清除手机号',
        success: (res) => {
          if (res.confirm) return;
          // 用户选择清除 → 手机号置空提交（撤回同意的结果）
          this.doSave(name, '', agree);
        }
      });
      return;
    }

    this.doSave(name, phone, agree);
  },

  // 实际提交。phone 传空字符串 = 用户不同意/选择不保存，此时云端手机号会被清空（撤回同意的结果）
  doSave(name, phone, agree) {
    const p = this.data.profile;

    // 本地立刻更新，界面不掉帧
    const next = Object.assign({}, p, { name, phone });
    this.setData({ profile: next });

    // 记录本次同意状态：不勾选则下次进入也不自动回填为"已同意"
    if (this.data.role === 'teacher') app.setPhoneConsent(agree);

    app.saveProfile(this.data.role, next);

    // 同步到云端 users 表，失败要明确告诉用户，不能假装成功
    wx.showLoading({ title: '保存中' });
    app
      .cloudUpdateProfile({
        role: this.data.role,
        name,
        gender: next.gender || '',
        phone,
        title: next.title || '',
        subject: next.subject || '',
        studentNo: next.studentNo || '',
        signature: next.signature || '',
        className: next.className || ''
      })
      .then((r) => {
        wx.hideLoading();
        if (!r.ok) {
          wx.showToast({ title: r.msg || '保存失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: '已保存', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 600);
      })
      .catch(() => {
        wx.hideLoading();
        wx.showModal({
          title: '保存失败',
          content: '资料已更新到本机，但没能同步到云端。请确认已部署 updateProfile 云函数并检查网络后重试。',
          showCancel: false
        });
      });
  }
});
