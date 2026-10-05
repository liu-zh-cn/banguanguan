const app = getApp();

Page({
  data: {
    profile: {},
    stats: { student: '—', homework: '—', exam: '—' },
    menus: [
      { icon: '🏫', label: '我的班级', extra: '查看学生', action: 'class' },
      { icon: '🎟️', label: '班级邀请码', extra: '分享给学生', action: 'code' },
      { icon: '📝', label: '我的作业', action: 'homework' },
      { icon: '📢', label: '大屏广播', action: 'broadcast' },
      { icon: '📈', label: '发布成绩', action: 'score' },
      { icon: '⚙️', label: '设置', action: 'setting' }
    ]
  },

  onShow() {
    this.setData({ profile: app.getProfile('teacher') });
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
