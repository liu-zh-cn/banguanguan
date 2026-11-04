const app = getApp();
const { markDirty, clearDirty } = require('../../utils/guard');

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
    myClass: null,
    // 我加入/创建的全部班级（多班老师可在这里切换当前班级）
    classes: [],
    // 我已提交、还在等班主任审核的申请
    pendingApply: null,
    applyCode: ''
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
        if (!r || !r.ok) {
          this.setData({ myClass: null, classes: [], pendingApply: null });
          return;
        }
        const owner = (r.teachers || []).find((t) => t.isOwner);
        this.setData({
          myClass: r.class
            ? {
                name: r.class.name || '未命名班级',
                inviteCode: r.class.inviteCode || '',
                teacher: (r.user && r.user.name) || '',
                ownerName: (owner && owner.name) || ((r.user && r.user.name) || ''),
                isOwner: !!r.isOwner,
                expectedCount: Number(r.class.expectedCount) || 0
              }
            : null,
          classes: r.classes || [],
          pendingApply: r.pendingApply || null
        });
      })
      .catch(() => app.showError('班级信息加载失败'));
  },

  onInput(e) {
    markDirty(this, '班级还没创建，确定离开吗？');
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },

  onGrade(e) {
    markDirty(this, '班级还没创建，确定离开吗？');
    this.setData({ gradeIndex: Number(e.detail.value) });
  },

  submit() {
    this.doSubmit();
  },

  doSubmit() {
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
      studentCount: count
    })
      .then((res) => {
        wx.hideLoading();
        this._submitting = false;
        if (!res.ok) return this.warn(res.msg || '创建失败');
        clearDirty(this);
        // 直接用服务端返回的结果展示，不再写本机缓存
        this.setData({
          myClass: {
            name: fullName,
            inviteCode: res.inviteCode || '',
            teacher: teacher.trim(),
            ownerName: teacher.trim(),
            isOwner: true,
            expectedCount: Math.max(0, Math.floor(Number(count) || 0))
          },
          name: '',
          count: '',
          motto: ''
        });
        app.syncTeacherClass(res.classId, fullName);
        // 邀请码由服务端生成，创建成功后才存在，这里直接告诉老师真实的那个
        this.showInviteCode(fullName, res.inviteCode);
        // 刷新「我的班级」列表，新班会自动成为当前班级
        this.syncMyClass();
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

  // 切换当前班级：只改服务端 users.classId，其它老师端接口自动跟着换班
  switchTo(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const cur = (this.data.classes || []).find((x) => x.active);
    if (cur && cur.id === id) return;
    if (this._switching) return;
    this._switching = true;
    wx.showLoading({ title: '切换中', mask: true });
    app
      .cloudSwitchClass(id)
      .then((r) => {
        wx.hideLoading();
        this._switching = false;
        if (!r.ok) return this.warn(r.msg || '切换失败');
        app.syncTeacherClass(r.classId, r.className);
        wx.showToast({ title: '已切换到 ' + (r.className || '新班级'), icon: 'none' });
        this.syncMyClass();
      })
      .catch(() => {
        wx.hideLoading();
        this._switching = false;
        this.warn('切换失败，检查云函数/网络');
      });
  },

  onApplyInput(e) {
    this.setData({ applyCode: e.detail.value });
  },

  // 老师申请加入别人的班级：只提交申请，班主任同意前读不到该班任何数据
  applyJoin() {
    const code = String(this.data.applyCode || '').trim();
    if (!code) return this.warn('请输入邀请码');
    if (this._applying) return;
    this._applying = true;
    wx.showLoading({ title: '提交中', mask: true });
    app
      .cloudApplyJoinClass(code)
      .then((r) => {
        wx.hideLoading();
        this._applying = false;
        if (!r.ok) return this.warn(r.msg || '申请失败');
        this.setData({ applyCode: '' });
        wx.showModal({
          title: '申请已提交',
          content: '已通知「' + (r.className || '该班级') + '」的班主任，同意后你就能看到班级数据。',
          showCancel: false
        });
        this.syncMyClass();
      })
      .catch(() => {
        wx.hideLoading();
        this._applying = false;
        this.warn('网络/云函数错误');
      });
  },

  warn(msg) {
    wx.showToast({ title: msg, icon: 'none' });
  }
});
