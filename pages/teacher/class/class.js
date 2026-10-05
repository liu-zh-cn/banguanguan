const app = getApp();

const PALETTE = ['#5B7CFF', '#24C8A0', '#FFB020', '#7E5BFF', '#FF5A5F', '#00B8D9'];

Page({
  data: {
    all: [],
    list: [],
    keyword: '',
    filter: 'all',
    className: '未设置班级'
  },

  onShow() {
    this._inviteCode = '';
    const p = app.getProfile('teacher');
    this.setData({ className: p.className || '未设置班级' });
    app
      .cloudMyClass()
      .then((r) => {
        if (r.class && r.class.name) this.setData({ className: r.class.name });
        if (r.class && r.class.inviteCode) this._inviteCode = r.class.inviteCode;
        const students = (r.students || []).map((s, i) => ({
          id: s._id,
          openid: s.openid || '',
          name: s.name || '未命名',
          no: s.studentNo || String(i + 1).padStart(2, '0'),
          gender: '—',
          score: null,
          scoreText: '—',
          warn: false,
          duty: '组员',
          avatarColor: PALETTE[i % PALETTE.length]
        }));
        this.setData({ all: students });
        this.applyFilter();
        // 再拉一次统计，给每人标上最近一次考试的均分
        return app.cloudClassStats().catch(() => ({}));
      })
      .then((r) => {
        const map = (r && r.studentLatest) || {};
        const all = this.data.all.map((s) => {
          const v = map[s.openid];
          if (typeof v !== 'number') return s;
          return { ...s, score: v, scoreText: v, warn: v < 60 };
        });
        this.setData({ all });
        this.applyFilter();
      })
      .catch(() => {});
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value });
    this.applyFilter();
  },

  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.filter });
    this.applyFilter();
  },

  applyFilter() {
    const { all, keyword, filter } = this.data;
    let list = all;
    if (filter === 'warn') list = list.filter((s) => s.warn);
    if (filter === 'excellent') list = list.filter((s) => typeof s.score === 'number' && s.score >= 90);
    if (keyword) list = list.filter((s) => s.name.indexOf(keyword) > -1);
    this.setData({ list });
  },

  // 点学生：给 TA 写点评（先选类型，再写内容）
  onTapStudent(e) {
    const { openid, name } = e.currentTarget.dataset;
    if (!openid) return;
    const types = ['表扬', '进步', '建议'];
    wx.showActionSheet({
      itemList: types,
      success: (res) => {
        const type = types[res.tapIndex];
        wx.showModal({
          title: '给 ' + name + ' 写点评（' + type + '）',
          editable: true,
          placeholderText: '写点鼓励或建议…',
          success: (r2) => {
            if (!r2.confirm) return;
            const content = (r2.content || '').trim();
            if (!content) {
              wx.showToast({ title: '点评内容不能为空', icon: 'none' });
              return;
            }
            wx.showLoading({ title: '发送中' });
            app
              .cloudAddReview({ studentOpenid: openid, studentName: name, type, content })
              .then((r3) => {
                wx.hideLoading();
                if (!r3.ok) {
                  wx.showToast({ title: r3.msg || '发送失败', icon: 'none' });
                  return;
                }
                wx.showToast({ title: '已发送', icon: 'success' });
              })
              .catch(() => {
                wx.hideLoading();
                wx.showToast({ title: '网络/云函数错误', icon: 'none' });
              });
          }
        });
      }
    });
  },

  // 邀请学生：展示班级邀请码
  invite() {
    if (!this._inviteCode) {
      wx.showModal({
        title: '还没有班级',
        content: '先创建一个班级，生成邀请码后才能邀请学生',
        confirmText: '去创建',
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/create-class/create-class' });
        }
      });
      return;
    }
    wx.showModal({
      title: '班级邀请码',
      content: this._inviteCode + '\n让学生注册时填这个码，就能加入班级',
      confirmText: '复制',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({ data: this._inviteCode });
        }
      }
    });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/create-class/create-class' });
  }
});
