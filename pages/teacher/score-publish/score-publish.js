const app = getApp();

Page({
  data: {
    exams: []
  },

  onShow() {
    this.load();
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
          avg: x.avg || 0
        }));
        this.setData({ exams });
      })
      .catch(() => {
        wx.showToast({ title: '网络/云函数错误', icon: 'none' });
      });
  },

  togglePublish(e) {
    const id = e.currentTarget.dataset.id;
    const exam = this.data.exams.find((x) => x.id === id);
    if (!exam) return;
    if (!exam.published && !exam.avg) {
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

  // 新建考试：先写名称，再写科目（可留空，默认六科）
  addExam() {
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
              .cloudCreateExam({ name, subjects })
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
