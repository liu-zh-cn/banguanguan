const app = getApp();

Page({
  data: {
    examId: '',
    examName: '',
    fullScore: 100,
    subjects: [],
    subjectIndex: 0,
    subject: '',
    rows: [], // 当前科目：{ openid, name, no, val }
    loading: true,
    saving: false
  },

  onLoad(options) {
    const examId = (options && options.examId) || '';
    if (!examId) {
      wx.showToast({ title: '缺少考试参数', icon: 'none' });
      return;
    }
    this.setData({ examId });
    this.load();
  },

  load() {
    this.setData({ loading: true });
    app
      .cloudGetExamScores(this.data.examId)
      .then((r) => {
        if (!r.ok) {
          this.setData({ loading: false });
          wx.showToast({ title: r.msg || '加载失败', icon: 'none' });
          return;
        }
        this._scores = r.scores || {}; // { openid: { 科目: 分数 } }
        this._students = r.students || [];
        const subjects = (r.exam && r.exam.subjects) || [];
        this.setData({
          loading: false,
          examName: (r.exam && r.exam.name) || '',
          fullScore: (r.exam && r.exam.fullScore) || 100,
          subjects,
          subjectIndex: 0,
          subject: subjects[0] || ''
        });
        this.buildRows();
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '网络/云函数错误', icon: 'none' });
      });
  },

  // 按当前科目，拼出「学生 + 已录分数」列表
  buildRows() {
    const sub = this.data.subject;
    const rows = this._students.map((s) => {
      const map = this._scores[s.openid] || {};
      const v = map[sub];
      return {
        openid: s.openid,
        name: s.name,
        no: s.no,
        val: typeof v === 'number' ? String(v) : ''
      };
    });
    this.setData({ rows });
  },

  pickSubject(e) {
    const i = Number(e.currentTarget.dataset.index);
    if (i === this.data.subjectIndex) return;
    this.setData({ subjectIndex: i, subject: this.data.subjects[i] });
    this.buildRows();
  },

  onInput(e) {
    const i = Number(e.currentTarget.dataset.index);
    const rows = this.data.rows.slice();
    rows[i] = { ...rows[i], val: e.detail.value };
    this.setData({ rows });
  },

  save() {
    if (this.data.saving) return;
    const { examId, subject, rows } = this.data;
    const fullScore = this.data.fullScore || 100;

    // 先在前端拦一道，把「哪个学生超了多少分」说清楚；云函数里还会再校验一次
    const valid = [];
    for (let i = 0; i < rows.length; i++) {
      const raw = String(rows[i].val).trim();
      if (raw === '') continue;
      const n = Number(raw);
      if (isNaN(n) || n < 0 || n > fullScore) {
        wx.showToast({
          title: (rows[i].name || '某位同学') + ' 的分数需在 0–' + fullScore + ' 之间',
          icon: 'none'
        });
        return;
      }
      valid.push({ openid: rows[i].openid, name: rows[i].name, score: n });
    }

    if (!valid.length) {
      wx.showToast({ title: '请至少录入一个成绩', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    wx.showLoading({ title: '保存中' });
    app
      .cloudInputScores({ examId, subject, items: valid })
      .then((r) => {
        wx.hideLoading();
        this.setData({ saving: false });
        if (!r.ok) {
          wx.showToast({ title: r.msg || '保存失败', icon: 'none' });
          return;
        }
        // 同步到本地缓存，切科目再回来不丢
        valid.forEach((it) => {
          this._scores[it.openid] = this._scores[it.openid] || {};
          this._scores[it.openid][subject] = it.score;
        });
        wx.showToast({ title: '已保存 ' + r.saved + ' 条', icon: 'success' });
      })
      .catch(() => {
        wx.hideLoading();
        this.setData({ saving: false });
        wx.showToast({ title: '网络/云函数错误', icon: 'none' });
      });
  }
});
