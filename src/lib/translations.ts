// 全局翻译配置
export type Language = 'zh' | 'en'

export interface Translation {
  // Sidebar
  memory: string
  chronicle: string
  tasks: string
  agents: string
  theory: string
  principles: string
  history: string
  network: string
  profile: string
  settings: string
  entries: string
  chainStatus: string
  verifyChain: string
  collapse: string
  expand: string
  lifeCore: string
  lifeCoreGroup: string
  memoryDesc: string
  theoryDesc: string
  chronicleDesc: string
  egoneticsDesc: string

  // Memory View
  memoryTitle: string
  memorySubtitle: string
  addMemory: string
  searchMemory: string
  memoryCalendar: string
  todayMemory: string
  thisMonthMemory: string
  recentMemory: string
  sortByTime: string
  noMemory: string
  selectDateToStart: string

  // Theory View
  theoryTitle: string
  theorySubtitle: string
  chainLength: string
  warning: string
  warningDesc: string
  inputPlaceholder: string
  thisEditWillCreate: string
  cancel: string
  submitToChain: string
  submitting: string
  versionHistory: string
  allVersionsDesc: string
  version: string
  blockNumber: string
  currentHash: string
  previousHash: string
  chainVerified: string

  // Chronicle View
  chronicleTitle: string
  chronicleSubtitle: string
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

  // Egonetics View
  egoneticsTitle: string
  egoneticsSubtitle: string
  principlesTitle: string
  addPrinciple: string
  principleContent: string
  priority: string
  status: string
  active: string
  archived: string

  // Tasks View
  tasksTitle: string
  tasksSubtitle: string
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

  // Common
  save: string
  delete: string
  edit: string
  confirm: string
  loading: string
  success: string
  error: string
  warningAlert: string
  info: string
}

export const translations: Record<Language, Translation> = {
  zh: {
    // Sidebar
    memory: '记忆',
    chronicle: '生变录',
    tasks: '任务',
    agents: '代理',
    theory: '生变论',
    principles: '自我控制论',
    history: '演进',
    network: '网络',
    profile: '生命主体性',
    settings: '设置',
    entries: '条目',
    chainStatus: '链状态',
    verifyChain: '验证链',
    collapse: '← 折叠',
    expand: '→',
    lifeCore: '生命主体性 v0.1',
    lifeCoreGroup: '生命主体性 (Life Core)',
    memoryDesc: '与用户的交互历史',
    theoryDesc: '核心价值判断框架',
    chronicleDesc: '自我迭代的时间线证据',
    egoneticsDesc: '不可僭越的用户原则',

    // Memory View
    memoryTitle: '记忆',
    memorySubtitle: '按日期存储的交互历史。每一天都是独特的记忆卡片。',
    addMemory: '添加记忆',
    searchMemory: '搜索记忆',
    memoryCalendar: '记忆日历',
    todayMemory: '今日记忆',
    thisMonthMemory: '本月记忆',
    recentMemory: '近期记忆',
    sortByTime: '按时间排序',
    noMemory: '暂无记忆',
    selectDateToStart: '选择日期开始记录你的记忆。',

    // Theory View
    theoryTitle: '生变论 (Bornfly Theory)',
    theorySubtitle: '核心价值判断框架。线性不可更改的hash链，每次修改都有完整记录。',
    chainLength: '链长度',
    warning: '警告：生变论修改规则',
    warningDesc: '每次修改都会创建新版本，旧版本永久保留。请谨慎提交更改。',
    inputPlaceholder: '输入新的理论原则或修改说明...',
    thisEditWillCreate: '本次修改将创建版本',
    cancel: '取消',
    submitToChain: '提交到链上',
    submitting: '提交中...',
    versionHistory: '版本历史',
    allVersionsDesc: '所有版本按时间倒序排列',
    version: '版本',
    blockNumber: '区块',
    currentHash: '当前Hash',
    previousHash: '上一Hash',
    chainVerified: '✓ 链上验证通过',

    // Chronicle View
    chronicleTitle: '生变录 (Chronicle)',
    chronicleSubtitle: '自我迭代的时间线证据。记录每个重要的决策和演化节点。',
    timelineTitle: '时间线',
    addTimelineEntry: '添加时间线条目',
    entryContent: '条目内容',
    addEntry: '添加条目',
    verifying: '验证中...',
    entryTypes: {
      memory: '记忆',
      decision: '决策',
      evolution: '演化',
      principle: '原则',
      task: '任务',
    },

    // Egonetics View
    egoneticsTitle: '自我控制论 (Egonetics)',
    egoneticsSubtitle: '不可僭越的用户原则。定义系统的行为边界和核心价值观。',
    principlesTitle: '原则列表',
    addPrinciple: '添加原则',
    principleContent: '原则内容',
    priority: '优先级',
    status: '状态',
    active: '活跃',
    archived: '已归档',

    // Tasks View
    tasksTitle: '任务 (Tasks)',
    tasksSubtitle: 'Notion 风格的任务卡片。自由书写，灵活配置属性。',
    newTask: '新任务',
    taskTitle: '任务名称',
    taskDescription: '任务描述',
    taskPriority: '优先级',
    low: '低',
    medium: '中',
    high: '高',
    urgent: '紧急',
    taskStatus: '状态',
    pending: '待处理',
    inProgress: '进行中',
    completed: '已完成',
    addTask: '添加任务',
    noTasks: '暂无任务',
    createFirstTask: '创建第一个任务',

    // Common
    save: '保存',
    delete: '删除',
    edit: '编辑',
    confirm: '确认',
    loading: '加载中...',
    success: '成功',
    error: '错误',
    warningAlert: '警告',
    info: '信息',
  },

  en: {
    // Sidebar
    memory: 'Memory',
    chronicle: 'Chronicle',
    tasks: 'Tasks',
    agents: 'Agents',
    theory: 'Bornfly Theory',
    principles: 'Egonetics',
    history: 'Evolution',
    network: 'Network',
    profile: 'Life Core',
    settings: 'Settings',
    entries: 'Entries',
    chainStatus: 'Chain Status',
    verifyChain: 'Verify Chain',
    collapse: '← Collapse',
    expand: '→',
    lifeCore: 'Life Core v0.1',
    lifeCoreGroup: 'Life Core',
    memoryDesc: 'Interaction history with user',
    theoryDesc: 'Core value judgment framework',
    chronicleDesc: 'Timeline evidence of self-iteration',
    egoneticsDesc: 'Non-transgressible user principles',

    // Memory View
    memoryTitle: 'Memory',
    memorySubtitle: 'Date-based interaction history. Each day is a unique memory card.',
    addMemory: 'Add Memory',
    searchMemory: 'Search Memory',
    memoryCalendar: 'Memory Calendar',
    todayMemory: "Today's Memory",
    thisMonthMemory: "This Month's Memory",
    recentMemory: 'Recent Memories',
    sortByTime: 'Sort by time',
    noMemory: 'No memory yet',
    selectDateToStart: 'Select a date to start recording your memories.',

    // Theory View
    theoryTitle: 'Bornfly Theory',
    theorySubtitle:
      'Core value judgment framework. Linear immutable hash chain with complete modification records.',
    chainLength: 'Chain Length',
    warning: 'Warning: Theory Modification Rules',
    warningDesc:
      'Each modification creates a new version, old versions are permanently preserved. Submit changes carefully.',
    inputPlaceholder: 'Enter new theory principle or modification description...',
    thisEditWillCreate: 'This edit will create version',
    cancel: 'Cancel',
    submitToChain: 'Submit to Chain',
    submitting: 'Submitting...',
    versionHistory: 'Version History',
    allVersionsDesc: 'All versions sorted in reverse chronological order',
    version: 'Version',
    blockNumber: 'Block #',
    currentHash: 'Current Hash',
    previousHash: 'Previous Hash',
    chainVerified: '✓ Chain verified',

    // Chronicle View
    chronicleTitle: 'Chronicle',
    chronicleSubtitle:
      'Timeline evidence of self-iteration. Records each important decision and evolution node.',
    timelineTitle: 'Timeline',
    addTimelineEntry: 'Add Timeline Entry',
    entryContent: 'Entry Content',
    addEntry: 'Add Entry',
    verifying: 'Verifying...',
    entryTypes: {
      memory: 'Memory',
      decision: 'Decision',
      evolution: 'Evolution',
      principle: 'Principle',
      task: 'Task',
    },

    // Egonetics View
    egoneticsTitle: 'Egonetics',
    egoneticsSubtitle:
      'Non-transgressible user principles. Defines system behavior boundaries and core values.',
    principlesTitle: 'Principles List',
    addPrinciple: 'Add Principle',
    principleContent: 'Principle Content',
    priority: 'Priority',
    status: 'Status',
    active: 'Active',
    archived: 'Archived',

    // Tasks View
    tasksTitle: 'Tasks',
    tasksSubtitle: 'Notion-style task cards. Free writing, flexible properties.',
    newTask: 'New Task',
    taskTitle: 'Task Name',
    taskDescription: 'Task Description',
    taskPriority: 'Priority',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent',
    taskStatus: 'Status',
    pending: 'Pending',
    inProgress: 'In Progress',
    completed: 'Completed',
    addTask: 'Add Task',
    noTasks: 'No tasks yet',
    createFirstTask: 'Create first task',

    // Common
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    confirm: 'Confirm',
    loading: 'Loading...',
    success: 'Success',
    error: 'Error',
    warningAlert: 'Warning',
    info: 'Info',
  },
}

// Hook to use translations
export function useTranslation() {
  const { uiState } = useChronicleStore()
  const language = uiState.language || 'zh'

  return {
    t: translations[language as Language],
    language,
    setLanguage: (lang: Language) => {
      const { setUIState } = useChronicleStore.getState()
      setUIState({ language: lang })
    },
  }
}

// Import store for useTranslation
import { useChronicleStore } from '@/stores/useChronicleStore'
