const mock = require('../../../utils/mock.js');

const CHARTS = {
  bar: { title: '各科目平均分', desc: '本班 vs 年级', data: mock.subjectAvg },
  line: { title: '月考平均分趋势', desc: '近 6 次大考', data: mock.scoreTrend },
  pie: { title: '成绩分布', desc: '按分数段统计', data: mock.scoreDist },
  radar: { title: '综合能力画像', desc: '班级平均能力维度', data: mock.ability }
};

Page({
  data: {
    overview: mock.overview,
    segments: [
      { key: 'bar', label: '柱状图' },
      { key: 'line', label: '折线图' },
      { key: 'pie', label: '饼图' },
      { key: 'radar', label: '雷达图' }
    ],
    current: 'bar',
    chartTitle: CHARTS.bar.title,
    chartDesc: CHARTS.bar.desc,
    chartData: CHARTS.bar.data
  },

  switchChart(e) {
    const key = e.currentTarget.dataset.key;
    const c = CHARTS[key];
    if (!c || key === this.data.current) return;
    this.setData({
      current: key,
      chartTitle: c.title,
      chartDesc: c.desc,
      chartData: c.data
    });
  },

  nav(e) {
    wx.reLaunch({ url: e.currentTarget.dataset.url });
  }
});
