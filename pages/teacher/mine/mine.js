const app = getApp();
const { applyTheme } = require('../../../utils/theme');

Page({
  data: {
    profile: {},
    stats: { student: '—', homework: '—', exam: '—' },
    menus: [
      { icon: '🏫', label: '我的班级', extra: '查看学生', action: 'class' },
      { icon: '🎟️', label: '班级邀请码', extra: '发给学生', action: 'code' },
      { icon: '📅', label: '课程表', extra: '编辑本周', action: 'timetable' },
      { icon: '📝', label: '我的作业', action: 'homework' },
      { icon: '💬', label: '我的点评', extra: '看学生回复', action: 'reviews' },
      { icon: '📢', label: '大屏广播', action: 'broadcast' },
      { icon: '📈', label: '发布成绩', action: 'score' },
      { icon: '🚪', label: '退出班级', action: 'quit' },
      { icon: '🗑️', label: '解散班级', extra: '仅限空班', action: 'dissolve' },
      { icon: '⚙️', label: '设置', action: 'setting' }
    ]
  },

  onShow() {
    applyTheme(this);
    this.setData({ profile: app.getProfile('teacher') });
    this.loadStats();
    this.syncProfile();
  },

  loadStats() {
    app
      .cloudMyClass()
      .then((r) => {
        // 只认 users 表返回的名单，不再读 classes.studentCount 副本
        this.setData({ 'stats.student': (r.students || []).length });
      })
      .catch(() => app.showError('班级信息加载失败'));
    app
      .cloudListHomework()
      .then((r) => {
        this.setData({ 'stats.homework': (r.list || []).length });
      })
      .catch(() => app.showError('作业数据加载失败'));
    // 未发布成绩的考试数：之前这个格子永远是「—」
    app
      .cloudListExams()
      .then((r) => {
        if (!r || !r.ok) return;
        const pending = (r.list || []).filter((e) => !e.published).length;
        this.setData({ 'stats.exam': pending });
      })
      .catch(() => app.showError('考试数据加载失败'));
  },

  // 本地缓存只用于展示，姓名 / 班级以云端 users 表为准（每个页面生命周期同步一次）
  syncProfile() {
    if (this._synced) return;
    this._synced = true;
    app
      .cloudMyClass()
      .then((r) => {
        if (!r || !r.user) return;
        const p = app.getProfile('teacher');
        if (r.user.name) p.name = r.user.name;
        if (r.user.className) p.className = r.user.className;
        app.saveProfile('teacher', p);
        this.setData({ profile: p });
      })
      .catch(() => {
        this._synced = false; // 同步失败，下次进来再试
      });
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/edit-profile/edit-profile?role=teacher' });
  },

  onMenu(e) {
    const { action } = e.currentTarget.dataset;
    if (action === 'code') {
      this.showInviteCode();
      return;
    }
    const tabMap = {
      class: '/pages/teacher/class/class',
      homework: '/pages/teacher/homework-assign/homework-assign',
      score: '/pages/teacher/score-publish/score-publish'
    };
    if (tabMap[action]) {
      wx.reLaunch({ url: tabMap[action] });
      return;
    }
    if (action === 'broadcast') {
      wx.navigateTo({ url: '/pages/teacher/broadcast/broadcast' });
      return;
    }
    if (action === 'reviews') {
      wx.navigateTo({ url: '/pages/teacher/reviews/reviews' });
      return;
    }
    if (action === 'timetable') {
      wx.navigateTo({ url: '/pages/timetable/timetable' });
      return;
    }
    if (action === 'quit') {
      this.quitClass();
      return;
    }
    if (action === 'dissolve') {
      this.dissolveClass();
      return;
    }
    if (action === 'setting') {
      wx.navigateTo({ url: '/pages/setting/setting' });
    }
  },

  showInviteCode() {
    wx.showLoading({ title: '查询中' });
    app.cloudMyClass()
      .then((r) => {
        wx.hideLoading();
        if (r.class && r.class.inviteCode) {
          wx.showModal({
            title: r.class.name,
            content: '邀请码：' + r.class.inviteCode + '\n学生注册或“加入班级”时填写即可加入',
            confirmText: '复制',
            success: (res) => {
              if (res.confirm) wx.setClipboardData({ data: r.class.inviteCode });
            }
          });
        } else {
          wx.showToast({ title: '你还没有班级', icon: 'none' });
        }
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '查询失败', icon: 'none' });
      });
  },

  // 退出当前班级：班主任要先转让或解散
  quitClass() {
    const p = this.data.profile || {};
    if (!p.className) {
      wx.showToast({ title: '你还没有加入班级', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '退出班级',
      content: '确定退出「' + p.className + '」吗？之后看不到本班的学生、作业和成绩。班主任需要先转让班主任或解散班级。',
      confirmText: '退出',
      confirmColor: '#E23B41',
      success: (res) => {
        if (res.confirm) this.doQuit('leave');
      }
    });
  },

  // 解散班级：只允许空班，避免在这里做级联删除
  dissolveClass() {
    const p = this.data.profile || {};
    if (!p.className) {
      wx.showToast({ title: '你还没有班级', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '解散班级',
      content: '解散「' + p.className + '」不可恢复。\n只能解散空班：需要先移除所有学生和老师、删掉全部考试和作业。',
      confirmText: '解散',
      confirmColor: '#E23B41',
      success: (res) => {
        if (res.confirm) this.doQuit('dissolve');
      }
    });
  },

  doQuit(action) {
    if (this._quitting) return;
    this._quitting = true;
    wx.showLoading({ title: '处理中', mask: true });
    app
      .cloudQuitClass(action)
      .then((r) => {
        wx.hideLoading();
        this._quitting = false;
        if (!r || !r.ok) {
          wx.showToast({ title: (r && r.msg) || '操作失败', icon: 'none' });
          return;
        }
        const next = app.getProfile('teacher');
        next.className = r.className || '';
        app.saveProfile('teacher', next);
        app.globalData.classId = r.classId || '';
        app.globalData.className = r.className || '';
        this.setData({
          profile: next,
          stats: { student: '—', homework: '—', exam: '—' }
        });
        wx.showToast({ title: r.msg || '已处理', icon: 'success' });
      })
      .catch(() => {
        wx.hideLoading();
        this._quitting = false;
        app.showError('操作失败，请检查网络');
      });
  },

  switchRole() {
    wx.showModal({
      title: '切换身份',
      content: '确定要退出并切换身份吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('role');
          wx.removeStorageSync('openid');
          // 本机遗留的班级缓存是设备级的，不清会串到下一个登录的账号
          wx.removeStorageSync('myClasses');
          app.globalData.openid = '';
          app.globalData.userInfo = null;
          wx.reLaunch({ url: '/pages/index/index' });
        }
      }
    });
  }
});
