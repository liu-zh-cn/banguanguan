const mock = require('../../../utils/mock.js');

Page({
  data: {
    all: mock.students,
    list: mock.students,
    keyword: '',
    filter: 'all'
  },

  onSearch(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    this.applyFilter();
  },

  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.filter });
    this.applyFilter();
  },

  applyFilter() {
    const { all, keyword, filter } = this.data;
    let list = all;
    if (filter === 'cadre') list = list.filter((s) => s.duty !== '组员' && s.duty !== '课代表');
    if (filter === 'warn') list = list.filter((s) => s.score < 60);
    if (keyword) list = list.filter((s) => s.name.indexOf(keyword) > -1);
    this.setData({ list });
  },

  addStudent() {
    wx.showModal({
      title: '添加学生',
      editable: true,
      placeholderText: '请输入学生姓名',
      success: (res) => {
        if (res.confirm && res.content) {
          const all = this.data.all.concat([{
            id: Date.now(),
            name: res.content,
            no: String(this.data.all.length + 1).padStart(2, '0'),
            gender: '—',
            score: 0,
            duty: '组员',
            avatarColor: '#5B7CFF'
          }]);
          this.setData({ all });
          this.applyFilter();
          wx.showToast({ title: '已添加', icon: 'success' });
        }
      }
    });
  },

  onView(e) {
    const name = e.currentTarget.dataset.name;
    wx.showToast({ title: name, icon: 'none' });
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/create-class/create-class' });
  }
});
