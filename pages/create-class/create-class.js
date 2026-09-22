const app = getApp();

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

Page({
  data: {
    grades: ['高一', '高二', '高三', '初一', '初二', '初三'],
    gradeIndex: 2,
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
    const { grades, gradeIndex, name, teacher, count, motto, inviteCode } = this.data;
    if (!name.trim()) return this.warn('请填写班级名称');
    if (!teacher.trim()) return this.warn('请填写班主任');

    const item = {
      id: Date.now(),
      name: grades[gradeIndex] + '(' + name.trim() + ')班',
      rawName: name.trim(),
      grade: grades[gradeIndex],
      teacher: teacher.trim(),
      count: count || 0,
      motto: motto.trim(),
      inviteCode
    };
    app.addClass(item);
    this.setData({
      myClasses: app.getClasses(),
      name: '',
      count: '',
      motto: '',
      inviteCode: genCode()
    });
    wx.showToast({ title: '班级创建成功', icon: 'success' });
  },

  copyCode(e) {
    const code = e.currentTarget.dataset.code;
    wx.setClipboardData({ data: code });
  },

  warn(msg) {
    wx.showToast({ title: msg, icon: 'none' });
  }
});
