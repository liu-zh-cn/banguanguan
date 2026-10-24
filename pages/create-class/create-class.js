const app = getApp();

Page({
  data: {
    grades: [
      '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
      '初一', '初二', '初三',
      '高一', '高二', '高三'
    ],
    gradeIndex: 9,
    name: '',
    teacher: '',
    count: '',
    motto: '',
    myClasses: []
  },

  onLoad() {
    this.setData({ teacher: app.getProfile('teacher').name });
  },

  onShow() {
    this.setData({ myClasses: app.getClasses() });
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },

  onGrade(e) {
    this.setData({ gradeIndex: Number(e.detail.value) });
  },

  submit() {
    this.doSubmit(false);
  },

  doSubmit(force) {
    // 防重复提交：云函数创建班级不幂等，连点会建出一串孤儿班级
    if (this._submitting) return;
    const { grades, gradeIndex, name, teacher, count, motto } = this.data;
    if (!name.trim()) return this.warn('请填写班级名称');
    if (!teacher.trim()) return this.warn('请填写班主任');

    const fullName = grades[gradeIndex] + '(' + name.trim() + ')班';
    this._submitting = true;
    wx.showLoading({ title: '创建中...', mask: true });
    app.cloudCreateClass({
      name: fullName,
      grade: grades[gradeIndex],
      motto: motto.trim(),
      studentCount: count,
      force: !!force
    })
      .then((res) => {
        wx.hideLoading();
        this._submitting = false;
        // 已有班级：云函数拒绝并说明后果，老师明确确认后才真正重建
        if (res.needForce) {
          wx.showModal({
            title: '你已有班级',
            content: res.msg,
            confirmText: '仍要新建',
            cancelText: '取消',
            success: (r) => {
              if (r.confirm) this.doSubmit(true);
            }
          });
          return;
        }
        if (!res.ok) return this.warn(res.msg || '创建失败');
        // 本地留一份用于列表展示（真实数据在云端 classes 集合）
        const list = app.getClasses().concat([{
          id: Date.now(),
          name: fullName,
          grade: grades[gradeIndex],
          teacher: teacher.trim(),
          count: count || 0,
          motto: motto.trim(),
          inviteCode: res.inviteCode
        }]);
        wx.setStorageSync('myClasses', list);
        app.globalData.classId = res.classId;
        app.globalData.className = fullName;
        this.setData({ myClasses: list, name: '', count: '', motto: '' });
        // 邀请码由服务端生成，创建成功后才存在，这里直接告诉老师真实的那个
        this.showInviteCode(fullName, res.inviteCode);
      })
      .catch((err) => {
        wx.hideLoading();
        this._submitting = false;
        console.error(err);
        this.warn('创建失败，检查云函数/网络');
      });
  },

  // 创建成功后弹出真正的邀请码，可直接复制
  showInviteCode(className, code) {
    if (!code) {
      wx.showToast({ title: '班级创建成功', icon: 'success' });
      return;
    }
    wx.showModal({
      title: className + ' 创建成功',
      content: '班级邀请码：' + code + '\n让学生注册或「加入班级」时填写',
      confirmText: '复制邀请码',
      cancelText: '知道了',
      success: (res) => {
        if (res.confirm) wx.setClipboardData({ data: code });
      }
    });
  },

  copyCode(e) {
    const code = e.currentTarget.dataset.code;
    if (!code) return;
    wx.setClipboardData({ data: code });
  },

  warn(msg) {
    wx.showToast({ title: msg, icon: 'none' });
  }
});
