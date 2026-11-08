const app = getApp();
const { FULL_SCORES } = require('../../../utils/constants');
const { applyTheme } = require('../../../utils/theme');

Page({
  data: {
    exams: [],
    truncated: false,
    // 删除考试是班主任专属，普通老师不显示删除入口（服务端还会再拦）
    isOwner: false,
    // 试卷满分：录入 / 图表 / 进度条都按它换算，避免把 150 分卷当成 100 分
    fullScores: FULL_SCORES,
    fullScoreIndex: 2
  },

  onShow() {
    applyTheme(this);
    this.load();
  },

  pickFullScore(e) {
    this.setData({ fullScoreIndex: Number(e.currentTarget.dataset.index) });
  },

  load() {
    app
      .cloudListExams()
      .then((r) => {
        const exams = ((r && r.list) || []).map((x) => ({
          id: x._id,
          name: x.name,
          date: x.date || '—',
          published: !!x.published,
          avg: x.avg || 0,
          fullScore: x.fullScore || 100,
          // 有没有录成绩看分数条数，不能看平均分（0 分的考试会被误判成没录）
          count: x.scoreCount || 0
        }));
        this.setData({ exams, truncated: !!(r && r.truncated), isOwner: !!(r && r.isOwner) });
        // 满分选择器默认跟随最近一次考试，避免：上次建的是 100 分卷，这次进来静默变回 150
        const last = exams[0];
        if (last) {
          const idx = this.data.fullScores.indexOf(Number(last.fullScore));
          if (idx > -1 && idx !== this.data.fullScoreIndex) {
            this.setData({ fullScoreIndex: idx });
          }
        }
      })
      .catch(() => {
        wx.showToast({ title: '网络/云函数错误', icon: 'none' });
      });
  },

  togglePublish(e) {
    const id = e.currentTarget.dataset.id;
    const exam = this.data.exams.find((x) => x.id === id);
    if (!exam) return;
    if (!exam.published && !exam.count) {
      wx.showToast({ title: '请先录入成绩', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '处理中' });
    app
      .cloudSetExamPublished(id, !exam.published)
      .then((r) => {
        wx.hideLoading();
        if (!r.ok) {
          wx.showToast({ title: r.msg || '操作失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: r.published ? '已发布' : '已撤回', icon: 'success' });
        this.load();
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '网络/云函数错误', icon: 'none' });
      });
  },

  inputScore(e) {
    const { id, name } = e.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({
      url: '/pages/teacher/score-input/score-input?examId=' + id + '&name=' + encodeURIComponent(name || ''),
      fail: (err) => {
        wx.showModal({
          title: '跳转失败',
          content: (err && err.errMsg) || String(err),
          showCancel: false
        });
      }
    });
  },

  // 删除空考试：有成绩或已发布时云函数会拒绝，避免学生成绩凭空消失
  removeExam(e) {
    const id = e.currentTarget.dataset.id;
    const exam = this.data.exams.find((x) => x.id === id);
    if (!exam) return;
    wx.showModal({
      title: '删除考试',
      content: '确定删除「' + exam.name + '」？\n只有还没有成绩的考试可以删除，删除后无法恢复。',
      confirmText: '删除',
      confirmColor: '#E23B41',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中' });
        app
          .cloudDeleteExam(id)
          .then((r) => {
            wx.hideLoading();
            if (!r.ok) {
              wx.showToast({ title: r.msg || '删除失败', icon: 'none' });
              return;
            }
            wx.showToast({ title: '已删除', icon: 'success' });
            this.load();
          })
          .catch(() => {
            wx.hideLoading();
            wx.showToast({ title: '网络/云函数错误', icon: 'none' });
          });
      }
    });
  },

  // 新建考试：先写名称，再写科目（可留空，默认六科）；满分取上方选择器
  addExam() {
    const { fullScores, fullScoreIndex } = this.data;
    const fullScore = fullScores[fullScoreIndex];
    wx.showModal({
      title: '新建考试',
      editable: true,
      placeholderText: '请输入考试名称',
      success: (res) => {
        if (!res.confirm || !res.content || !res.content.trim()) return;
        const name = res.content.trim();
        wx.showModal({
          title: '考试科目',
          editable: true,
          placeholderText: '自定义科目，用逗号或顿号分隔；留空即用默认六科',
          success: (r2) => {
            if (!r2.confirm) return;
            const subjects = String(r2.content || '')
              .split(/[,，、\s]+/)
              .filter(Boolean);
            wx.showLoading({ title: '创建中' });
            app
              .cloudCreateExam({ name, subjects, fullScore })
              .then((r3) => {
                wx.hideLoading();
                if (!r3.ok) {
                  wx.showToast({ title: r3.msg || '创建失败', icon: 'none' });
                  return;
                }
                wx.showToast({ title: '已创建', icon: 'success' });
                this.load();
              })
              .catch(() => {
                wx.hideLoading();
                wx.showToast({ title: '网络/云函数错误', icon: 'none' });
              });
          }
        });
      }
    });
  }
});
