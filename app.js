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

  // ---------- 用户资料：默认值（本地缓存，用于个性化展示） ----------
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
