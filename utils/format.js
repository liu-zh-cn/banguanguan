// 时间戳 → "YYYY-MM-DD HH:mm"；缺 ts 的老数据显示 "—"，不假装是刚刚
function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    '-' + p(d.getMonth() + 1) +
    '-' + p(d.getDate()) +
    ' ' + p(d.getHours()) +
    ':' + p(d.getMinutes())
  );
}

module.exports = { fmtTime };
