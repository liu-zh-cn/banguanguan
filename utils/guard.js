// 表单离开保护：只有用户真正改过内容后才启用，避免刚打开页面就弹提示。
// 基础库低于 2.12.0 时 API 不存在，这里静默跳过，不影响正常返回。
function markDirty(page, message) {
  if (!page || page._dirty) return;
  page._dirty = true;
  if (wx.enableAlertBeforeUnload) {
    wx.enableAlertBeforeUnload({
      message: message || '内容还没保存，确定离开吗？'
    });
  }
}

function clearDirty(page) {
  if (!page) return;
  page._dirty = false;
  if (wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload();
}

module.exports = { markDirty, clearDirty };
