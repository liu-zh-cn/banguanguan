const mock = require('../../../utils/mock.js');

Page({
  data: {
    scores: [],
    total: 0,
    avg: 0,
    barData: {},
    examName: '2026 第一次月考'
  },

  onLoad() {
    const scores = mock.studentScores.map((s) => ({
      ...s,
      diff: s.score - s.classAvg,
      barPct: Math.round((s.score / 100) * 100)
    }));
    const total = scores.reduce((sum, s) => sum + s.score, 0);
    const avg = (total / scores.length).toFixed(1);
    this.setData({
      scores,
      total,
      avg,
      barData: {
        labels: scores.map((s) => s.subject),
        values: scores.map((s) => s.score),
        max: 100
      }
    });
  }
});
