明确了需求：
Page 嵌套的核心架构思路
不管选哪种形式，本质上都是同一套数据模型：
数据结构
PageTree（页面树）
├── page: { id, parentId, title, icon, blocks: Block[], position }
│   ├── page（子页面）
│   │   └── page（孙页面）
│   └── page
└── page
页面树本身就是一棵树，和块的嵌套完全同构——parentId: null 是根节点。
Sub-page 块需要：

新增 subpage BlockType
点击块进入子页面（本质是切换激活 pageId）
面包屑导航追踪路径

两者的状态可以合并：
tstype AppState = {
  pages: Map<string, Page>   // 全局页面树
  activePageId: string        // 当前查看的页面
  expandedIds: Set<string>    // 侧边栏展开状态
}

块内嵌 Sub-page：在块编辑器里可以插入一个 sub-page 块，点击进入子页面
面包屑导航：记录进入路径，可以返回父页面
对接后端 API：我提供标准的数据结构和 API 接口规范，你自己实现后端
页面管理：新建、删除、重命名、拖拽排序
前端共 4 个文件，架构说明如下：

文件职责
types.ts共享类型定义 + 完整 API 接口规范注释
BlockEditor.tsx块编辑器（新增 subpage 块类型）
PageManager.tsx顶层管理组件，含侧边栏、面包屑、API 层
apiClient.ts后端接入层模板 + 数据库表结构建议

核心交互流程
用户点击 / → 斜杠菜单 → 选"子页面"
  → 插入 subpage 块（显示"点击创建子页面"）
  → 点击块 → 调用 onCreateSubpage(blockId, parentPageId)
    → API POST /api/pages 创建子页面
    → 自动回填块的 subpageId
    → 侧边栏同步出现新页面
  → 再次点击块 → 调用 onNavigate(subpageId)
    → 面包屑更新，主区域切换到子页面编辑

接入真实后端只需 2 步

修改 apiClient.ts 中的 BASE_URL
将 <PageManager /> 的 api prop 替换：

tsximport { createApiClient } from './apiClient'
<PageManager api={createApiClient()} />
// 不传 api 则自动使用内置 Mock（开发调试用）