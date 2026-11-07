// 课程表：数据存在 classes 文档的 timetable 字段里，读取走 myClass，写入走 saveTimetable
const app = getApp();

const DAYS = ['周一', '周二', '周三', '周四', '周五'];
const PERIODS = 8;

// 云端存的是 5 × 8 的字符串二维数组；页面用带 key 的结构渲染，
// 避免 wx:for 用下标当 key（项目里其它列表都是真实字段做 key）
function buildRows(raw) {
  const rows = [];
  let filled = 0;
  for (let r = 0; r < DAYS.length; r++) {
    const src = Array.isArray(raw) && Array.isArray(raw[r]) ? raw[r] : [];
    const cells = [];
    for (let c = 0; c < PERIODS; c++) {
      const text = typeof src[c] === 'string' ? src[c] : '';
      if (text) filled++;
      cells.push({ key: 'r' + r + 'c' + c, r, c, text });
    }
    rows.push({ key: 'r' + r, no: r + 1, cells });
  }
  return { rows, filled };
}

// 页面结构 → 云端结构（去掉 key / 下标）
function toGrid(rows) {
  return rows.map((row) => row.cells.map((cell) => cell.text));
}

Page({
  data: {
    days: DAYS,
    periods: PERIODS,
    rows: buildRows(null).rows,
    className: '',
    isTeacher: false,
    loading: true,
    saving: false,
    filled: 0,
    lastSaved: ''
  },

  onLoad() {
    this.load();
  },

  onShow() {
    // 从别的页面切回来（比如老师换了班级）时重新拉一次
    if (this._loaded) this.load();
  },

  load() {
    app
      .cloudMyClass()
      .then((r) => {
        this._loaded = true;
        if (!r || !r.ok) {
          this.setData({ loading: false });
          app.showError('课程表加载失败');
          return;
        }
        const cls = r.class || {};
        const built = buildRows(cls.timetable);
        this.setData({
          className: cls.name || '未设置班级',
          isTeacher: ((r.user && r.user.role) || '') === 'teacher',
          rows: built.rows,
          filled: built.filled,
          loading: false
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        app.showError('课程表加载失败');
      });
  },

  // 点格子改内容；学生点了只提示
  onCell(e) {
    if (!this.data.isTeacher) {
      wx.showToast({ title: '课程表由老师维护', icon: 'none' });
      return;
    }
    const r = Number(e.currentTarget.dataset.r);
    const c = Number(e.currentTarget.dataset.c);
    const row = this.data.rows[r];
    if (!row || !row.cells[c]) return;
    const cur = row.cells[c].text || '';

    wx.showModal({
      title: DAYS[r] + ' 第 ' + (c + 1) + ' 节',
      editable: true,
      placeholderText: '留空表示这节课没课',
      content: cur,
      success: (res) => {
        if (!res.confirm) return;
        const next = String(res.content || '').replace(/\s+/g, ' ').trim().slice(0, 10);
        if (next === cur) return;
        this.applyCell(r, c, next);
      }
    });
  },

  // 长按清空这一格，省得为了删两个字再点一次输入框
  onClear(e) {
    if (!this.data.isTeacher) return;
    const r = Number(e.currentTarget.dataset.r);
    const c = Number(e.currentTarget.dataset.c);
    const row = this.data.rows[r];
    if (!row || !row.cells[c] || !row.cells[c].text) return;
    this.applyCell(r, c, '');
  },

  applyCell(r, c, value) {
    const old = this.data.rows[r].cells[c].text || '';
    if (old === value) return;

    // 先把新内容拼进一份完整副本再提交，不依赖 setData 的时序
    const grid = toGrid(this.data.rows);
    grid[r][c] = value;

    const delta = (value ? 1 : 0) - (old ? 1 : 0);
    this.setData({
      ['rows[' + r + '].cells[' + c + '].text']: value,
      filled: this.data.filled + delta,
      lastSaved: ''
    });
    this.save(grid);
  },

  // 单飞：保存请求没回来之前又改了格子，只记住最后一次，等前一个回来再发
  save(grid) {
    if (this._saving) {
      this._pending = grid;
      return;
    }
    this._saving = true;
    this.setData({ saving: true });

    app
      .cloudSaveTimetable(grid)
      .then((res) => {
        this._saving = false;
        this.setData({ saving: false });
        if (!res || !res.ok) {
          wx.showToast({ title: (res && res.msg) || '保存失败', icon: 'none' });
          return;
        }
        this.setData({ lastSaved: '已保存' });
        if (this._pending) {
          const next = this._pending;
          this._pending = null;
          this.save(next);
        }
      })
      .catch(() => {
        this._saving = false;
        this.setData({ saving: false });
        app.showError('保存失败，请检查网络');
      });
  }
});
