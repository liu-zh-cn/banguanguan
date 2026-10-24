// 若有多个云开发环境，填入对应环境 ID；只有一个环境时留空即可（使用默认环境）
const CLOUD_ENV = 'cloud1-d2gehv836076eaf14';

App({
  globalData: {
    role: '',
    teacherName: '李老师',
    className: '',
    classId: '',
    openid: '',
    userInfo: null
  },

  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init(
        Object.assign({ traceUser: true }, CLOUD_ENV ? { env: CLOUD_ENV } : {})
      );
    } else {
      console.error('当前基础库过低，请升级到 2.2.3 以上以使用云开发能力');
    }

    const role = wx.getStorageSync('role');
    if (role) this.globalData.role = role;
    this.globalData.openid = wx.getStorageSync('openid') || '';
  },

  setRole(role) {
    this.globalData.role = role;
    wx.setStorageSync('role', role);
  },

  // ---------- 隐私授权：手机号等个人信息需用户主动同意 ----------
  // 说明：本小程序不调用任何微信用户信息接口，手机号为用户在页面手动输入。
  // 按《个人信息保护法》与微信审核要求，收集前须明确告知并取得同意。
  hasPhoneConsent() {
    try {
      return wx.getStorageSync('phoneConsent') === true;
    } catch (e) {
      return false;
    }
  },

  setPhoneConsent(ok) {
    try {
      wx.setStorageSync('phoneConsent', !!ok);
    } catch (e) {
      // 存储失败不影响主流程，仅退化为每次都要重新同意
    }
    this.globalData.phoneConsent = !!ok;
  },

  // 打开《隐私政策》或《用户服务协议》
  openPrivacy(tab) {
    wx.navigateTo({
      url: '/pages/privacy/privacy' + (tab === 'agreement' ? '?tab=agreement' : '')
    });
  },

  // ---------- 云开发：登录 / 注册 ----------
  // 调 login 云函数拿 openid，并查询该微信是否已注册
  cloudLogin() {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud.callFunction({ name: 'login' }).then((res) => {
      const r = (res && res.result) || {};
      this.globalData.openid = r.openid || '';
      this.globalData.userInfo = r.user || null;
      if (r.openid) wx.setStorageSync('openid', r.openid);
      if (r.user && r.user.role) this.setRole(r.user.role);
      return r;
    });
  },

  // 调 register 云函数，把资料写入 users 表（以 openid 为唯一键）
  cloudRegister(payload) {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud.callFunction({ name: 'register', data: payload }).then(
      (res) => (res && res.result) || {}
    );
  },

  // 更新资料到 users 表（服务端只接受白名单字段，不会改 role / classId）
  cloudUpdateProfile(payload) {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud.callFunction({ name: 'updateProfile', data: payload }).then(
      (res) => (res && res.result) || {}
    );
  },

  // 老师创建班级
  cloudCreateClass(payload) {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud.callFunction({ name: 'createClass', data: payload }).then(
      (res) => (res && res.result) || {}
    );
  },

  // 学生凭邀请码加入班级
  cloudJoinClass(inviteCode) {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud.callFunction({ name: 'joinClass', data: { inviteCode } }).then(
      (res) => (res && res.result) || {}
    );
  },

  // 拉取当前用户的班级上下文（classId / 班级信息 / 学生名单）
  cloudMyClass() {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud
      .callFunction({ name: 'myClass' })
      .then((res) => (res && res.result) || {})
      .then((r) => {
        if (r && r.user) {
          this.globalData.classId = r.user.classId || '';
          this.globalData.className = r.user.className || '';
          this.globalData.userInfo = r.user;
          if (r.user.role) this.setRole(r.user.role);
        }
        return r;
      });
  },

  // 老师发送广播到大屏
  cloudSendBroadcast(text) {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud
      .callFunction({ name: 'sendBroadcast', data: { text } })
      .then((res) => (res && res.result) || {});
  },

  // 大屏凭邀请码解析班级（只读）
  cloudGetClassByCode(inviteCode) {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud
      .callFunction({ name: 'getClassByCode', data: { inviteCode } })
      .then((res) => (res && res.result) || {});
  },

  // 大屏凭邀请码取本班最新广播（不再直连 broadcasts 集合，避免全量可读）
  cloudGetBroadcast(inviteCode) {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud
      .callFunction({ name: 'getBroadcast', data: { inviteCode } })
      .then((res) => (res && res.result) || {});
  },

  // ---------- 作业 ----------
  cloudAssignHomework(payload) {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud
      .callFunction({ name: 'assignHomework', data: payload })
      .then((res) => (res && res.result) || {});
  },

  cloudListHomework() {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud
      .callFunction({ name: 'listHomework' })
      .then((res) => (res && res.result) || {});
  },

  cloudSubmitHomework(homeworkId, content) {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud
      .callFunction({ name: 'submitHomework', data: { homeworkId, content } })
      .then((res) => (res && res.result) || {});
  },

  // 老师撤回作业（连带删除学生的提交记录）
  cloudDeleteHomework(homeworkId) {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud
      .callFunction({ name: 'deleteHomework', data: { homeworkId } })
      .then((res) => (res && res.result) || {});
  },

  // ---------- 考试 / 成绩 ----------
  // 老师新建考试
  cloudCreateExam(payload) {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud
      .callFunction({ name: 'createExam', data: payload })
      .then((res) => (res && res.result) || {});
  },

  // 列出本班考试（老师含平均分）
  cloudListExams() {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud
      .callFunction({ name: 'listExams' })
      .then((res) => (res && res.result) || {});
  },

  // 老师发布/撤回考试成绩
  cloudSetExamPublished(examId, published) {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud
      .callFunction({ name: 'setExamPublished', data: { examId, published } })
      .then((res) => (res && res.result) || {});
  },

  // 录入成绩页：考试信息 + 学生名单 + 已录成绩
  cloudGetExamScores(examId) {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud
      .callFunction({ name: 'getExamScores', data: { examId } })
      .then((res) => (res && res.result) || {});
  },

  // 老师保存某一科的成绩
  cloudInputScores(payload) {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud
      .callFunction({ name: 'inputScores', data: payload })
      .then((res) => (res && res.result) || {});
  },

  // 学生：我的成绩（可按考试切换）
  cloudMyScores(examId) {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud
      .callFunction({ name: 'myScores', data: { examId: examId || '' } })
      .then((res) => (res && res.result) || {});
  },

  // 老师数据看板：总览 + 图表 + 每位学生最新均分
  cloudClassStats() {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud
      .callFunction({ name: 'classStats' })
      .then((res) => (res && res.result) || {});
  },

  // ---------- 点评 ----------
  // 老师给学生写点评
  cloudAddReview(payload) {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud
      .callFunction({ name: 'addReview', data: payload })
      .then((res) => (res && res.result) || {});
  },

  // 点评列表（学生：我收到的；老师：我写的）
  cloudListReviews() {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud
      .callFunction({ name: 'listReviews' })
      .then((res) => (res && res.result) || {});
  },

  // 学生回复老师给自己的点评（可重复调用以修改回复）
  cloudReplyReview(reviewId, content) {
    if (!wx.cloud) return Promise.reject(new Error('cloud-not-supported'));
    return wx.cloud
      .callFunction({ name: 'replyReview', data: { reviewId, content } })
      .then((res) => (res && res.result) || {});
  },

  // ---------- 用户资料：本地缓存只负责展示，真实资料以云端 users 表为准 ----------
  // 注意：className 对学生只用于本地展示，学生真实班级由 joinClass 决定
  defaultProfile(role) {
    if (role === 'student') {
      return {
        name: '刘同学',
        gender: '男',
        phone: '',
        studentNo: '',
        className: '',
        signature: '好好学习，天天向上～'
      };
    }
    return {
      name: '李老师',
      gender: '女',
      phone: '',
      title: '班主任',
      subject: '',
      className: '',
      signature: '用心带好每一个班。'
    };
  },

  getProfile(role) {
    const saved = wx.getStorageSync('profile_' + role) || {};
    return Object.assign(this.defaultProfile(role), saved);
  },

  saveProfile(role, profile) {
    wx.setStorageSync('profile_' + role, profile);
    if (role === 'teacher') {
      this.globalData.teacherName = profile.name;
      this.globalData.className = profile.className;
    }
  },

  // ---------- 我创建的班级 ----------
  getClasses() {
    return wx.getStorageSync('myClasses') || [];
  },

  addClass(item) {
    const list = this.getClasses();
    list.unshift(item);
    wx.setStorageSync('myClasses', list);
    return list;
  }
});
