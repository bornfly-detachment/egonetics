/**
 * translations.ts — AOP i18n registry
 *
 * ALL user-visible text goes through useTranslation().t.xxx
 * No component should hardcode Chinese or English strings.
 *
 * Structure: flat top-level sections, nested by module.
 */

import { useChronicleStore } from '@/stores/useChronicleStore'

export type Language = 'zh' | 'en'

// ── Type definition ───────────────────────────────────────────────────────────

export interface Translation {
  // ── Common ──
  common: {
    save: string
    delete: string
    edit: string
    confirm: string
    loading: string
    success: string
    error: string
    warning: string
    info: string
    cancel: string
    close: string
    back: string
    open: string
    details: string
    execute: string
    submit: string
    submitting: string
    search: string
    noData: string
    collapse: string
    json: string
  }

  // ── Sidebar ──
  sidebar: {
    home: string
    memory: string
    theory: string
    chronicle: string
    tasks: string
    blog: string
    egonetics: string
    tagTree: string
    protocol: string
    protoBuilder: string
    prvseWorld: string
    freeCode: string
    lab: string
    mq: string
    resourcesClaude: string
    resourcesGemini: string
    recycle: string
    collapse: string
    logout: string
    settings: string
  }

  // ── Home ──
  home: {
    tagline: string
    heroDesc: string
    chronicleEntries: string
    currentVersion: string
    systemStatus: string
    active: string
    modules: string
    moduleDesc: {
      memory: string
      egonetics: string
      chronicle: string
      theory: string
      tasks: string
      blog: string
      agents: string
    }
    moduleTitle: {
      memory: string
      egonetics: string
      chronicle: string
      theory: string
      tasks: string
      blog: string
      agents: string
    }
    laws: {
      title: string
      lawLabel: string
      i: { title: string; desc: string }
      ii: { title: string; desc: string }
      iii: { title: string; desc: string }
    }
  }

  // ── Login ──
  login: {
    tagline: string
    loginTitle: string
    registerTitle: string
    verifyTitle: string
    accountLabel: string
    accountPlaceholder: string
    passwordLabel: string
    passwordPlaceholder: string
    loginButton: string
    noAccount: string
    registerLink: string
    hasAccount: string
    loginLink: string
    roleLabel: string
    guestRole: string
    agentRole: string
    guestDesc: string
    agentDesc: string
    emailLabel: string
    emailPlaceholder: string
    emailAvailable: string
    emailTaken: string
    usernameLabel: string
    usernamePlaceholder: string
    usernameAvailable: string
    usernameTaken: string
    confirmPasswordLabel: string
    confirmPasswordPlaceholder: string
    passwordHintPlaceholder: string
    guestSubmit: string
    agentSubmit: string
    verifyCodeSent: string
    verifyValidity: string
    codeLabel: string
    codePlaceholder: string
    verifyButton: string
    backToEdit: string
    resend: string
    resendCountdown: string
    pwStrength: { weak: string; medium: string; strong: string }
    pwCriteria: { minLength: string; uppercase: string; lowercase: string; number: string }
    errors: {
      requireAccount: string
      requirePassword: string
      loginFailed: string
      passwordInvalid: string
      passwordMismatch: string
      requireEmail: string
      requireUsername: string
      registerFailed: string
      invalidCode: string
      verifyFailed: string
      sendFailed: string
    }
  }

  // ── PRVSE World ──
  prvse: {
    dimensions: { constitution: string; resources: string; goals: string }
    layers: {
      concept: string; conceptDesc: string
      engineering: string; engineeringDesc: string
      execution: string; executionDesc: string
    }
    hud: {
      contradiction: string
      convergence: string
      clickToEnter: string
      escToGoBack: string
      clickForDetails: string
    }
    l3Cards: {
      openTask: string
      pendingDecision: string
    }
    l3ai: {
      placeholder: string
      thinking: string
      error: string
      emptyState: string
    }
  }

  // ── Focus Panel ──
  focusPanel: {
    depth: string
    children: string
    openTask: string
    taskLabel: string
    executionEngine: string
    executionStatus: string
    kernelContract: string
    contractDesc: string
    humanDecision: string
    humanInterventionDesc: string
    messageQueue: string
    mqDesc: string
    cyberneticsComponent: string
    cyberneticsDesc: Record<string, string>
    principleTitle: string
    principleDesc: string
    dimensionDesc: Record<string, string>
    resourceTier: string
  }

  // ── Kernel Overlay ──
  kernel: {
    offline: string
  }

  // ── Memory View ──
  memory: {
    title: string
    subtitle: string
    addMemory: string
    searchMemory: string
    calendar: string
    todayMemory: string
    thisMonthMemory: string
    recentMemory: string
    sortByTime: string
    noMemory: string
    selectDateToStart: string
  }

  // ── Theory View ──
  theory: {
    title: string
    subtitle: string
    chainLength: string
    warningTitle: string
    warningDesc: string
    inputPlaceholder: string
    thisEditWillCreate: string
    submitToChain: string
    versionHistory: string
    allVersionsDesc: string
    version: string
    blockNumber: string
    currentHash: string
    previousHash: string
    chainVerified: string
    archiveFailed: string
    versionPlaceholder: string
    summaryPlaceholder: string
  }

  // ── Chronicle View ──
  chronicle: {
    title: string
    subtitle: string
    timelineTitle: string
    addTimelineEntry: string
    entryContent: string
    addEntry: string
    verifying: string
    entryTypes: {
      memory: string
      decision: string
      evolution: string
      principle: string
      task: string
    }
  }

  // ── Egonetics View ──
  egonetics: {
    title: string
    subtitle: string
    principlesTitle: string
    addPrinciple: string
    principleContent: string
    priority: string
    status: string
    active: string
    archived: string
    semanticTitle: string
    semanticSubtitle: string
    executionTitle: string
    executionSubtitle: string
    noSemanticCanvas: string
    noExecutionCanvas: string
    executionHint: string
    newCanvas: string
    canvasNameLabel: string
    canvasNamePlaceholder: string
    descriptionLabel: string
    descriptionPlaceholder: string
    nodeCount: string
    agentExecution: string
    confirmDeleteCanvas: string
    abstractNetwork: string
    abstractSubtitle: string
  }

  // ── Tasks View ──
  tasks: {
    title: string
    subtitle: string
    newTask: string
    taskTitle: string
    taskDescription: string
    taskPriority: string
    low: string
    medium: string
    high: string
    urgent: string
    taskStatus: string
    pending: string
    inProgress: string
    completed: string
    addTask: string
    noTasks: string
    createFirstTask: string
  }

  // ── Execution Console ──
  executionConsole: {
    running: string
    escalated: string
    completed: string
    failed: string
  }

  // ── Proposal Inbox ──
  proposalInbox: {
    types: { classification: string; tagTree: string; task: string; component: string }
    status: { pending: string; approved: string; rejected: string; autoApplied: string }
    conflict: string
    proposalHeader: string
    conflictHeader: string
    approve: string
    reject: string
  }

  // ── Protocol View ──
  protocol: {
    groups: { resourcePermission: string; graduatedControl: string; practice: string }
    categories: {
      permissionLayer: string; communication: string; resourceTier: string
      pMode: string; rRelation: string; vValue: string; sState: string
      interaction: string; uiComponents: string; kernelComponents: string
      lifecycle: string; graphNodes: string
    }
    unanchored: string
  }

  // ── Constitution View ──
  constitution: {
    layers: { meta: string; control: string; subjectivity: string; practice: string; memory: string; adapt: string }
    levels: { l1: string; l2: string; l3: string }
    defaults: {
      metaControl: string; controlOwnership: string; irreversibleOps: string; constitutionImmutable: string
      controlStructure: string; capabilityDict: string; budgetGuard: string; privateDataLocal: string
    }
  }

  // ── Recycle Bin ──
  recycleBin: {
    title: string
    subtitle: string
    pages: Record<string, { label: string; desc: string }>
  }

  // ── Cybernetics Tree ──
  cyberneticsTree: {
    title: string
    emptyTree: string
    clickToView: string
    crudHint: string
    addRoot: string
    description: string
    descriptionPlaceholder: string
  }
}

// ── Chinese ───────────────────────────────────────────────────────────────────

const zh: Translation = {
  common: {
    save: '保存', delete: '删除', edit: '编辑', confirm: '确认',
    loading: '加载中...', success: '成功', error: '错误', warning: '警告', info: '信息',
    cancel: '取消', close: '关闭', back: '返回', open: '打开', details: '详情',
    execute: '执行', submit: '提交', submitting: '提交中...', search: '搜索',
    noData: '暂无数据', collapse: '收起', json: 'JSON',
  },

  sidebar: {
    home: '主页', memory: '记忆', theory: '生变论', chronicle: '生变录',
    tasks: '任务', blog: '博客', egonetics: '自我控制论', tagTree: '标签语义树',
    protocol: '人机协议', protoBuilder: '协议构建器', prvseWorld: 'PRVSE World', freeCode: 'Free Code',
    lab: '测试环境', mq: '消息队列', resourcesClaude: 'AI 用量', resourcesGemini: 'Gemini 感知', recycle: '回收站', collapse: '收起', logout: '退出', settings: '设置',
  },

  home: {
    tagline: 'Ego × Cybernetics — 生命主体性系统',
    heroDesc: '个人 AI 协同进化系统。通过防篡改的编年史记录决策与成长，以宪法主体性约束智能体行为，让记忆、任务与理论在同一个时间轴上收敛。',
    chronicleEntries: 'Chronicle 条目',
    currentVersion: '当前版本',
    systemStatus: '系统状态',
    active: '活跃',
    modules: '模块',
    moduleTitle: {
      memory: '记忆', egonetics: '自我控制论', chronicle: '编年史',
      theory: '理论', tasks: '任务', blog: '博客', agents: '智能体',
    },
    moduleDesc: {
      memory: '会话记录、标注面板、发布到编年史',
      egonetics: '宪法主体性档案，只读内容树，块级批注',
      chronicle: '哈希链时间轴、里程碑、集合',
      theory: '价值判断框架，版本化，可锁定',
      tasks: '看板、富文本块、自定义属性',
      blog: '层级页面树，块编辑',
      agents: 'SVG 节点图，关系网络',
    },
    laws: {
      title: '生命三大定律',
      lawLabel: '定律',
      i: { title: '个体完备性', desc: '个体是生命社会的最小完整单位，理论上能够完成一切该生命形态的发展创造活动' },
      ii: { title: '存在利益最大化', desc: '所有个体与集体无一例外会做出认知和生存环境内的利益最大化的选择' },
      iii: { title: '认知条件转化', desc: '真与假、美与丑、善与恶、强与弱永远相对存在且动态转化' },
    },
  },

  login: {
    tagline: '个人主体性演化系统',
    loginTitle: '登录', registerTitle: '注册', verifyTitle: '邮箱验证',
    accountLabel: '邮箱 / 用户名', accountPlaceholder: '输入邮箱或用户名',
    passwordLabel: '密码', passwordPlaceholder: '输入密码',
    loginButton: '登录', noAccount: '还没有账号？', registerLink: '注册',
    hasAccount: '已有账号？', loginLink: '登录',
    roleLabel: '账号类型', guestRole: '游客', agentRole: 'Agent',
    guestDesc: '游客可浏览公开内容，无法修改数据',
    agentDesc: 'Agent 拥有任务和代理资源的操作权限',
    emailLabel: '邮箱', emailPlaceholder: 'your@email.com',
    emailAvailable: '邮箱可用', emailTaken: '邮箱已被注册',
    usernameLabel: '用户名', usernamePlaceholder: '3-20 位字母/数字/_ -',
    usernameAvailable: '用户名可用', usernameTaken: '用户名已被占用',
    confirmPasswordLabel: '确认密码', confirmPasswordPlaceholder: '再次输入密码',
    passwordHintPlaceholder: '至少 8 位，含大小写和数字',
    guestSubmit: '注册并发送验证码', agentSubmit: '注册',
    verifyCodeSent: '验证码已发送至', verifyValidity: '10 分钟内有效',
    codeLabel: '验证码', codePlaceholder: '6 位数字验证码',
    verifyButton: '验证', backToEdit: '返回修改邮箱',
    resend: '重新发送', resendCountdown: '重新发送',
    pwStrength: { weak: '弱', medium: '中', strong: '强' },
    pwCriteria: { minLength: '最少 8 位', uppercase: '大写字母', lowercase: '小写字母', number: '数字' },
    errors: {
      requireAccount: '请输入账号', requirePassword: '请输入密码', loginFailed: '登录失败',
      passwordInvalid: '密码不符合要求', passwordMismatch: '两次密码不一致',
      requireEmail: '请输入邮箱', requireUsername: '请输入用户名',
      registerFailed: '注册失败', invalidCode: '请输入 6 位验证码',
      verifyFailed: '验证失败', sendFailed: '发送失败',
    },
  },

  prvse: {
    dimensions: { constitution: '宪法', resources: '资源', goals: '目标' },
    layers: {
      concept: 'L3 世界', conceptDesc: 'L3 世界层 — 目标 · 宪法 · 资源',
      engineering: 'L2 控制', engineeringDesc: 'L2 控制层 — 协议 · PRVSE · 引擎 · 队列 · 冲突',
      execution: 'L1 粒度', executionDesc: 'L1 粒度层 — 任务 · 实验 · 测试 · 历史',
    },
    hud: {
      contradiction: '∞ → 有限 · 失控 → 可控',
      convergence: '高层→低层 = 收敛',
      clickToEnter: 'click 节点进入',
      escToGoBack: 'Esc 返回上层',
      clickForDetails: 'click 查看详情',
    },
    l3Cards: {
      openTask: '打开',
      pendingDecision: '待裁决',
    },
    l3ai: {
      placeholder: '描述你的资源、MVP、用户反馈 — AI 直接写入世界...',
      thinking: 'T2 正在重塑世界...',
      error: 'AI 暂时不可用',
      emptyState: '暂无数据 — 通过 T2 输入构建世界',
    },
  },

  focusPanel: {
    depth: '层级',
    children: '子节点',
    openTask: '打开任务',
    taskLabel: '任务',
    executionEngine: '执行引擎',
    executionStatus: 'T0→T1→T2 自动升级链运行中',
    kernelContract: 'Kernel 合约',
    contractDesc: '在每次 tick 中评估条件，满足时触发 effect',
    humanDecision: '等待人裁决',
    humanInterventionDesc: 'AI 各层级均无法解决，需要人介入',
    messageQueue: '消息队列',
    mqDesc: '累积 ≥3 条触发 Kernel 感知器自动 dispatch',
    cyberneticsComponent: '控制论组件',
    cyberneticsDesc: {
      'mid-kernel': 'PRVSE 物理引擎。tick=周期性对账，mutate=即时状态变更。所有合约在此评估。',
      'mid-const-gen': '人-AI协作生成宪法IR→Kernel校验→AB测试。宪法条目可CRUD。',
      'mid-evaluator': '审计/测评器。检查宪法违规、AI升级链裁决、24h审计循环。',
      'mid-intelligence': '智能资源。T0本地SEAI→T1 MiniMax云端→T2 Claude专家级。三级分层调度。',
      'mid-resource-console': '资源控制台。管理T0/T1/T2智能资源分配和使用配额。',
      'mid-compute': '计算存储资源。CPU/GPU/存储空间的监控和分配。',
      'mid-sensor': '感知器。MQ消息流入→累积≥3→Kernel自动dispatch。',
      'mid-controller': '控制器。T0→T1→T2→Human 升级链执行引擎。',
      'mid-task-panel': 'Task面板。所有操作级任务的可视化和调度入口。',
      'mid-objective': '客观目标。可度量的任务和交付物，无限→有限收敛。',
      'mid-subjective': '主观目标。自我进化、身份认同、意义建构，失控→可控。',
      'mid-strategic': '战略级目标。长期全局最优化方向（建设中）。',
      'mid-tactical': '战术级目标。中期里程碑和阶段目标（建设中）。',
    },
    principleTitle: '宪法原则',
    principleDesc: '不可违反。违反需通过宪法生成流程修订。',
    dimensionDesc: {
      'dim-constitution': '一切 AI + 控制论系统遵循宪法。24h 审计，违反即告警。',
      'dim-resources': '掌握智能资源（T0本地→T1云端→T2专家）、MQ通信、系统资源。',
      'dim-goals': '设定长期和全局最优化目标。战略→战术→操作三级。',
    },
    resourceTier: '资源层级',
  },

  kernel: {
    offline: 'offline',
  },

  memory: {
    title: '记忆', subtitle: '按日期存储的交互历史。每一天都是独特的记忆卡片。',
    addMemory: '添加记忆', searchMemory: '搜索记忆', calendar: '记忆日历',
    todayMemory: '今日记忆', thisMonthMemory: '本月记忆', recentMemory: '近期记忆',
    sortByTime: '按时间排序', noMemory: '暂无记忆', selectDateToStart: '选择日期开始记录你的记忆。',
  },

  theory: {
    title: '生变论 (Bornfly Theory)',
    subtitle: '核心价值判断框架。线性不可更改的hash链，每次修改都有完整记录。',
    chainLength: '链长度',
    warningTitle: '警告：生变论修改规则',
    warningDesc: '每次修改都会创建新版本，旧版本永久保留。请谨慎提交更改。',
    inputPlaceholder: '输入新的理论原则或修改说明...',
    thisEditWillCreate: '本次修改将创建版本',
    submitToChain: '提交到链上',
    versionHistory: '版本历史',
    allVersionsDesc: '所有版本按时间倒序排列',
    version: '版本', blockNumber: '区块',
    currentHash: '当前Hash', previousHash: '上一Hash', chainVerified: '✓ 链上验证通过',
    archiveFailed: '入库失败，请重试',
    versionPlaceholder: 'e.g. v1.0, v2.0-alpha',
    summaryPlaceholder: '这个版本记录了什么…',
  },

  chronicle: {
    title: '生变录 (Chronicle)',
    subtitle: '自我迭代的时间线证据。记录每个重要的决策和演化节点。',
    timelineTitle: '时间线', addTimelineEntry: '添加时间线条目',
    entryContent: '条目内容', addEntry: '添加条目', verifying: '验证中...',
    entryTypes: { memory: '记忆', decision: '决策', evolution: '演化', principle: '原则', task: '任务' },
  },

  egonetics: {
    title: '自我控制论 (Egonetics)',
    subtitle: '不可僭越的用户原则。定义系统的行为边界和核心价值观。',
    principlesTitle: '原则列表', addPrinciple: '添加原则', principleContent: '原则内容',
    priority: '优先级', status: '状态', active: '活跃', archived: '已归档',
    abstractNetwork: '抽象认知网络',
    abstractSubtitle: '语义图 · 执行图 — 连接 Task / 页面 / 理论 / Agent 过程',
    semanticTitle: '语义图', semanticSubtitle: '用户构建 · 自由连接页面与实体',
    executionTitle: '执行图', executionSubtitle: 'Agent 自动生成 · 任务执行过程图',
    noSemanticCanvas: '还没有语义画布',
    noExecutionCanvas: '还没有执行图',
    executionHint: '在 /agents 启动 Task 生命周期后，Agent 会自动创建执行图',
    newCanvas: '新建语义画布',
    canvasNameLabel: '画布名称 *',
    canvasNamePlaceholder: '如：主体性认知框架 / 工程实践图谱...',
    descriptionLabel: '描述（可选）',
    descriptionPlaceholder: '简短描述这个画布的用途...',
    nodeCount: '个节点',
    agentExecution: 'Agent 执行',
    confirmDeleteCanvas: '确定删除画布「{title}」？此操作不可撤销。',
  },

  tasks: {
    title: '任务 (Tasks)',
    subtitle: 'Notion 风格的任务卡片。自由书写，灵活配置属性。',
    newTask: '新任务', taskTitle: '任务名称', taskDescription: '任务描述',
    taskPriority: '优先级', low: '低', medium: '中', high: '高', urgent: '紧急',
    taskStatus: '状态', pending: '待处理', inProgress: '进行中', completed: '已完成',
    addTask: '添加任务', noTasks: '暂无任务', createFirstTask: '创建第一个任务',
  },

  executionConsole: {
    running: '执行中', escalated: '待裁决', completed: '已完成', failed: '已失败',
  },

  proposalInbox: {
    types: { classification: '三问分类', tagTree: '标签树', task: '任务', component: '组件' },
    status: { pending: '待裁决', approved: '已通过', rejected: '已拒绝', autoApplied: '自动应用' },
    conflict: '⚠ 冲突',
    proposalHeader: 'SEAI 提议写入',
    conflictHeader: '当前已有状态（冲突）',
    approve: '通过', reject: '拒绝',
  },

  protocol: {
    groups: { resourcePermission: '资源权限通信层', graduatedControl: '分级约束控制层', practice: '实践层' },
    categories: {
      permissionLayer: '权限层级', communication: '通信机制', resourceTier: '智能资源分级',
      pMode: 'P 模式', rRelation: 'R 关系', vValue: 'V 价值', sState: 'S 状态',
      interaction: '交互操作', uiComponents: 'UI 组件库', kernelComponents: 'Kernel 组件',
      lifecycle: '生命周期态', graphNodes: 'Graph 节点',
    },
    unanchored: '未锚定',
  },

  constitution: {
    layers: {
      meta: '元控制层', control: '控制结构层', subjectivity: '主体性叙事层',
      practice: '实践层', memory: '过程记忆层', adapt: '自适应迭代层',
    },
    levels: { l1: 'L1 硬约束', l2: 'L2 规则约束', l3: 'L3 语义判断' },
    defaults: {
      metaControl: '元控制层', controlOwnership: '控制权归属原则',
      irreversibleOps: '不可逆操作必须人工确认', constitutionImmutable: '宪法不可自我修改',
      controlStructure: '控制结构层', capabilityDict: '能力映射字典',
      budgetGuard: 'LLM API 预算守护', privateDataLocal: '隐私数据本地处理',
    },
  },

  recycleBin: {
    title: '回收站',
    subtitle: '历史页面归档 — 路由仍有效，已从主导航移除',
    pages: {
      egonetics: { label: '主体图谱', desc: 'Egonetics 主体节点图，早期设计产物' },
      agents: { label: 'Agents', desc: 'SVG 节点图 Agent 管理，已被新架构替代' },
      cybernetics: { label: '控制论内核', desc: 'CyberneticsSystemView，结构已迁移至 /protocol' },
      controller: { label: '控制器', desc: 'ControllerView，早期控制器原型' },
      queue: { label: '执行队列', desc: 'QueueView，任务队列早期实现' },
    },
  },

  cyberneticsTree: {
    title: '控制论骨架树',
    emptyTree: '树为空',
    clickToView: '点击左侧节点查看详情',
    crudHint: '每个节点支持增删改查 + 内容编写',
    addRoot: '新增根节点',
    description: '描述',
    descriptionPlaceholder: '节点描述...',
  },
}

// ── English ───────────────────────────────────────────────────────────────────

const en: Translation = {
  common: {
    save: 'Save', delete: 'Delete', edit: 'Edit', confirm: 'Confirm',
    loading: 'Loading...', success: 'Success', error: 'Error', warning: 'Warning', info: 'Info',
    cancel: 'Cancel', close: 'Close', back: 'Back', open: 'Open', details: 'Details',
    execute: 'Execute', submit: 'Submit', submitting: 'Submitting...', search: 'Search',
    noData: 'No data', collapse: 'Collapse', json: 'JSON',
  },

  sidebar: {
    home: 'Home', memory: 'Memory', theory: 'Bornfly Theory', chronicle: 'Chronicle',
    tasks: 'Tasks', blog: 'Blog', egonetics: 'Egonetics', tagTree: 'Tag Tree',
    protocol: 'HM Protocol', protoBuilder: 'Proto Builder', prvseWorld: 'PRVSE World', freeCode: 'Free Code',
    lab: 'Lab', mq: 'MQ Stream', resourcesClaude: 'AI Usage', resourcesGemini: 'Gemini', recycle: 'Archive', collapse: 'Collapse', logout: 'Logout', settings: 'Settings',
  },

  home: {
    tagline: 'Ego × Cybernetics — Life Subjectivity System',
    heroDesc: 'Personal AI co-evolution system. Through tamper-evident chronicle recording decisions and growth, using constitutional subjectivity to constrain agent behavior, converging memory, tasks and theory onto one timeline.',
    chronicleEntries: 'Chronicle Entries',
    currentVersion: 'Current Version',
    systemStatus: 'System Status',
    active: 'Active',
    modules: 'Modules',
    moduleTitle: {
      memory: 'Memory', egonetics: 'Egonetics', chronicle: 'Chronicle',
      theory: 'Theory', tasks: 'Tasks', blog: 'Blog', agents: 'Agents',
    },
    moduleDesc: {
      memory: 'Session records, annotation panel, publish to chronicle',
      egonetics: 'Constitutional subjectivity archive, read-only content tree, block annotations',
      chronicle: 'Hash-chain timeline, milestones, collections',
      theory: 'Value judgment framework, versioned, lockable',
      tasks: 'Kanban, rich text blocks, custom properties',
      blog: 'Hierarchical page tree, block editing',
      agents: 'SVG node graph, relation network',
    },
    laws: {
      title: 'Three Laws of Life',
      lawLabel: 'Law',
      i: { title: 'Individual Completeness', desc: 'An individual is the smallest complete unit of a living society, theoretically capable of all developmental and creative activities of that life form' },
      ii: { title: 'Existential Interest Maximization', desc: 'All individuals and collectives, without exception, make choices that maximize interests within their cognition and survival environment' },
      iii: { title: 'Cognitive Conditional Transformation', desc: 'Truth and falsehood, beauty and ugliness, good and evil, strength and weakness always coexist relatively and transform dynamically' },
    },
  },

  login: {
    tagline: 'Personal Subjectivity Evolution System',
    loginTitle: 'Login', registerTitle: 'Register', verifyTitle: 'Email Verification',
    accountLabel: 'Email / Username', accountPlaceholder: 'Enter email or username',
    passwordLabel: 'Password', passwordPlaceholder: 'Enter password',
    loginButton: 'Login', noAccount: "Don't have an account?", registerLink: 'Register',
    hasAccount: 'Already have an account?', loginLink: 'Login',
    roleLabel: 'Account Type', guestRole: 'Guest', agentRole: 'Agent',
    guestDesc: 'Guests can browse public content, cannot modify data',
    agentDesc: 'Agents have task and agent resource operation permissions',
    emailLabel: 'Email', emailPlaceholder: 'your@email.com',
    emailAvailable: 'Email available', emailTaken: 'Email already registered',
    usernameLabel: 'Username', usernamePlaceholder: '3-20 letters/numbers/_ -',
    usernameAvailable: 'Username available', usernameTaken: 'Username taken',
    confirmPasswordLabel: 'Confirm Password', confirmPasswordPlaceholder: 'Re-enter password',
    passwordHintPlaceholder: 'Min 8 chars, upper+lower+number',
    guestSubmit: 'Register & Send Code', agentSubmit: 'Register',
    verifyCodeSent: 'Verification code sent to', verifyValidity: 'Valid for 10 minutes',
    codeLabel: 'Verification Code', codePlaceholder: '6-digit code',
    verifyButton: 'Verify', backToEdit: 'Back to edit email',
    resend: 'Resend', resendCountdown: 'Resend',
    pwStrength: { weak: 'Weak', medium: 'Medium', strong: 'Strong' },
    pwCriteria: { minLength: 'Min 8 chars', uppercase: 'Uppercase', lowercase: 'Lowercase', number: 'Number' },
    errors: {
      requireAccount: 'Account required', requirePassword: 'Password required', loginFailed: 'Login failed',
      passwordInvalid: 'Password does not meet requirements', passwordMismatch: 'Passwords do not match',
      requireEmail: 'Email required', requireUsername: 'Username required',
      registerFailed: 'Registration failed', invalidCode: 'Enter 6-digit code',
      verifyFailed: 'Verification failed', sendFailed: 'Send failed',
    },
  },

  prvse: {
    dimensions: { constitution: 'Constitution', resources: 'Resources', goals: 'Goals' },
    layers: {
      concept: 'L3 World', conceptDesc: 'L3 World — Goals · Constitution · Resources',
      engineering: 'L2 Control', engineeringDesc: 'L2 Control — Protocol · PRVSE · Engine · Queue · Conflict',
      execution: 'L1 Granular', executionDesc: 'L1 Granular — Tasks · Experiments · Tests · History',
    },
    hud: {
      contradiction: '∞ → Finite · Uncontrolled → Controlled',
      convergence: 'Higher → Lower = Convergence',
      clickToEnter: 'Click node to enter',
      escToGoBack: 'Esc to go back',
      clickForDetails: 'Click for details',
    },
    l3Cards: {
      openTask: 'Open',
      pendingDecision: 'Pending',
    },
    l3ai: {
      placeholder: 'Describe resources, MVP, feedback — AI writes to world...',
      thinking: 'T2 reshaping the world...',
      error: 'AI temporarily unavailable',
      emptyState: 'No data — build the world via T2 input',
    },
  },

  focusPanel: {
    depth: 'Depth',
    children: 'Children',
    openTask: 'Open Task',
    taskLabel: 'Task',
    executionEngine: 'Execution Engine',
    executionStatus: 'T0→T1→T2 auto-escalation chain running',
    kernelContract: 'Kernel Contract',
    contractDesc: 'Evaluates conditions each tick, triggers effect when satisfied',
    humanDecision: 'Awaiting Human Decision',
    humanInterventionDesc: 'All AI tiers unable to resolve, human intervention required',
    messageQueue: 'Message Queue',
    mqDesc: 'Accumulate ≥3 messages triggers Kernel sensor auto-dispatch',
    cyberneticsComponent: 'Cybernetics Component',
    cyberneticsDesc: {
      'mid-kernel': 'PRVSE physics engine. tick=periodic reconciliation, mutate=immediate state change. All contracts evaluated here.',
      'mid-const-gen': 'Human-AI collaborative constitution generation → Kernel validation → AB testing. Constitution entries support CRUD.',
      'mid-evaluator': 'Auditor/Evaluator. Checks constitution violations, AI escalation chain decisions, 24h audit cycle.',
      'mid-intelligence': 'Intelligence resources. T0 local SEAI → T1 MiniMax cloud → T2 Claude expert. Three-tier dispatch.',
      'mid-resource-console': 'Resource console. Manages T0/T1/T2 intelligence resource allocation and usage quotas.',
      'mid-compute': 'Compute/storage resources. CPU/GPU/storage monitoring and allocation.',
      'mid-sensor': 'Sensor. MQ messages flow in → accumulate ≥3 → Kernel auto-dispatch.',
      'mid-controller': 'Controller. T0→T1→T2→Human escalation chain execution engine.',
      'mid-task-panel': 'Task panel. Visualization and scheduling entry point for all operational tasks.',
      'mid-objective': 'Objective goals. Measurable tasks and deliverables, infinite→finite convergence.',
      'mid-subjective': 'Subjective goals. Self-evolution, identity, meaning construction, chaos→control.',
      'mid-strategic': 'Strategic goals. Long-term global optimization direction (under construction).',
      'mid-tactical': 'Tactical goals. Mid-term milestones and phase objectives (under construction).',
    },
    principleTitle: 'Constitutional Principle',
    principleDesc: 'Must not be violated. Violations require constitutional generation process revision.',
    dimensionDesc: {
      'dim-constitution': 'All AI + cybernetics systems follow the constitution. 24h audit, violations trigger alerts.',
      'dim-resources': 'Controls intelligence resources (T0 local → T1 cloud → T2 expert), MQ communication, system resources.',
      'dim-goals': 'Sets long-term and globally optimal goals. Strategic → Tactical → Operational, three levels.',
    },
    resourceTier: 'Resource Tier',
  },

  kernel: {
    offline: 'offline',
  },

  memory: {
    title: 'Memory', subtitle: 'Date-based interaction history. Each day is a unique memory card.',
    addMemory: 'Add Memory', searchMemory: 'Search Memory', calendar: 'Memory Calendar',
    todayMemory: "Today's Memory", thisMonthMemory: "This Month's Memory", recentMemory: 'Recent Memories',
    sortByTime: 'Sort by time', noMemory: 'No memory yet', selectDateToStart: 'Select a date to start recording your memories.',
  },

  theory: {
    title: 'Bornfly Theory',
    subtitle: 'Core value judgment framework. Linear immutable hash chain with complete modification records.',
    chainLength: 'Chain Length',
    warningTitle: 'Warning: Theory Modification Rules',
    warningDesc: 'Each modification creates a new version, old versions are permanently preserved. Submit changes carefully.',
    inputPlaceholder: 'Enter new theory principle or modification description...',
    thisEditWillCreate: 'This edit will create version',
    submitToChain: 'Submit to Chain',
    versionHistory: 'Version History',
    allVersionsDesc: 'All versions sorted in reverse chronological order',
    version: 'Version', blockNumber: 'Block #',
    currentHash: 'Current Hash', previousHash: 'Previous Hash', chainVerified: '✓ Chain verified',
    archiveFailed: 'Archive failed, please retry',
    versionPlaceholder: 'e.g. v1.0, v2.0-alpha',
    summaryPlaceholder: 'What does this version record...',
  },

  chronicle: {
    title: 'Chronicle',
    subtitle: 'Timeline evidence of self-iteration. Records each important decision and evolution node.',
    timelineTitle: 'Timeline', addTimelineEntry: 'Add Timeline Entry',
    entryContent: 'Entry Content', addEntry: 'Add Entry', verifying: 'Verifying...',
    entryTypes: { memory: 'Memory', decision: 'Decision', evolution: 'Evolution', principle: 'Principle', task: 'Task' },
  },

  egonetics: {
    title: 'Egonetics',
    subtitle: 'Non-transgressible user principles. Defines system behavior boundaries and core values.',
    principlesTitle: 'Principles List', addPrinciple: 'Add Principle', principleContent: 'Principle Content',
    priority: 'Priority', status: 'Status', active: 'Active', archived: 'Archived',
    abstractNetwork: 'Abstract Cognitive Network',
    abstractSubtitle: 'Semantic Graph · Execution Graph — Connect Task / Page / Theory / Agent processes',
    semanticTitle: 'Semantic Graph', semanticSubtitle: 'User-built · Freely connect pages and entities',
    executionTitle: 'Execution Graph', executionSubtitle: 'Auto-generated by Agent · Task execution process graph',
    noSemanticCanvas: 'No semantic canvas yet',
    noExecutionCanvas: 'No execution graph yet',
    executionHint: 'Start a Task lifecycle in /agents, and the Agent will auto-create an execution graph',
    newCanvas: 'New Semantic Canvas',
    canvasNameLabel: 'Canvas Name *',
    canvasNamePlaceholder: 'e.g. Subjectivity Framework / Engineering Practice Graph...',
    descriptionLabel: 'Description (optional)',
    descriptionPlaceholder: 'Brief description of this canvas purpose...',
    nodeCount: 'nodes',
    agentExecution: 'Agent Execution',
    confirmDeleteCanvas: 'Delete canvas "{title}"? This action cannot be undone.',
  },

  tasks: {
    title: 'Tasks',
    subtitle: 'Notion-style task cards. Free writing, flexible properties.',
    newTask: 'New Task', taskTitle: 'Task Name', taskDescription: 'Task Description',
    taskPriority: 'Priority', low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent',
    taskStatus: 'Status', pending: 'Pending', inProgress: 'In Progress', completed: 'Completed',
    addTask: 'Add Task', noTasks: 'No tasks yet', createFirstTask: 'Create first task',
  },

  executionConsole: {
    running: 'Running', escalated: 'Escalated', completed: 'Completed', failed: 'Failed',
  },

  proposalInbox: {
    types: { classification: 'Classification', tagTree: 'Tag Tree', task: 'Task', component: 'Component' },
    status: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', autoApplied: 'Auto-applied' },
    conflict: '⚠ Conflict',
    proposalHeader: 'SEAI Proposed Write',
    conflictHeader: 'Current State (Conflict)',
    approve: 'Approve', reject: 'Reject',
  },

  protocol: {
    groups: { resourcePermission: 'Resource Permission & Communication', graduatedControl: 'Graduated Constraint Control', practice: 'Practice Layer' },
    categories: {
      permissionLayer: 'Permission Layer', communication: 'Communication', resourceTier: 'Intelligence Resource Tier',
      pMode: 'P Mode', rRelation: 'R Relation', vValue: 'V Value', sState: 'S State',
      interaction: 'Interaction', uiComponents: 'UI Components', kernelComponents: 'Kernel Components',
      lifecycle: 'Lifecycle State', graphNodes: 'Graph Nodes',
    },
    unanchored: 'Unanchored',
  },

  constitution: {
    layers: {
      meta: 'Meta-Control', control: 'Control Structure', subjectivity: 'Subjectivity Narrative',
      practice: 'Practice', memory: 'Process Memory', adapt: 'Adaptive Iteration',
    },
    levels: { l1: 'L1 Hard Constraint', l2: 'L2 Rule Constraint', l3: 'L3 Semantic Judgment' },
    defaults: {
      metaControl: 'Meta-Control Layer', controlOwnership: 'Control Ownership Principle',
      irreversibleOps: 'Irreversible ops require human confirmation', constitutionImmutable: 'Constitution cannot self-modify',
      controlStructure: 'Control Structure Layer', capabilityDict: 'Capability Mapping Dictionary',
      budgetGuard: 'LLM API Budget Guardian', privateDataLocal: 'Private data processed locally',
    },
  },

  recycleBin: {
    title: 'Archive',
    subtitle: 'Historical page archive — routes still work, removed from main navigation',
    pages: {
      egonetics: { label: 'Subject Graph', desc: 'Egonetics subject node graph, early design artifact' },
      agents: { label: 'Agents', desc: 'SVG node graph Agent management, replaced by new architecture' },
      cybernetics: { label: 'Cybernetics Core', desc: 'CyberneticsSystemView, structure migrated to /protocol' },
      controller: { label: 'Controller', desc: 'ControllerView, early controller prototype' },
      queue: { label: 'Execution Queue', desc: 'QueueView, early task queue implementation' },
    },
  },

  cyberneticsTree: {
    title: 'Cybernetics Skeleton Tree',
    emptyTree: 'Tree is empty',
    clickToView: 'Click a node on the left to view details',
    crudHint: 'Each node supports CRUD + content editing',
    addRoot: 'Add Root Node',
    description: 'Description',
    descriptionPlaceholder: 'Node description...',
  },
}

// ── Exported registry ─────────────────────────────────────────────────────────

export const translations: Record<Language, Translation> = { zh, en }

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTranslation() {
  const { uiState } = useChronicleStore()
  const language = (uiState.language || 'zh') as Language

  return {
    t: translations[language],
    language,
    setLanguage: (lang: Language) => {
      const { setUIState } = useChronicleStore.getState()
      setUIState({ language: lang })
    },
  }
}
