const app = getApp();

const SEGMENTS = [
  { key: 'bar', label: '柱状图' },
  { key: 'line', label: '折线图' },
  { key: 'pie', label: '饼图' },
  { key: 'radar', label: '雷达图' }
];

Page({
  data: {
    overview: { studentCount: '—', avgScore: '—', excellentRate: '—', passRate: '—' },
    className: '未设置班级',
    segments: SEGMENTS,
    current: 'bar',
    chartTitle: '',
    chartDesc: '',
    chartData: {},
    hasData: false,
    tip: '暂无成绩数据，请先到「发布成绩」新建考试并录入成绩'
  },

  onShow() {
    const p = app.getProfile('teacher');
    this.setData({ className: p.className || '未设置班级' });
    app
      .cloudMyClass()
      .then((r) => {
        if (r.class && r.class.name) this.setData({ className: r.class.name });
      })
      .catch(() => {});
    this.loadStats();
  },

  // 全部数据来自 classStats 云函数（真实成绩计算）
  loadStats() {
    app
      .cloudClassStats()
      .then((r) => {
        if (!r || !r.ok) return;
        const charts = {
          bar: { title: '各科平均分', desc: '最近一次考试', data: r.subjectAvg || {} },
          line: { title: '考试平均分趋势', desc: '历次考试', data: r.trend || {} },
          pie: { title: '成绩分布', desc: '按学生均分统计', data: r.dist || {} },
          radar: { title: '各科均分雷达', desc: '最近一次考试', data: r.radar || {} }
        };
        this._charts = charts;
        const c = charts[this.data.current];
        this.setData({
          overview: r.overview || this.data.overview,
          hasData: !!r.hasData,
          chartTitle: c.title,
          chartDesc: c.desc,
          chartData: c.data
        });
      })
      .catch(() => {});
  },

  switchChart(e) {
    const key = e.currentTarget.dataset.key;
    if (!this._charts) return;
    const c = this._charts[key];
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
  },

  goBroadcast() {
    wx.navigateTo({ url: '/pages/teacher/broadcast/broadcast' });
  }
});
