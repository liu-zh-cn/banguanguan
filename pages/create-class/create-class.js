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
    // 当前绑定的班级（以云端为准；本机缓存会残留已删除的班级、也区分不了切换的账号）
    myClass: null
  },

  onLoad() {
    this.setData({ teacher: app.getProfile('teacher').name });
  },

  onShow() {
    this.syncMyClass();
  },

  // 拉取当前账号真实绑定的班级：班级被删 / 换账号后，这里自然就空了
  syncMyClass() {
    app
      .cloudMyClass()
      .then((r) => {
        if (!r || !r.ok || !r.class) {
          this.setData({ myClass: null });
          return;
        }
        this.setData({
          myClass: {
            name: r.class.name || '未命名班级',
            inviteCode: r.class.inviteCode || '',
            teacher: (r.user && r.user.name) || ''
          }
        });
      })
      .catch(() => {});
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
        // 直接用服务端返回的结果展示，不再写本机缓存
        this.setData({
          myClass: {
            name: fullName,
            inviteCode: res.inviteCode || '',
            teacher: teacher.trim()
          },
          name: '',
          count: '',
          motto: ''
        });
        app.globalData.classId = res.classId;
        app.globalData.className = fullName;
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
