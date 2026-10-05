const app = getApp();

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

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
    inviteCode: '',
    myClasses: []
  },

  onLoad() {
    this.setData({
      teacher: app.getProfile('teacher').name,
      inviteCode: genCode()
    });
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

  refreshCode() {
    this.setData({ inviteCode: genCode() });
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
        this.setData({
          myClasses: list,
          name: '',
          count: '',
          motto: '',
          inviteCode: res.inviteCode
        });
        wx.showToast({ title: '班级创建成功', icon: 'success' });
      })
      .catch((err) => {
        wx.hideLoading();
        console.error(err);
        this.warn('创建失败，检查云函数/网络');
      });
  },

  copyCode(e) {
    const code = e.currentTarget.dataset.code;
    wx.setClipboardData({ data: code });
  },

  warn(msg) {
    wx.showToast({ title: msg, icon: 'none' });
  }
});
