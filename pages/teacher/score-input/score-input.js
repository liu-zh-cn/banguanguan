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
    saving: false,
    batchOpen: false,
    batchText: ''
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

  // ---------- 批量粘贴 ----------
  openBatch() {
    this.setData({ batchOpen: true, batchText: '' });
  },

  closeBatch() {
    this.setData({ batchOpen: false, batchText: '' });
  },

  onBatchInput(e) {
    this.setData({ batchText: e.detail.value });
  },

  // 支持三种写法，一行一条：
  //   学号 分数  /  学号,分数  /  只写分数（按名单顺序从上往下填）
  // 解析完只改表格里的输入框，不自动保存——老师还能先核对再点保存
  applyBatch() {
    const text = String(this.data.batchText || '');
    const lines = text
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!lines.length) {
      wx.showToast({ title: '粘贴内容为空', icon: 'none' });
      return;
    }

    const fullScore = this.data.fullScore || 100;
    const rows = this.data.rows.slice();
    const byNo = {};
    rows.forEach((r, i) => {
      if (r.no) byNo[String(r.no).trim()] = i;
    });

    let matched = 0;
    let skipped = 0;
    let cursor = 0;

    lines.forEach((line) => {
      const parts = line.split(/[\s,，\t]+/).filter(Boolean);
      let key = '';
      let scoreText = '';
      if (parts.length >= 2) {
        key = parts[0];
        scoreText = parts[parts.length - 1];
      } else {
        scoreText = parts[0];
      }

      const n = Number(scoreText);
      if (scoreText === '' || isNaN(n) || n < 0 || n > fullScore) {
        skipped++;
        return;
      }

      if (key) {
        const idx = byNo[key];
        if (idx === undefined) {
          skipped++;
          return;
        }
        rows[idx] = { ...rows[idx], val: String(n) };
        matched++;
        return;
      }

      // 只有分数：按名单顺序填到下一个还空着的学生
      while (cursor < rows.length && rows[cursor].val !== '') cursor++;
      if (cursor >= rows.length) {
        skipped++;
        return;
      }
      rows[cursor] = { ...rows[cursor], val: String(n) };
      cursor++;
      matched++;
    });

    this.setData({ rows, batchOpen: false, batchText: '' });
    wx.showToast({
      title: '填了 ' + matched + ' 条' + (skipped ? '，跳过 ' + skipped + ' 行' : ''),
      icon: 'none'
    });
  },

  // ---------- 导出：整张成绩表复制成制表符分隔文本，粘进 Excel 自动分列 ----------
  copyScores() {
    const subjects = this.data.subjects || [];
    const students = this._students || [];
    if (!students.length) {
      wx.showToast({ title: '还没有学生', icon: 'none' });
      return;
    }
    const lines = [['学号', '姓名'].concat(subjects).join('\t')];
    students.forEach((s) => {
      const map = (this._scores && this._scores[s.openid]) || {};
      const cells = subjects.map((sub) => (typeof map[sub] === 'number' ? String(map[sub]) : ''));
      lines.push([s.no || '', s.name || ''].concat(cells).join('\t'));
    });
    wx.setClipboardData({ data: lines.join('\n') });
  },

  save() {
    if (this.data.saving) return;
    const { examId, subject, rows } = this.data;
    const fullScore = this.data.fullScore || 100;

    // 先在前端拦一道，把「哪个学生超了多少分」说清楚；云函数里还会再校验一次
    // 空值不是"跳过"，而是"清空该科目分数"——录错了要能删掉
    const items = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const raw = String(row.val).trim();
      const prev = this._scores[row.openid] || {};
      const had = typeof prev[subject] === 'number';

      if (raw === '') {
        if (had) items.push({ openid: row.openid, name: row.name, score: null });
        continue;
      }

      const n = Number(raw);
      if (isNaN(n) || n < 0 || n > fullScore) {
        wx.showToast({
          title: (row.name || '某位同学') + ' 的分数需在 0–' + fullScore + ' 之间',
          icon: 'none'
        });
        return;
      }
      items.push({ openid: row.openid, name: row.name, score: n });
    }

    if (!items.length) {
      wx.showToast({ title: '没有需要保存的改动', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中' });
    app
      .cloudInputScores({ examId, subject, items })
      .then((r) => {
        wx.hideLoading();
        this.setData({ saving: false });
        if (!r.ok) {
          wx.showToast({ title: r.msg || '保存失败', icon: 'none' });
          return;
        }
        // 同步到本地缓存，切科目再回来不丢；被清空的科目要从缓存里删掉
        items.forEach((it) => {
          this._scores[it.openid] = this._scores[it.openid] || {};
          if (it.score === null) {
            delete this._scores[it.openid][subject];
          } else {
            this._scores[it.openid][subject] = it.score;
          }
        });
        const saved = r.saved || 0;
        const cleared = r.cleared || 0;
        let msg = '已保存 ' + saved + ' 条';
        if (cleared) msg += '，清除 ' + cleared + ' 条';
        wx.showToast({ title: msg, icon: 'success' });
        this.buildRows();
      })
      .catch(() => {
        wx.hideLoading();
        this.setData({ saving: false });
        wx.showToast({ title: '网络/云函数错误', icon: 'none' });
      });
  }
});
