// 主题：跟随系统 / 深色 / 浅色
// 实现方式：在页面根节点挂 .theme-dark / .theme-light 类，
// 这两个类只覆盖 CSS 变量，页面其它样式不用改。
// - 存 'auto' 时不挂类，交给 @media (prefers-color-scheme: dark) 跟随系统
// - 类选择器优先级高于 page 选择器，所以手动选择能压过系统设置
const KEY = 'themeMode';

function getMode() {
  const m = wx.getStorageSync(KEY);
  return m === 'dark' || m === 'light' ? m : 'auto';
}

function setMode(mode) {
  wx.setStorageSync(KEY, mode === 'dark' || mode === 'light' ? mode : 'auto');
}

function themeClass() {
  const m = getMode();
  if (m === 'dark') return 'theme-dark';
  if (m === 'light') return 'theme-light';
  return '';
}

// 系统当前的深浅色（开着 darkmode 时才拿得到 theme 字段）
function isSystemDark() {
  try {
    const info = wx.getSystemInfoSync();
    return info.theme === 'dark';
  } catch (e) {
    return false;
  }
}

// 页面 onShow 里调用：切换设置后返回上一页也能立刻生效。
// 顺带把导航栏颜色也对齐，否则手动切深色时顶部还是亮蓝色一条
function applyTheme(page) {
  if (!page || !page.setData) return;
  const cls = themeClass();
  if (page.data && page.data.themeClass !== cls) page.setData({ themeClass: cls });

  const dark = cls === 'theme-dark' || (cls === '' && isSystemDark());
  try {
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: dark ? '#1B1F29' : '#5B7CFF',
      fail() {}
    });
  } catch (e) {
    // 个别基础库不支持，忽略即可，不影响页面
  }
}

module.exports = { getMode, setMode, themeClass, applyTheme, KEY };
