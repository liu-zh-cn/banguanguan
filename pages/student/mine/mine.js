const app = getApp();

Page({
  data: {
    profile: {},
    stats: { rank: '—', todo: '—', review: '—' },
    quitPending: null,
    menus: [
      { icon: '➕', label: '加入班级', extra: '输入邀请码', action: 'join' },
      { icon: '🚪', label: '退出班级', extra: '离开当前班', action: 'quit' },
      { icon: '📇', label: '我的资料', extra: '查看 / 编辑', action: 'edit' },
      { icon: '✅', label: '我的作业', action: 'homework' },
      { icon: '🏆', label: '我的成绩', action: 'score' },
      { icon: '📅', label: '课程表', extra: '查看本周', action: 'timetable' },
      { icon: '💬', label: '老师点评', action: 'review' },
      { icon: '⚙️', label: '设置', action: 'setting' }
    ]
  },

  onShow() {
    this.setData({ profile: app.getProfile('student') });
    this.loadStats();
    this.syncProfile();
  },

  // 三个统计项都接真实数据：待交作业 / 班级排名 / 收到点评
  loadStats() {
    app
      .cloudListHomework()
      .then((r) => {
        const todo = (r.list || []).filter((h) => (h.myStatus || '待完成') === '待完成').length;
        this.setData({ 'stats.todo': todo });
      })
      .catch(() => app.showError('作业数据加载失败'));

    app
      .cloudMyScores('')
      .then((r) => {
        if (!r || !r.ok || !r.hasExam) return;
        // rank 为 0 表示还没有已发布的成绩，保持「—」
        if (r.rank) this.setData({ 'stats.rank': '第 ' + r.rank + ' 名' });
      })
      .catch(() => app.showError('成绩加载失败'));

    app
      .cloudListReviews()
      .then((r) => {
        if (r && r.ok) this.setData({ 'stats.review': (r.list || []).length });
      })
      .catch(() => app.showError('点评加载失败'));
  },

  // 本地缓存只用于展示，姓名 / 班级以云端 users 表为准。
  // 每次进页面都同步一次：老师可能在别处把退班申请批了、或被班主任移出班级，
  // 本地缓存不刷新就会一直显示旧班级。
  syncProfile() {
    if (this._syncing) return;
    this._syncing = true;
    app
      .cloudMyClass()
      .then((r) => {
        this._syncing = false;
        if (!r || !r.user) return;
        const p = app.getProfile('student');
        if (r.user.name) p.name = r.user.name;
        // 班级可能被清空（退班通过 / 被移出），这里要能跟着变空
        p.className = r.user.className || '';
        app.saveProfile('student', p);
        this.setData({ profile: p });
        this.setQuitPending(r.pendingQuit || null);
      })
      .catch(() => {
        this._syncing = false;
      });
  },

  goEdit() {
    wx.navigateTo({ url: '/pages/edit-profile/edit-profile?role=student' });
  },

  onMenu(e) {
    const { action } = e.currentTarget.dataset;
    if (action === 'edit') {
      this.goEdit();
      return;
    }
    if (action === 'join') {
      this.joinClass();
      return;
    }
    const tabMap = {
      homework: '/pages/student/homework/homework',
      score: '/pages/student/score/score',
      review: '/pages/student/review/review'
    };
    if (tabMap[action]) {
      wx.reLaunch({ url: tabMap[action] });
      return;
    }
    if (action === 'setting') {
      wx.navigateTo({ url: '/pages/setting/setting' });
      return;
    }
    if (action === 'timetable') {
      wx.navigateTo({ url: '/pages/timetable/timetable' });
      return;
    }
    if (action === 'quit') {
      this.quitClass();
    }
  },

  joinClass() {
    wx.showModal({
      title: '加入班级',
      editable: true,
      placeholderText: '请输入班级邀请码',
      success: (res) => {
        if (!res.confirm || !res.content) return;
        wx.showLoading({ title: '加入中' });
        app.cloudJoinClass(res.content.trim())
          .then((r) => {
            wx.hideLoading();
            if (r.ok) {
              const p = app.getProfile('student');
              p.className = r.className;
              app.saveProfile('student', p);
              app.globalData.classId = r.classId;
              app.globalData.className = r.className;
              this.setData({ profile: p });
              wx.showToast({ title: '加入成功', icon: 'success' });
            } else {
              wx.showToast({ title: r.msg || '加入失败', icon: 'none' });
            }
          })
          .catch(() => {
            wx.hideLoading();
            wx.showToast({ title: '网络/云函数错误', icon: 'none' });
          });
      }
    });
  },

  // 退班需要老师同意：已提交过就显示「审核中」，可以撤销
  quitClass() {
    const p = this.data.profile || {};
    if (!p.className) {
      wx.showToast({ title: '你还不在任何班级中', icon: 'none' });
      return;
    }
    if (this.data.quitPending) {
      wx.showModal({
        title: '退班申请审核中',
        content: '你已申请退出「' + (this.data.quitPending.className || p.className) + '」，老师同意后才会生效。',
        confirmText: '撤销申请',
        success: (res) => {
          if (!res.confirm) return;
          wx.showLoading({ title: '撤销中', mask: true });
          app
            .cloudQuitClass('cancel')
            .then((r) => {
              wx.hideLoading();
              if (!r || !r.ok) {
                wx.showToast({ title: (r && r.msg) || '撤销失败', icon: 'none' });
                return;
              }
              this.setQuitPending(null);
              wx.showToast({ title: '已撤销申请', icon: 'success' });
            })
            .catch(() => {
              wx.hideLoading();
              app.showError('撤销失败，请检查网络');
            });
        }
      });
      return;
    }
    wx.showModal({
      title: '申请退出班级',
      content: '向老师申请退出「' + p.className + '」？需要老师同意，同意后你就看不到本班的作业、成绩和点评了。',
      confirmText: '提交申请',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '提交中', mask: true });
        app
          .cloudQuitClass('leave')
          .then((r) => {
            wx.hideLoading();
            if (!r || !r.ok) {
              wx.showToast({ title: (r && r.msg) || '提交失败', icon: 'none' });
              return;
            }
            this.setQuitPending({
              classId: r.classId || '',
              className: p.className,
              ts: Date.now()
            });
            wx.showToast({ title: '已提交申请', icon: 'success' });
          })
          .catch(() => {
            wx.hideLoading();
            app.showError('提交失败，请检查网络');
          });
      }
    });
  },

  // 申请状态同时反映在菜单右侧的说明上，避免用户以为点了没反应
  setQuitPending(pending) {
    const menus = (this.data.menus || []).map((m) =>
      m.action === 'quit' ? { ...m, extra: pending ? '审核中' : '离开当前班' } : m
    );
    this.setData({ quitPending: pending || null, menus });
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
