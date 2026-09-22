const app = getApp();

Page({
  data: {
    role: 'teacher',
    name: '',
    className: '',
    subject: '',
    studentNo: '',
    submitting: false
  },

  setRole(e) {
    this.setData({ role: e.currentTarget.dataset.role });
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },

  submit() {
    const { role, name, className, subject, studentNo, submitting } = this.data;
    if (submitting) return;
    if (!name.trim()) return this.warn('请填写姓名');

    this.setData({ submitting: true });
    wx.showLoading({ title: '注册中...' });

    // 1. 确保已拿到 openid
    const ensureOpenid = app.globalData.openid
      ? Promise.resolve({ openid: app.globalData.openid })
      : app.cloudLogin();

    ensureOpenid
      .then((r) => {
        if (!r.openid) throw new Error('no-openid');
        // 2. 写入 users 表
        return app.cloudRegister({
          role,
          name: name.trim(),
          className: className.trim(),
          subject: role === 'teacher' ? subject.trim() : '',
          studentNo: role === 'student' ? studentNo.trim() : ''
        });
      })
      .then((res) => {
        wx.hideLoading();
        if (!res.ok) {
          this.setData({ submitting: false });
          return this.warn(res.msg || '注册失败');
        }
        // 3. 本地缓存一份资料，用于界面展示
        const profile = app.getProfile(role);
        profile.name = name.trim();
        if (className.trim()) profile.className = className.trim();
        if (role === 'teacher' && subject.trim()) profile.subject = subject.trim();
        if (role === 'student' && studentNo.trim()) profile.studentNo = studentNo.trim();
        app.saveProfile(role, profile);
        app.globalData.userInfo = res;

        app.setRole(role);
        wx.showToast({ title: '注册成功', icon: 'success' });
        setTimeout(() => {
          const url = role === 'teacher'
            ? '/pages/teacher/stats/stats'
            : '/pages/student/homework/homework';
          wx.reLaunch({ url });
        }, 700);
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({ submitting: false });
        console.error('注册失败：', err);
        wx.showModal({
          title: '注册失败',
          content: '请确认已开通云开发、部署 login/register 云函数、并新建 users 集合。',
          showCancel: false
        });
      });
  },

  warn(msg) {
    wx.showToast({ title: msg, icon: 'none' });
  },

  goLogin() {
    wx.redirectTo({ url: '/pages/login/login' });
  }
});
