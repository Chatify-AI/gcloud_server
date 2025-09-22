// 中文翻译配置
export const translations = {
  // 通用
  common: {
    loading: '加载中...',
    save: '保存',
    cancel: '取消',
    delete: '删除',
    edit: '编辑',
    add: '添加',
    refresh: '刷新',
    close: '关闭',
    confirm: '确认',
    submit: '提交',
    reset: '重置',
    search: '搜索',
    filter: '筛选',
    export: '导出',
    import: '导入',
    copy: '复制',
    copied: '已复制',
    actions: '操作',
    status: '状态',
    active: '活跃',
    inactive: '未激活',
    enabled: '已启用',
    disabled: '已禁用',
    yes: '是',
    no: '否',
    all: '全部',
    none: '无',
    select: '选择',
    selected: '已选择',
    success: '成功',
    error: '错误',
    warning: '警告',
    info: '信息'
  },

  // 导航菜单
  menu: {
    dashboard: '控制台',
    accounts: 'GCloud 账户',
    terminal: '终端',
    history: '历史记录',
    apiKeys: 'API 密钥',
    logout: '退出登录'
  },

  // 登录页面
  login: {
    title: 'GCloud 管理器',
    adminLogin: '管理员登录',
    setupAdmin: '设置管理员账户',
    username: '用户名',
    password: '密码',
    usernameRequired: '请输入用户名',
    passwordRequired: '请输入密码',
    minPasswordLength: '密码长度至少6位',
    createAdmin: '创建管理员账户',
    signIn: '登录',
    loginSuccess: '登录成功！',
    loginFailed: '登录失败',
    setupSuccess: '管理员账户创建成功！请登录。',
    setupFailed: '设置失败',
    enterCredentials: '请输入用户名和密码'
  },

  // 控制台页面
  dashboard: {
    title: '控制台',
    totalAccounts: '总账户数',
    activeAccounts: '活跃账户',
    totalExecutions: '总执行次数',
    successRate: '成功率',
    googleCloudAccounts: 'Google Cloud 账户',
    recentExecutions: '最近命令执行',
    noAccounts: '尚未连接任何账户',
    noExecutions: '尚未执行任何命令',
    project: '项目',
    notSet: '未设置',
    loadFailed: '加载控制台数据失败'
  },

  // GCloud账户页面
  accounts: {
    title: 'Google Cloud 账户管理',
    addAccount: '添加账户',
    generateUrl: '生成授权链接',
    authorizationUrl: '授权链接',
    authorizationCode: '授权码',
    enterCode: '请输入授权码',
    copyUrl: '复制链接',
    openInNewTab: '在新标签页打开',
    accountEmail: '账户邮箱',
    displayName: '显示名称',
    projectId: '项目ID',
    projectName: '项目名称',
    lastUsed: '最后使用',
    tokenExpiry: '令牌过期',
    actions: '操作',
    refreshToken: '刷新令牌',
    deleteAccount: '删除账户',
    editAccount: '编辑账户',
    noAccounts: '暂无Google Cloud账户',
    fetchFailed: '获取账户失败',
    addSuccess: '账户添加成功',
    addFailed: '添加账户失败',
    deleteConfirm: '确定要删除这个Google Cloud账户吗？',
    deleteSuccess: '账户删除成功',
    deleteFailed: '删除账户失败',
    refreshSuccess: '令牌刷新成功',
    refreshFailed: '刷新令牌失败',
    updateSuccess: '账户更新成功',
    updateFailed: '更新账户失败',
    generateUrlInfo: '请复制授权链接并在新标签页中打开',
    codeRequired: '请输入授权码',
    never: '从未'
  },

  // API密钥页面
  apiKeys: {
    title: 'API 密钥管理',
    createKey: '创建密钥',
    keyName: '密钥名称',
    keyValue: '密钥值',
    description: '描述',
    permissions: '权限',
    rateLimit: '速率限制',
    expiresAt: '过期时间',
    usageCount: '使用次数',
    lastUsed: '最后使用',
    isActive: '是否激活',
    createdBy: '创建者',
    createdAt: '创建时间',
    actions: '操作',
    noKeys: '暂无API密钥',
    fetchFailed: '获取API密钥失败',
    createSuccess: 'API密钥创建成功',
    createFailed: '创建API密钥失败',
    deleteConfirm: '确定要删除这个API密钥吗？',
    deleteSuccess: 'API密钥删除成功',
    deleteFailed: '删除API密钥失败',
    copySuccess: 'API密钥已复制到剪贴板',
    copyFailed: '复制失败',
    nameRequired: '请输入密钥名称',
    never: '永不过期',
    unlimited: '无限制'
  },

  // 终端页面
  terminal: {
    title: '命令终端',
    selectAccount: '选择账户',
    commandInput: '命令输入',
    enterCommand: '输入命令...',
    execute: '执行',
    executing: '执行中...',
    clear: '清空',
    output: '输出',
    error: '错误',
    noOutput: '无输出',
    executeFailed: '命令执行失败',
    accountRequired: '请选择一个账户',
    commandRequired: '请输入命令'
  },

  // 历史记录页面
  history: {
    title: '执行历史',
    executionId: '执行ID',
    account: '账户',
    command: '命令',
    status: '状态',
    executedBy: '执行者',
    startTime: '开始时间',
    duration: '持续时间',
    output: '输出',
    error: '错误',
    pending: '等待中',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
    viewDetails: '查看详情',
    noHistory: '暂无执行历史',
    fetchFailed: '获取历史记录失败',
    ms: '毫秒'
  },

  // 错误消息
  errors: {
    networkError: '网络错误',
    serverError: '服务器错误',
    unauthorized: '未授权',
    forbidden: '禁止访问',
    notFound: '未找到',
    timeout: '请求超时',
    unknown: '未知错误'
  },

  // 成功消息
  success: {
    saved: '保存成功',
    deleted: '删除成功',
    updated: '更新成功',
    created: '创建成功',
    copied: '复制成功'
  }
};

// 获取翻译文本的辅助函数
export const t = (key) => {
  const keys = key.split('.');
  let value = translations;

  for (const k of keys) {
    if (value[k] === undefined) {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
    value = value[k];
  }

  return value;
};

export default translations;