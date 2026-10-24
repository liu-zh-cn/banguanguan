const app = getApp();

Page({
  data: {
    scores: [],
    total: 0,
    avg: 0,
    rank: 0,
    barData: {},
    exams: [],
    examId: '',
    examName: '',
    fullScore: 100,
    hasExam: false
  },

  onShow() {
    this.load('');
  },

  // 拉取成绩：默认最近一次已发布的考试，也可指定 examId 切换
  load(examId) {
    // 请求序号：快速连点两场考试时，先发的响应后到会覆盖展示，最终显示的不是最后点击的那场
    const seq = (this._seq = (this._seq || 0) + 1);
    app
      .cloudMyScores(examId)
      .then((r) => {
        if (seq !== this._seq) return; // 过期响应，丢弃
        if (!r || !r.ok) return;
        if (!r.hasExam) {
          this.setData({ hasExam: false, exams: [], scores: [], examName: '' });
          return;
        }
        const rows = (r.rows || []).map((s) => ({
          ...s,
          diff: Number((s.score - s.classAvg).toFixed(1)),
          barPct: Math.round((s.score / (r.fullScore || 100)) * 100)
        }));
        this.setData({
          hasExam: true,
          exams: r.exams || [],
          examId: r.examId,
          examName: r.examName + (r.date ? ' · ' + r.date : ''),
          fullScore: r.fullScore || 100,
          scores: rows,
          total: r.total || 0,
          avg: r.avg || 0,
          rank: r.rank || 0,
          barData: {
            labels: rows.map((s) => s.subject),
            values: rows.map((s) => s.score),
            max: r.fullScore || 100
          }
        });
      })
      .catch(() => {});
  },

  pickExam(e) {
    const id = e.currentTarget.dataset.id;
    if (!id || id === this.data.examId) return;
    this.load(id);
  }
});
