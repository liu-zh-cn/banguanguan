Component({
  properties: {
    type: { type: String, value: 'bar' },
    data: { type: Object, value: {} },
    theme: { type: String, value: '#5B7CFF' }
  },
  data: {},
  observers: {
    'type, data': function () {
      this.render();
    }
  },
  lifetimes: {
    ready() {
      this.initCanvas();
    }
  },
  methods: {
    initCanvas() {
      this.createSelectorQuery()
        .select('#chartCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) return;
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 2;
          const w = res[0].width;
          const h = res[0].height;
          canvas.width = w * dpr;
          canvas.height = h * dpr;
          ctx.scale(dpr, dpr);
          this._canvas = canvas;
          this._ctx = ctx;
          this._w = w;
          this._h = h;
          this._ready = true;
          this.render();
        });
    },

    clear() {
      const ctx = this._ctx;
      ctx.clearRect(0, 0, this._w, this._h);
    },

    render() {
      if (!this._ready) return;
      this.clear();
      const t = this.data.type;
      if (t === 'bar') this.drawBar();
      else if (t === 'line') this.drawLine();
      else if (t === 'pie') this.drawPie();
      else if (t === 'radar') this.drawRadar();
    },

    // ---------- 柱状图 ----------
    drawBar() {
      const ctx = this._ctx, w = this._w, h = this._h;
      const { labels = [], values = [], max: dMax } = this.data.data || {};
      const padL = 34, padR = 12, padT = 24, padB = 34;
      const cw = w - padL - padR, ch = h - padT - padB;
      const max = dMax || Math.max.apply(null, values.concat([1])) * 1.2;

      ctx.font = '10px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const y = padT + (ch * i) / 4;
        ctx.strokeStyle = '#EEF0F5';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillStyle = '#A6ABC0';
        ctx.fillText(Math.round(max * (1 - i / 4)), padL - 6, y);
      }

      const n = values.length || 1;
      const slot = cw / n;
      const barW = Math.min(slot * 0.5, 30);
      const theme = this.data.theme;
      values.forEach((v, i) => {
        const bh = (ch * v) / max;
        const x = padL + slot * i + (slot - barW) / 2;
        const y = padT + ch - bh;
        const grad = ctx.createLinearGradient(0, y, 0, padT + ch);
        grad.addColorStop(0, theme);
        grad.addColorStop(1, 'rgba(91,124,255,0.35)');
        ctx.fillStyle = grad;
        this.roundRect(x, y, barW, bh, 6);
        ctx.fill();

        ctx.fillStyle = '#5A6072';
        ctx.textAlign = 'center';
        ctx.font = '10px sans-serif';
        ctx.fillText(this.fitLabel(labels[i] || '', Math.min(slot * 0.95, 84)), x + barW / 2, h - padB / 2);
        ctx.fillStyle = theme;
        ctx.fillText(v, x + barW / 2, y - 8);
      });
    },

    // ---------- 折线图 ----------
    drawLine() {
      const ctx = this._ctx, w = this._w, h = this._h;
      const { labels = [], values = [] } = this.data.data || {};
      const padL = 34, padR = 16, padT = 24, padB = 34;
      const cw = w - padL - padR, ch = h - padT - padB;
      const max = Math.max.apply(null, values.concat([1])) * 1.1;
      const min = Math.min.apply(null, values.concat([0])) * 0.9;
      const range = max - min || 1;
      const theme = this.data.theme;

      ctx.strokeStyle = '#EEF0F5';
      ctx.fillStyle = '#A6ABC0';
      ctx.font = '10px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'right';
      for (let i = 0; i <= 4; i++) {
        const y = padT + (ch * i) / 4;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillText(Math.round(max - (range * i) / 4), padL - 6, y);
      }

      const n = values.length || 1;
      // n <= 1 时没有"间隔"可分，单点居中显示；其余情况按等间隔铺开
      const step = n > 1 ? cw / (n - 1) : 0;
      const xAt = (i) => (n > 1 ? padL + step * i : padL + cw / 2);
      const pts = values.map((v, i) => ({
        x: xAt(i),
        // 所有点分数相同时 range 会退化成 0，靠 || 1 兜底，避免 NaN
        y: padT + ch - ((v - min) / range) * ch
      }));

      if (n > 1) {
        const areaGrad = ctx.createLinearGradient(0, padT, 0, padT + ch);
        areaGrad.addColorStop(0, 'rgba(91,124,255,0.28)');
        areaGrad.addColorStop(1, 'rgba(91,124,255,0)');
        ctx.beginPath();
        ctx.moveTo(pts[0].x, padT + ch);
        pts.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.lineTo(pts[pts.length - 1].x, padT + ch);
        ctx.closePath();
        ctx.fillStyle = areaGrad;
        ctx.fill();

        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.strokeStyle = theme;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      // 标签可用宽度不超过相邻点的水平间距（首尾标签各有一半会压到边界，上限再压到 64），
      // 超长截断成「xx…」，避免考试名较长时相邻标签互相重叠
      const labelMaxW = n > 1 ? Math.max(24, Math.min(step * 0.92, 64)) : 64;
      pts.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = theme;
        ctx.stroke();
        ctx.fillStyle = '#5A6072';
        ctx.textAlign = 'center';
        ctx.font = '10px sans-serif';
        ctx.fillText(this.fitLabel(labels[i] || '', labelMaxW), p.x, h - padB / 2);
      });
    },

    // ---------- 饼图(环形) ----------
    drawPie() {
      const ctx = this._ctx, w = this._w, h = this._h;
      const items = (this.data.data && this.data.data.items) || [];
      const rawTotal = items.reduce((s, it) => s + (Number(it.value) || 0), 0);
      // 全 0 时也用 1 作除数避免 NaN，但中心文字要显示真实的 0 而不是借位的 1
      const total = rawTotal > 0 ? rawTotal : 1;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) / 2 - 12;
      const ir = r * 0.58;
      let start = -Math.PI / 2;
      items.forEach((it) => {
        const ang = (it.value / total) * Math.PI * 2;
        const end = start + ang;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, start, end);
        ctx.closePath();
        ctx.fillStyle = it.color;
        ctx.fill();
        start = end;
      });
      ctx.beginPath();
      ctx.arc(cx, cy, ir, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();

      ctx.fillStyle = '#1F2430';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(rawTotal > 0 ? rawTotal : 0, cx, cy - 8);
      ctx.fillStyle = '#A6ABC0';
      ctx.font = '10px sans-serif';
      ctx.fillText('总人数', cx, cy + 12);
    },

    // ---------- 雷达图 ----------
    drawRadar() {
      const ctx = this._ctx, w = this._w, h = this._h;
      const { labels = [], values = [], max: dMax } = this.data.data || {};
      const n = labels.length || 1;
      const cx = w / 2;
      const cy = h / 2 + 4;
      const r = Math.min(w, h) / 2 - 34;
      const max = dMax || Math.max.apply(null, values.concat([1]));
      const theme = this.data.theme;
      const angleAt = (i) => -Math.PI / 2 + (Math.PI * 2 * i) / n;

      for (let ring = 1; ring <= 4; ring++) {
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = angleAt(i % n);
          const rr = (r * ring) / 4;
          const x = cx + Math.cos(a) * rr;
          const y = cy + Math.sin(a) * rr;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = '#EBEEF5';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      for (let i = 0; i < n; i++) {
        const a = angleAt(i);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.strokeStyle = '#EBEEF5';
        ctx.stroke();
        const lx = cx + Math.cos(a) * (r + 16);
        const ly = cy + Math.sin(a) * (r + 16);
        ctx.fillStyle = '#6B7180';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.fitLabel(labels[i], 60), lx, ly);
      }

      ctx.beginPath();
      values.forEach((v, i) => {
        const a = angleAt(i);
        const rr = (r * v) / max;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(91,124,255,0.25)';
      ctx.fill();
      ctx.strokeStyle = theme;
      ctx.lineWidth = 2;
      ctx.stroke();

      values.forEach((v, i) => {
        const a = angleAt(i);
        const rr = (r * v) / max;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 3, 0, Math.PI * 2);
        ctx.fillStyle = theme;
        ctx.fill();
      });
    },

    // 标签超宽时截断加省略号（须在设置好 font 之后调用，measureText 依赖当前字体）
    fitLabel(text, maxWidth) {
      const ctx = this._ctx;
      const s = String(text || '');
      if (!s || ctx.measureText(s).width <= maxWidth) return s;
      let cut = s;
      while (cut.length > 1 && ctx.measureText(cut + '…').width > maxWidth) {
        cut = cut.slice(0, -1);
      }
      return cut + '…';
    },

    roundRect(x, y, width, height, radius) {
      const ctx = this._ctx;
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      // 四个角都要带圆角半径，漏传会让右边两角变成直角
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + width, y, x + width, y + height, r);
      ctx.arcTo(x + width, y + height, x, y + height, r);
      ctx.arcTo(x, y + height, x, y, r);
      ctx.arcTo(x, y, x + width, y, r);
      ctx.closePath();
    }
  }
});
