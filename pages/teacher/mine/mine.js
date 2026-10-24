const app = getApp();

Page({
  data: {
    profile: {},
    stats: { student: '—', homework: '—', exam: '—' },
    menus: [
      { icon: '🏫', label: '我的班级', extra: '查看学生', action: 'class' },
      { icon: '🎟️', label: '班级邀请码', extra: '发给学生', action: 'code' },
      { icon: '📝', label: '我的作业', action: 'homework' },
      { icon: '💬', label: '我的点评', extra: '看学生回复', action: 'reviews' },
      { icon: '📢', label: '大屏广播', action: 'broadcast' },
      { icon: '📈', label: '发布成绩', action: 'score' },
      { icon: '⚙️', label: '设置', action: 'setting' }
    ]
  },

  onShow() {
    this.setData({ profile: app.getProfile('teacher') });
    this.loadStats();
    this.syncProfile();
  },

  loadStats() {
    app
      .cloudMyClass()
      .then((r) => {
        const student = r.students ? r.students.length : (r.class && r.class.studentCount) || 0;
        this.setData({ 'stats.student': student });
      })
      .catch(() => {});
    app
      .cloudListHomework()
      .then((r) => {
        this.setData({ 'stats.homework': (r.list || []).length });
      })
      .catch(() => {});
    // 未发布成绩的考试数：之前这个格子永远是「—」
    app
      .cloudListExams()
      .then((r) => {
        if (!r || !r.ok) return;
        const pending = (r.list || []).filter((e) => !e.published).length;
        this.setData({ 'stats.exam': pending });
      })
      .catch(() => {});
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

  switchRole() {
    wx.showModal({
      title: '切换身份',
      content: '确定要退出并切换身份吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('role');
          wx.removeStorageSync('openid');
          app.globalData.openid = '';
          app.globalData.userInfo = null;
          wx.reLaunch({ url: '/pages/index/index' });
        }
      }
    });
  }
});
