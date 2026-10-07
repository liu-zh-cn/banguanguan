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
    const { grades, gradeIndex, name, teacher, count, motto } = this.data;
    if (!name.trim()) return this.warn('请填写班级名称');
    if (!teacher.trim()) return this.warn('请填写班主任');

    const fullName = grades[gradeIndex] + '(' + name.trim() + ')班';
    wx.showLoading({ title: '创建中...' });
    app.cloudCreateClass({
      name: fullName,
      grade: grades[gradeIndex],
      motto: motto.trim(),
      studentCount: count
    })
      .then((res) => {
        wx.hideLoading();
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
