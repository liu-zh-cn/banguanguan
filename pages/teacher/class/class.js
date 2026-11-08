const app = getApp();
const { PALETTE } = require('../../../utils/constants');
const { fmtTime } = require('../../../utils/format');

Page({
  data: {
    all: [],
    list: [],
    keyword: '',
    filter: 'all',
    className: '未设置班级',
    expectedCount: 0,
    // 教师团队：班主任 + 任课老师；只有班主任能审核 / 移除 / 转让
    isOwner: false,
    teachers: [],
    pending: [],
    // 学生提交的退班申请：只有班主任能处理
    pendingQuit: [],
    classes: [],
    // 分数线跟着试卷满分走，拿到 classStats 后再刷新
    passLine: 60,
    excellentLine: 90
  },

  onShow() {
    this._inviteCode = '';
    // 请求序号：快速切页时 bottom-nav 走 reLaunch、onShow 重入，
    // 若旧的 myClass 响应晚于新的 stats 合并落地，会把已显示的分数刷回「—」
    this._seq = (this._seq || 0) + 1;
    const seq = this._seq;
    const p = app.getProfile('teacher');
    this.setData({ className: p.className || '未设置班级' });
    app
      .cloudMyClass()
      .then((r) => {
        if (seq !== this._seq) return; // 过期响应，丢弃
        this.setData({
          className: (r.class && r.class.name) || this.data.className,
          expectedCount: Number(r.class && r.class.expectedCount) || 0,
          isOwner: !!r.isOwner,
          teachers: r.teachers || [],
          pending: (r.pending || []).map((p) => ({ ...p, timeText: fmtTime(p.ts) })),
          pendingQuit: (r.quitRequests || []).map((p) => ({ ...p, timeText: fmtTime(p.ts) })),
          classes: r.classes || []
        });
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
        return app.cloudClassStats().catch(() => {
          app.showError('成绩统计加载失败');
          return {};
        });
      })
      .then((r) => {
        if (seq !== this._seq) return; // 过期响应，丢弃
        const map = (r && r.studentLatest) || {};
        // 分数线跟着试卷满分走：150 分卷的及格线是 90、优秀线是 135，
        // 不能写死 60/90，否则 150 分卷会把 90 分标成优秀、把 90 分标成不及格
        const passLine = Number(r && r.passLine) > 0 ? Number(r.passLine) : 60;
        const excellentLine = Number(r && r.excellentLine) > 0 ? Number(r.excellentLine) : 90;
        this._passLine = passLine;
        this._excellentLine = excellentLine;
        this.setData({ passLine, excellentLine });
        const all = this.data.all.map((s) => {
          const v = map[s.openid];
          if (typeof v !== 'number') return s;
          return { ...s, score: v, scoreText: v, warn: v < passLine };
        });
        this.setData({ all });
        this.applyFilter();
      })
      .catch(() => app.showError('班级数据加载失败'));
  },

  // 班主任长按学生：写点评 / 移出班级
  onStudentLong(e) {
    if (!this.data.isOwner) return;
    const { openid, name } = e.currentTarget.dataset;
    if (!openid) return;
    wx.showActionSheet({
      itemList: ['写点评', '移出班级'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.onTapStudent(e);
          return;
        }
        wx.showModal({
          title: '移出班级',
          content: '把「' + name + '」移出本班？对方之后看不到本班的作业、成绩和点评，可以凭邀请码重新加入。',
          confirmText: '移出',
          confirmColor: '#E23B41',
          success: (r) => {
            if (!r.confirm) return;
            wx.showLoading({ title: '处理中', mask: true });
            app
              .cloudQuitClass('kick', openid)
              .then((x) => {
                wx.hideLoading();
                if (!x || !x.ok) {
                  wx.showToast({ title: (x && x.msg) || '操作失败', icon: 'none' });
                  return;
                }
                wx.showToast({ title: '已移出', icon: 'success' });
                this.onShow();
              })
              .catch(() => {
                wx.hideLoading();
                app.showError('操作失败，请检查网络');
              });
          }
        });
      }
    });
  },

  onSearch(e) {
    this.setData({ keyword: e.detail.value });
    this.applyFilter();
  },

  // 复制整份名单（学号 + 姓名，制表符分隔），粘进 Excel 直接分两列
  copyRoster() {
    const all = this.data.all || [];
    if (!all.length) {
      wx.showToast({ title: '班里还没有学生', icon: 'none' });
      return;
    }
    const lines = all.map((s) => (s.no || '') + '\t' + (s.name || ''));
    wx.setClipboardData({ data: lines.join('\n') });
  },

  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.filter });
    this.applyFilter();
  },

  applyFilter() {
    const { all, keyword, filter } = this.data;
    const excellentLine = this._excellentLine || 90;
    let list = all;
    if (filter === 'warn') list = list.filter((s) => s.warn);
    if (filter === 'excellent') {
      list = list.filter((s) => typeof s.score === 'number' && s.score >= excellentLine);
    }
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
  },

  // ---------- 教师团队管理（仅班主任） ----------
  // 点教师：弹出「转让班主任 / 移出班级」
  onTapTeacher(e) {
    if (!this.data.isOwner) return;
    const { openid, name, owner, me } = e.currentTarget.dataset;
    if (me || owner) return;
    if (!openid) return;
    wx.showActionSheet({
      itemList: ['转让班主任', '移出班级'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.showModal({
            title: '转让班主任',
            content: '将「' + name + '」设为班主任？你会降为普通老师，之后不能再审核或移除教师。',
            confirmText: '确认转让',
            success: (r) => {
              if (r.confirm) this.doManage('transfer', openid);
            }
          });
          return;
        }
        wx.showModal({
          title: '移出班级',
          content: '将「' + name + '」移出本班？对方会立即看不到本班的学生、成绩和作业。',
          confirmText: '移出',
          confirmColor: '#E23B41',
          success: (r) => {
            if (r.confirm) this.doManage('remove', openid);
          }
        });
      }
    });
  },

  approveTeacher(e) {
    const { openid, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '同意加入',
      content: '同意「' + name + '」加入本班？同意后对方可以看本班学生、录成绩、布置作业。',
      success: (r) => {
        if (r.confirm) this.doManage('approve', openid);
      }
    });
  },

  rejectTeacher(e) {
    const { openid, name } = e.currentTarget.dataset;
    wx.showModal({
      title: '拒绝申请',
      content: '拒绝「' + name + '」的加入申请？对方可以重新申请。',
      confirmColor: '#E23B41',
      success: (r) => {
        if (r.confirm) this.doManage('reject', openid);
      }
    });
  },

  // ---------- 学生退班申请（学生提交，班主任审批） ----------
  approveQuit(e) {
    const { openid, name } = e.currentTarget.dataset;
    if (!openid) return;
    wx.showModal({
      title: '同意退班',
      content: '同意「' + name + '」退出本班？同意后他立刻看不到本班的学生、作业和成绩。',
      success: (r) => {
        if (r.confirm) this.doQuitManage('approveQuit', openid);
      }
    });
  },

  rejectQuit(e) {
    const { openid, name } = e.currentTarget.dataset;
    if (!openid) return;
    wx.showModal({
      title: '拒绝退班',
      content: '拒绝「' + name + '」的退班申请？对方会继续留在本班。',
      confirmColor: '#E23B41',
      success: (r) => {
        if (r.confirm) this.doQuitManage('rejectQuit', openid);
      }
    });
  },

  doQuitManage(action, openid) {
    if (this._managing) return;
    this._managing = true;
    wx.showLoading({ title: '处理中', mask: true });
    app
      .cloudQuitClass(action, openid)
      .then((r) => {
        wx.hideLoading();
        this._managing = false;
        if (!r || !r.ok) {
          wx.showToast({ title: (r && r.msg) || '操作失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: r.msg || '已处理', icon: 'success' });
        this.onShow();
      })
      .catch(() => {
        wx.hideLoading();
        this._managing = false;
        wx.showToast({ title: '网络/云函数错误', icon: 'none' });
      });
  },

  doManage(action, openid) {
    if (this._managing) return;
    this._managing = true;
    wx.showLoading({ title: '处理中', mask: true });
    app
      .cloudManageTeachers(action, openid)
      .then((r) => {
        wx.hideLoading();
        this._managing = false;
        if (!r.ok) {
          wx.showToast({ title: r.msg || '操作失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: r.msg || '已处理', icon: 'success' });
        this.onShow();
      })
      .catch(() => {
        wx.hideLoading();
        this._managing = false;
        wx.showToast({ title: '网络/云函数错误', icon: 'none' });
      });
  },

  // 多班老师切换当前班级：只改服务端 classId，各页面重新加载就跟着换班
  switchClass() {
    const list = (this.data.classes || []).filter((x) => !x.active);
    if (!list.length) {
      wx.showToast({ title: '还没有其他班级', icon: 'none' });
      return;
    }
    wx.showActionSheet({
      itemList: list.map((x) => x.name + (x.isOwner ? '（班主任）' : '')),
      success: (res) => {
        const target = list[res.tapIndex];
        if (!target) return;
        wx.showLoading({ title: '切换中', mask: true });
        app
          .cloudSwitchClass(target.id)
          .then((r) => {
            wx.hideLoading();
            if (!r.ok) {
              wx.showToast({ title: r.msg || '切换失败', icon: 'none' });
              return;
            }
            app.syncTeacherClass(r.classId, r.className);
            wx.reLaunch({ url: '/pages/teacher/class/class' });
          })
          .catch(() => {
            wx.hideLoading();
            wx.showToast({ title: '切换失败', icon: 'none' });
          });
      }
    });
  }
});
