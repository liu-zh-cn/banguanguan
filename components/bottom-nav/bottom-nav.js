const TEACHER_TABS = [
  { text: '统计数据', icon: '📊', path: '/pages/teacher/stats/stats' },
  { text: '班级管理', icon: '👥', path: '/pages/teacher/class/class' },
  { text: '布置作业', icon: '📝', path: '/pages/teacher/homework-assign/homework-assign' },
  { text: '发布成绩', icon: '📈', path: '/pages/teacher/score-publish/score-publish' },
  { text: '我的', icon: '👤', path: '/pages/teacher/mine/mine' }
];

const STUDENT_TABS = [
  { text: '查看作业', icon: '📚', path: '/pages/student/homework/homework' },
  { text: '查看成绩', icon: '🏆', path: '/pages/student/score/score' },
  { text: '查看点评', icon: '💬', path: '/pages/student/review/review' },
  { text: '我的', icon: '👤', path: '/pages/student/mine/mine' }
];

Component({
  properties: {
    role: { type: String, value: 'teacher' },
    active: { type: Number, value: 0 }
  },
  data: {
    tabs: []
  },
  observers: {
    role: function (role) {
      this.setData({ tabs: role === 'student' ? STUDENT_TABS : TEACHER_TABS });
    }
  },
  lifetimes: {
    attached() {
      this.setData({ tabs: this.data.role === 'student' ? STUDENT_TABS : TEACHER_TABS });
    }
  },
  methods: {
    onTap(e) {
      const index = e.currentTarget.dataset.index;
      if (index === this.data.active) return;
      const tab = this.data.tabs[index];
      wx.reLaunch({ url: tab.path });
    }
  }
});
