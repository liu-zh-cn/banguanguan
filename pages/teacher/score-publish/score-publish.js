const mock = require('../../../utils/mock.js');

Page({
  data: {
    exams: mock.exams
  },

  togglePublish(e) {
    const id = e.currentTarget.dataset.id;
    const exams = this.data.exams.map((x) => {
      if (x.id === id) {
        if (!x.published && !x.avg) {
          wx.showToast({ title: '请先录入成绩', icon: 'none' });
        }
        return { ...x, published: x.published ? false : (x.avg ? true : false) };
      }
      return x;
    });
    this.setData({ exams });
  },

  inputScore(e) {
    const name = e.currentTarget.dataset.name;
    wx.showToast({ title: '录入 ' + name, icon: 'none' });
  },

  addExam() {
    wx.showModal({
      title: '新建考试',
      editable: true,
      placeholderText: '请输入考试名称',
      success: (res) => {
        if (res.confirm && res.content) {
          const exams = this.data.exams.concat([{
            id: Date.now(),
            name: res.content,
            date: '—',
            published: false,
            avg: 0
          }]);
          this.setData({ exams });
        }
      }
    });
  }
});
