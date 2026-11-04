// 前端共用常量：避免同一份颜色 / 科目 / 满分档位在多个页面各自演化
const TYPE_MAP = {
  进步: { cls: 'tag-blue', color: '#5B7CFF' },
  表扬: { cls: 'tag-green', color: '#24C8A0' },
  建议: { cls: 'tag-orange', color: '#FFB020' }
};

const PALETTE = ['#5B7CFF', '#24C8A0', '#FFB020', '#7E5BFF', '#FF5A5F', '#00B8D9'];

const DEFAULT_SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物'];

// 与 score-publish 的满分选择器一致；云函数 createExam 仍接受 1~1000，便于后台扩展
const FULL_SCORES = [100, 120, 150, 200];

module.exports = { TYPE_MAP, PALETTE, DEFAULT_SUBJECTS, FULL_SCORES };
