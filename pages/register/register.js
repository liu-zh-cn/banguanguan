const app = getApp();

Page({
  data: {
    role: 'teacher',
    name: '',
    className: '',
    subject: '',
    studentNo: '',
    inviteCode: '',
    submitting: false
  },

  onLoad(options) {
    if (options && (options.role === 'teacher' || options.role === 'student')) {
      this.setData({ role: options.role });
    }
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
    if (!className.trim()) return this.warn('请填写所在班级');

    this.setData({ submitting: true });
    wx.showLoading({ title: '注册中...' });

    // 服务端最终身份：老用户不会被 register 改角色，跳转以它为准
    let finalRole = role;

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
        if (!res.ok) {
          wx.hideLoading();
          this.setData({ submitting: false });
          this.warn(res.msg || '注册失败');
          return false;
        }
        finalRole = res.role || role;
        // 学生填了邀请码 → 加入班级
        const inviteCode = this.data.inviteCode.trim();
        if (finalRole === 'student' && inviteCode) {
          return app.cloudJoinClass(inviteCode);
        }
        return { ok: true };
      })
      .then((j) => {
        if (j === false) return;
        wx.hideLoading();
        if (j && j.ok === false) {
          this.setData({ submitting: false });
          return this.warn(j.msg || '加入班级失败');
        }
        // 本地缓存一份资料，用于界面展示
        const profile = app.getProfile(finalRole);
        profile.name = name.trim();
        if (className.trim()) profile.className = className.trim();
        if (j && j.className) profile.className = j.className;
        if (finalRole === 'teacher' && subject.trim()) profile.subject = subject.trim();
        if (finalRole === 'student' && studentNo.trim()) profile.studentNo = studentNo.trim();
        app.saveProfile(finalRole, profile);

        app.setRole(finalRole);
        wx.showToast({ title: '注册成功', icon: 'success' });
        setTimeout(() => {
          const url = finalRole === 'teacher'
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
