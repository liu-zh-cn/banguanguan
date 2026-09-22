const mock = require('../../../utils/mock.js');

function withPct(list) {
  return list.map((h) => ({ ...h, pct: Math.round(h.progress * 100) }));
}

Page({
  data: {
    all: withPct(mock.studentHomework),
    list: withPct(mock.studentHomework),
    tab: 'all',
    tabs: [
      { key: 'all', label: '全部' },
      { key: '待完成', label: '待完成' },
      { key: '已完成', label: '已完成' },
      { key: '已逾期', label: '已逾期' }
    ]
  },

  setTab(e) {
    const key = e.currentTarget.dataset.key;
    const all = this.data.all;
    const list = key === 'all' ? all : all.filter((h) => h.status === key);
    this.setData({ tab: key, list });
  },

  onSubmit(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({ title: '已提交作业', icon: 'success' });
  }
});
