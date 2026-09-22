const mock = require('../../../utils/mock.js');

Page({
  data: {
    subjects: ['语文', '数学', '英语', '物理', '化学', '生物'],
    subjectIndex: 0,
    title: '',
    content: '',
    deadline: '',
    list: mock.homeworkList
  },

  onSubject(e) { this.setData({ subjectIndex: Number(e.detail.value) }); },
  onTitle(e) { this.setData({ title: e.detail.value }); },
  onContent(e) { this.setData({ content: e.detail.value }); },
  onDate(e) { this.setData({ deadline: e.detail.value }); },

  submit() {
    const { subjects, subjectIndex, title, deadline, list } = this.data;
    if (!title.trim()) {
      wx.showToast({ title: '请填写作业标题', icon: 'none' });
      return;
    }
    const item = {
      id: Date.now(),
      subject: subjects[subjectIndex],
      title: title.trim(),
      deadline: deadline || '未设置',
      done: 0,
      total: 46,
      status: '进行中'
    };
    this.setData({
      list: [item].concat(list),
      title: '',
      content: '',
      deadline: ''
    });
    wx.showToast({ title: '布置成功', icon: 'success' });
  },

  remove(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确定撤回该作业？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ list: this.data.list.filter((h) => h.id !== id) });
        }
      }
    });
  }
});
