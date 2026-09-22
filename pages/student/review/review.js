const mock = require('../../../utils/mock.js');

const TYPE_MAP = {
  '进步': { cls: 'tag-blue', color: '#5B7CFF' },
  '表扬': { cls: 'tag-green', color: '#24C8A0' },
  '建议': { cls: 'tag-orange', color: '#FFB020' }
};

Page({
  data: {
    list: []
  },
  onLoad() {
    const list = mock.reviews.map((r) => {
      const t = TYPE_MAP[r.type] || TYPE_MAP['建议'];
      return { ...r, tagCls: t.cls, avatarColor: t.color };
    });
    this.setData({ list });
  },
  reply(e) {
    wx.showToast({ title: '感谢老师！', icon: 'none' });
  }
});
