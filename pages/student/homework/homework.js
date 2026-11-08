const app = getApp();
const { applyTheme } = require('../../../utils/theme');

Page({
  data: {
    all: [],
    list: [],
    truncated: false,
    dueTip: null,
    // 提交面板
    submitOpen: false,
    submitId: '',
    submitTitle: '',
    submitText: '',
    submitImages: [],
    submitting: false,
    tab: 'all',
    className: '未设置班级',
    name: '',
    tabs: [
      { key: 'all', label: '全部' },
      { key: '待完成', label: '待完成' },
      { key: '已提交', label: '已提交' }
    ]
  },

  onShow() {
    applyTheme(this);
    const p = app.getProfile('student');
    this.setData({
      className: p.className || '未设置班级',
      name: p.name || ''
    });
    this.load();
  },

  load() {
    app
      .cloudListHomework()
      .then((r) => {
        const list = (r.list || []).map((h) => ({
          id: h._id,
          subject: h.subject,
          title: h.title,
          deadline: h.deadline || '未设置',
          status: h.myStatus || '待完成',
          late: !!h.myLate,
          expired: !!h.expired
        }));
        this.setData({ all: list, truncated: !!r.truncated, dueTip: this.buildDueTip(list) });
        this.applyTab();
      })
      .catch(() => app.showError('作业加载失败'));

    app
      .cloudMyClass()
      .then((rr) => {
        if (rr.class && rr.class.name) this.setData({ className: rr.class.name });
        if (rr.user && rr.user.name) this.setData({ name: rr.user.name });
      })
      .catch(() => app.showError('班级信息加载失败'));
  },

  setTab(e) {
    this.setData({ tab: e.currentTarget.dataset.key });
    this.applyTab();
  },

  // 今天的截止提醒：只数「今天/明天截止且还没交」的，超过两天的不打扰
  buildDueTip(list) {
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const now = new Date();
    const today = fmt(now);
    const tomorrow = fmt(new Date(now.getTime() + 24 * 3600 * 1000));

    let dueToday = 0;
    let dueTomorrow = 0;
    list.forEach((h) => {
      if (h.status === '已提交' || !h.deadline) return;
      if (h.deadline === today) dueToday++;
      else if (h.deadline === tomorrow) dueTomorrow++;
    });

    if (dueToday > 0) return { text: '今天有 ' + dueToday + ' 份作业截止', urgent: true };
    if (dueTomorrow > 0) return { text: '明天有 ' + dueTomorrow + ' 份作业截止', urgent: false };
    return null;
  },

  applyTab() {
    const { all, tab } = this.data;
    this.setData({
      list: tab === 'all' ? all : all.filter((h) => h.status === tab)
    });
  },

  openSubmit(e) {
    const { id, title } = e.currentTarget.dataset;
    if (!id) return;
    this.setData({
      submitOpen: true,
      submitId: id,
      submitTitle: title || '',
      submitText: '',
      submitImages: []
    });
  },

  closeSubmit() {
    if (this.data.submitting) return;
    this.setData({ submitOpen: false });
  },

  onSubmitText(e) {
    this.setData({ submitText: e.detail.value });
  },

  // 最多 3 张：拍作业、拍试卷都够用，再多上传会很慢
  pickImage() {
    const left = 3 - this.data.submitImages.length;
    if (left <= 0) return;
    wx.chooseMedia({
      count: left,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: (res) => {
        const paths = (res.tempFiles || []).map((f) => f.tempFilePath);
        this.setData({ submitImages: this.data.submitImages.concat(paths).slice(0, 3) });
      }
    });
  },

  removeImage(e) {
    const i = Number(e.currentTarget.dataset.index);
    const list = this.data.submitImages.slice();
    list.splice(i, 1);
    this.setData({ submitImages: list });
  },

  previewImage(e) {
    const src = e.currentTarget.dataset.src;
    if (src) wx.previewImage({ current: src, urls: this.data.submitImages });
  },

  // 先传图拿到 fileID，再提交；任何一张失败就整单中止，避免"提交成功但图没了"
  doSubmit() {
    if (this.data.submitting) return;
    const content = this.data.submitText || '';
    if (content.length > 2000) {
      wx.showToast({ title: '内容不能超过 2000 字', icon: 'none' });
      return;
    }
    const images = this.data.submitImages.slice();
    const homeworkId = this.data.submitId;

    this.setData({ submitting: true });
    wx.showLoading({ title: images.length ? '上传图片中' : '提交中', mask: true });

    const uploadOne = (path, i) => {
      const ext = (path.match(/\.[a-zA-Z0-9]+$/) || ['.jpg'])[0];
      const cloudPath = 'homework/' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 8) + ext;
      return wx.cloud.uploadFile({ cloudPath, filePath: path }).then((r) => r.fileID);
    };

    Promise.all(images.map((p, i) => uploadOne(p, i)))
      .then((fileIDs) => app.cloudSubmitHomework(homeworkId, content, fileIDs))
      .then((r) => {
        wx.hideLoading();
        this.setData({ submitting: false });
        if (!r || !r.ok) {
          wx.showToast({ title: (r && r.msg) || '提交失败', icon: 'none' });
          return;
        }
        this.setData({ submitOpen: false });
        wx.showToast({ title: r.late ? '已提交（迟交）' : '已提交', icon: 'success' });
        this.load();
      })
      .catch(() => {
        wx.hideLoading();
        this.setData({ submitting: false });
        wx.showToast({ title: '上传或提交失败，请重试', icon: 'none' });
      });
  }
});
