// ============ 模拟数据 ============

// 顶部关键指标
const overview = {
  studentCount: 46,
  avgScore: 82.5,
  excellentRate: 32,
  passRate: 91
};

// 各科平均分（柱状图）
const subjectAvg = {
  labels: ['语文', '数学', '英语', '物理', '化学', '生物'],
  values: [84, 78, 86, 75, 82, 88],
  max: 100
};

// 月考平均分趋势（折线图）
const scoreTrend = {
  labels: ['9月', '10月', '11月', '12月', '1月', '期中'],
  values: [76, 79, 78, 82, 80, 85]
};

// 成绩分布（饼图）
const scoreDist = {
  items: [
    { name: '优秀(≥90)', value: 15, color: '#5B7CFF' },
    { name: '良好(80-89)', value: 19, color: '#24C8A0' },
    { name: '及格(60-79)', value: 8, color: '#FFB020' },
    { name: '不及格(<60)', value: 4, color: '#FF5A5F' }
  ]
};

// 能力维度（雷达图）
const ability = {
  labels: ['知识', '应用', '分析', '表达', '协作', '创新'],
  values: [85, 72, 78, 90, 68, 80],
  max: 100
};

// 班级管理 - 学生名单
const students = [
  { id: 1, name: '陈嘉言', no: '01', gender: '男', score: 95, duty: '学习委员', avatarColor: '#5B7CFF' },
  { id: 2, name: '林可欣', no: '02', gender: '女', score: 92, duty: '班长', avatarColor: '#24C8A0' },
  { id: 3, name: '王梓轩', no: '03', gender: '男', score: 78, duty: '体育委员', avatarColor: '#FFB020' },
  { id: 4, name: '赵梦琪', no: '04', gender: '女', score: 88, duty: '文娱委员', avatarColor: '#7E5BFF' },
  { id: 5, name: '刘子航', no: '05', gender: '男', score: 56, duty: '组员', avatarColor: '#FF5A5F' },
  { id: 6, name: '孙雨萱', no: '06', gender: '女', score: 83, duty: '组长', avatarColor: '#00B8D9' },
  { id: 7, name: '周思远', no: '07', gender: '男', score: 90, duty: '组员', avatarColor: '#5B7CFF' },
  { id: 8, name: '吴晓彤', no: '08', gender: '女', score: 71, duty: '课代表', avatarColor: '#24C8A0' }
];

// 已布置作业
const homeworkList = [
  { id: 1, subject: '数学', title: '函数与导数专项练习', deadline: '10-08 22:00', done: 32, total: 46, status: '进行中' },
  { id: 2, subject: '英语', title: 'Unit 3 课文背诵 + 词汇表', deadline: '10-06 08:00', done: 46, total: 46, status: '已截止' },
  { id: 3, subject: '语文', title: '作文《我的理想》800字', deadline: '10-10 22:00', done: 12, total: 46, status: '进行中' },
  { id: 4, subject: '物理', title: '牛顿运动定律课后题', deadline: '10-05 22:00', done: 40, total: 46, status: '进行中' }
];

// 成绩发布 - 每次考试
const exams = [
  { id: 1, name: '第一次月考', date: '2026-10-01', published: true, avg: 82.5 },
  { id: 2, name: '期中统考', date: '2026-11-15', published: false, avg: 0 },
  { id: 3, name: '第二次月考', date: '2026-12-02', published: false, avg: 0 }
];

// 学生作业（学生端查看）
const studentHomework = [
  { id: 1, subject: '数学', title: '函数与导数专项练习', deadline: '10-08 22:00', status: '待完成', progress: 0.4 },
  { id: 2, subject: '语文', title: '作文《我的理想》800字', deadline: '10-10 22:00', status: '已完成', progress: 1 },
  { id: 3, subject: '英语', title: 'Unit 3 课文背诵 + 词汇表', deadline: '10-06 08:00', status: '已逾期', progress: 0.7 },
  { id: 4, subject: '物理', title: '牛顿运动定律课后题', deadline: '10-05 22:00', status: '已完成', progress: 1 }
];

// 学生成绩（学生端查看）
const studentScores = [
  { subject: '语文', score: 92, classAvg: 84, classRank: 5 },
  { subject: '数学', score: 78, classAvg: 78, classRank: 21 },
  { subject: '英语', score: 96, classAvg: 86, classRank: 2 },
  { subject: '物理', score: 81, classAvg: 75, classRank: 12 },
  { subject: '化学', score: 88, classAvg: 82, classRank: 8 },
  { subject: '生物', score: 90, classAvg: 88, classRank: 6 }
];

// 学生点评（学生端查看）
const reviews = [
  { id: 1, teacher: '李老师', subject: '数学', time: '2026-10-03 16:20', type: '进步', content: '最近函数部分进步明显，思路清晰，继续保持！注意计算细节。' },
  { id: 2, teacher: '王老师', subject: '英语', time: '2026-10-01 09:10', type: '表扬', content: '口语表达流利，课堂互动积极，是同学们的榜样。' },
  { id: 3, teacher: '张老师', subject: '语文', time: '2026-09-28 14:00', type: '建议', content: '作文素材积累丰富，但结构可以更紧凑一些，注意分段。' }
];

module.exports = {
  overview,
  subjectAvg,
  scoreTrend,
  scoreDist,
  ability,
  students,
  homeworkList,
  exams,
  studentHomework,
  studentScores,
  reviews
};
