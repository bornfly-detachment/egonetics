import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, Folder, MessageCircle, Brain, Wrench, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';

// 根据 agent 名称生成颜色（内联样式，更安全
const getAgentColor = (agent: string) => {
  // 预定义颜色数组（RGB 格式）
  const colors = [
    { bg: 'rgba(59, 130, 246, 0.2)', text: 'rgb(96, 165, 250)', border: 'rgba(59, 130, 246, 0.3)' }, // blue
    { bg: 'rgba(249, 115, 22, 0.2)', text: 'rgb(251, 146, 60)', border: 'rgba(249, 115, 22, 0.3)' }, // orange
    { bg: 'rgba(16, 185, 129, 0.2)', text: 'rgb(52, 211, 153)', border: 'rgba(16, 185, 129, 0.3)' }, // green
    { bg: 'rgba(168, 85, 247, 0.2)', text: 'rgb(192, 132, 252)', border: 'rgba(168, 85, 247, 0.3)' }, // purple
    { bg: 'rgba(236, 72, 153, 0.2)', text: 'rgb(244, 114, 182)', border: 'rgba(236, 72, 153, 0.3)' }, // pink
    { bg: 'rgba(20, 184, 166, 0.2)', text: 'rgb(45, 212, 191)', border: 'rgba(20, 184, 166, 0.3)' }, // teal
    { bg: 'rgba(234, 179, 8, 0.2)', text: 'rgb(250, 204, 21)', border: 'rgba(234, 179, 8, 0.3)' }, // yellow
    { bg: 'rgba(99, 102, 241, 0.2)', text: 'rgb(129, 140, 248)', border: 'rgba(99, 102, 241, 0.3)' }, // indigo
    { bg: 'rgba(6, 182, 212, 0.2)', text: 'rgb(34, 211, 238)', border: 'rgba(6, 182, 212, 0.3)' }, // cyan
    { bg: 'rgba(163, 230, 53, 0.2)', text: 'rgb(190, 242, 100)', border: 'rgba(163, 230, 53, 0.3)' }, // lime
  ];
  
  // 简单的哈希函数，把字符串映射到数组索引
  let hash = 0;
  for (let i = 0; i < agent.length; i++) {
    hash = ((hash << 5) - hash) + agent.charCodeAt(i);
    hash = hash & hash; // 转换为32位整数
  }
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const API_BASE = '/api';

const fetchApi = async (path: string, options?: RequestInit) => {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'toolResult';
  message_type: string;
  content: string;
  timestamp: string;
  parent_id?: string;
  token_input?: number;
  token_output?: number;
  duration_ms?: number;
  provider?: string;
  tool_name?: string;
  raw_content?: string;
}

interface Session {
  id: string;
  title: string;
  created_at: string;
  date: string;
  agent?: string;
  messages: Message[];
}

interface AnnotationTarget {
  type: 'date' | 'session' | 'round' | 'message';
  id: string;
  title: string;
  data?: any;
}

// ========== 真正的富文本编辑器 ==========

interface EditorProps {
  initialContent?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
}

const RichTextEditor: React.FC<EditorProps> = ({ initialContent = '', onChange, placeholder = '开始输入...' }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState<string[]>([]);

  useEffect(() => {
    if (editorRef.current && initialContent) {
      editorRef.current.innerHTML = initialContent;
    }
  }, []);

  const execCommand = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    updateActiveFormats();
    if (editorRef.current) {
      onChange?.(editorRef.current.innerHTML);
    }
  };

  const updateActiveFormats = () => {
    const formats = [];
    if (document.queryCommandState('bold')) formats.push('bold');
    if (document.queryCommandState('italic')) formats.push('italic');
    if (document.queryCommandState('underline')) formats.push('underline');
    if (document.queryCommandState('strikeThrough')) formats.push('strike');
    if (document.queryCommandState('insertUnorderedList')) formats.push('ul');
    if (document.queryCommandState('insertOrderedList')) formats.push('ol');
    if (document.queryCommandState('blockquote')) formats.push('quote');
    setActiveFormats(formats);
  };

  const handleInput = () => {
    updateActiveFormats();
    if (editorRef.current) {
      onChange?.(editorRef.current.innerHTML);
    }
  };

  const ToolbarButton: React.FC<{ 
    command: string;
    value?: string;
    label: string; 
    isActive?: boolean;
    title?: string;
  }> = ({ command, value, label, isActive, title }) => (
    <button
      onClick={() => execCommand(command, value || '')}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
        isActive 
          ? 'bg-primary-600 text-white' 
          : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
      }`}
      title={title || label}
    >
      {label}
    </button>
  );

  return (
    <div className="border border-neutral-700 rounded-lg overflow-hidden bg-neutral-800/50">
      {/* 工具栏 */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-neutral-700 bg-neutral-800">
        <div className="flex gap-1">
          <ToolbarButton command="formatBlock" value="H1" label="H1" title="大标题" />
          <ToolbarButton command="formatBlock" value="H2" label="H2" title="小标题" />
        </div>
        <div className="w-px bg-neutral-700 mx-1" />
        <div className="flex gap-1">
          <ToolbarButton command="bold" label="B" isActive={activeFormats.includes('bold')} title="粗体" />
          <ToolbarButton command="italic" label="I" isActive={activeFormats.includes('italic')} title="斜体" />
          <ToolbarButton command="underline" label="U" isActive={activeFormats.includes('underline')} title="下划线" />
          <ToolbarButton command="strikeThrough" label="S" isActive={activeFormats.includes('strike')} title="删除线" />
        </div>
        <div className="w-px bg-neutral-700 mx-1" />
        <div className="flex gap-1">
          <ToolbarButton command="insertUnorderedList" label="• 列表" isActive={activeFormats.includes('ul')} title="无序列表" />
          <ToolbarButton command="insertOrderedList" label="1. 列表" isActive={activeFormats.includes('ol')} title="有序列表" />
        </div>
        <div className="w-px bg-neutral-700 mx-1" />
        <div className="flex gap-1">
          <ToolbarButton command="blockquote" label="引用" isActive={activeFormats.includes('quote')} title="引用" />
          <ToolbarButton command="formatBlock" value="PRE" label="代码" title="代码块" />
        </div>
      </div>

      {/* 编辑区 */}
      <div
        ref={editorRef}
        contentEditable
        className="p-4 min-h-[300px] outline-none text-neutral-200 prose prose-invert max-w-none"
        onInput={handleInput}
        onKeyUp={updateActiveFormats}
        onMouseUp={updateActiveFormats}
        style={{
          lineHeight: '1.6',
        }}
      >
        {!initialContent && <span className="text-neutral-500">{placeholder}</span>}
      </div>
    </div>
  );
};

// ========== 可调整宽度的侧边栏 ==========

const ResizableSidebar: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ isOpen, onClose, children }) => {
  const [width, setWidth] = useState(600);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = window.innerWidth - e.clientX;
      setWidth(Math.max(400, Math.min(900, newWidth)));
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed right-0 top-0 bottom-0 bg-neutral-900 border-l border-neutral-700 shadow-2xl z-50 flex flex-col"
      style={{ width }}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-4 cursor-col-resize flex items-center justify-center hover:bg-primary-500/20 transition-colors"
        onMouseDown={startResizing}
      >
        <GripVertical className="w-4 h-4 text-neutral-600" />
      </div>
      
      <div className="flex-1 overflow-hidden flex flex-col pl-4">
        {children}
      </div>
    </div>
  );
};

// ========== 资源消耗组件 ==========

const ResourceUsage: React.FC<{
  tokenInput?: number;
  tokenOutput?: number;
  durationMs?: number;
  provider?: string;
}> = ({ tokenInput, tokenOutput, durationMs, provider }) => {
  return (
    <div className="text-xs space-y-1 bg-neutral-800/50 rounded p-2">
      {provider && (
        <div className="flex items-center justify-between">
          <span className="text-neutral-500">模型:</span>
          <span className="text-yellow-400">{provider}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-neutral-500">输入Token:</span>
        <span className="text-blue-400">{tokenInput?.toLocaleString() || '-'}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-neutral-500">输出Token:</span>
        <span className="text-green-400">{tokenOutput?.toLocaleString() || '-'}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-neutral-500">总消耗:</span>
        <span className="text-purple-400">
          {tokenInput && tokenOutput ? (tokenInput + tokenOutput).toLocaleString() : '-'}
        </span>
      </div>
      {durationMs !== undefined && (
        <div className="flex items-center justify-between">
          <span className="text-neutral-500">执行耗时:</span>
          <span className="text-orange-400">{(durationMs / 1000).toFixed(1)}秒</span>
        </div>
      )}
    </div>
  );
};

// ========== 树节点组件 ==========

const TreeNode: React.FC<{
  icon: React.ReactNode;
  label: string;
  children?: React.ReactNode;
  defaultExpanded?: boolean;
  rightContent?: React.ReactNode;
  onAnnotate?: () => void;
}> = ({ icon, label, children, defaultExpanded = false, rightContent, onAnnotate }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = !!children;

  return (
    <div className="group">
      <div
        className="flex items-center space-x-2 py-1.5 px-2 hover:bg-white/5 rounded cursor-pointer"
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren && (
          <span className="text-neutral-400">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
        )}
        {!hasChildren && <span className="w-4" />}
        <span className="text-neutral-300">{icon}</span>
        <span className="text-neutral-200 flex-1 truncate">{label}</span>
        
        {/* 标注按钮 - 明确样式 */}
        {onAnnotate && (
          <button
            onClick={(e) => { e.stopPropagation(); onAnnotate(); }}
            className="opacity-0 group-hover:opacity-100 transition-all text-xs px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded font-medium"
          >
            标注
          </button>
        )}
        
        {rightContent}
      </div>
      {expanded && children && (
        <div className="ml-4 pl-2 border-l border-neutral-700">
          {children}
        </div>
      )}
    </div>
  );
};

// ========== 解析消息链 ==========

interface ParsedRound {
  userMsg: Message;
  thoughts: Message[];
  finalOutput?: Message;
  toolResults: Message[];
}

const parseRound = (messages: Message[]): ParsedRound => {
  const result: ParsedRound = {
    userMsg: messages[0],
    thoughts: [],
    toolResults: []
  };

  for (let i = 1; i < messages.length; i++) {
    const msg = messages[i];
    
    if (msg.role === 'toolResult') {
      result.toolResults.push(msg);
    } else if (msg.role === 'assistant') {
      // 检查消息内容类型
      try {
        const raw = JSON.parse(msg.raw_content || '{}');
        const content = raw.content || [];
        
        // 有thinking的是思考步骤
        const hasThinking = content.some((c: any) => c.type === 'thinking');
        // 有text的是最终输出
        const hasText = content.some((c: any) => c.type === 'text');
        
        if (hasThinking) {
          result.thoughts.push(msg);
        } else if (hasText && !hasThinking) {
          // 纯text是最终输出
          result.finalOutput = msg;
        }
      } catch {
        // 解析失败，按内容判断
        if (msg.content.includes('[思考]')) {
          result.thoughts.push(msg);
        } else {
          result.finalOutput = msg;
        }
      }
    }
  }

  return result;
};

// ========== 主组件 ==========

const MemoryView: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [annotationTarget, setAnnotationTarget] = useState<AnnotationTarget | null>(null);
  const [editorContent, setEditorContent] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchApi('/sessions');
      
      const sessionsWithData = await Promise.all(
        (data.sessions || []).map(async (s: any) => {
          const detail = await fetchApi(`/sessions/${s.id}`);
          return {
            ...detail,
            date: new Date(detail.created_at).toLocaleDateString('zh-CN'),
            agent: detail.agent || 'main'
          };
        })
      );
      
      // 按创建时间倒序排列（最新的在前面）
      sessionsWithData.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setSessions(sessionsWithData);
    } catch (err) {
      console.error('加载失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleTool = (msgId: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const openAnnotation = (target: AnnotationTarget) => {
    setAnnotationTarget(target);
    setEditorContent('');
    setSidebarOpen(true);
  };

  const saveAnnotation = () => {
    console.log('Saving annotation for', annotationTarget?.id, editorContent);
    setSidebarOpen(false);
  };

  const groupByDate = (sessions: Session[]) => {
    const groups: Record<string, Session[]> = {};
    for (const s of sessions) {
      if (!groups[s.date]) groups[s.date] = [];
      groups[s.date].push(s);
    }
    return groups;
  };

  const dateGroups = groupByDate(sessions);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative h-full flex">
      {/* 主内容区 */}
      <div className={`flex-1 space-y-2 transition-all ${sidebarOpen ? 'mr-[600px]' : ''}`}>
        <h1 className="text-2xl font-bold gradient-text mb-4">Memory Tree</h1>

        {Object.entries(dateGroups)
          .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
          .map(([date, dateSessions]) => (
          <TreeNode
            key={date}
            icon={<Calendar className="w-4 h-4 text-blue-400" />}
            label={`📅 ${date}`}
            defaultExpanded={true}
            onAnnotate={() => openAnnotation({ type: 'date', id: date, title: date })}
          >
            {dateSessions.map(session => {
              // 按user切分轮次
              const rounds: Message[][] = [];
              let currentRound: Message[] = [];
              
              for (const msg of (session.messages || [])) {
                if (msg.role === 'user') {
                  if (currentRound.length > 0) {
                    rounds.push(currentRound);
                  }
                  currentRound = [msg];
                } else if (currentRound.length > 0) {
                  currentRound.push(msg);
                }
              }
              if (currentRound.length > 0) rounds.push(currentRound);

              return (
                <TreeNode
                  key={session.id}
                  icon={<Folder className="w-4 h-4 text-yellow-400" />}
                  label={
                    <>
                      {session.title || session.id.slice(0, 8)}
                      {session.agent && (() => {
                        const color = getAgentColor(session.agent);
                        return (
                          <span 
                            className="ml-2 px-2 py-0.5 text-xs rounded border"
                            style={{
                              backgroundColor: color.bg,
                              color: color.text,
                              borderColor: color.border
                            }}
                          >
                            {session.agent}
                          </span>
                        );
                      })()}
                    </>
                  }
                  rightContent={<span className="text-xs text-neutral-500">{rounds.length}轮</span>}
                  onAnnotate={() => openAnnotation({ type: 'session', id: session.id, title: session.title })}
                >
                  {rounds.map((round, roundIdx) => {
                    const parsed = parseRound(round);
                    const toolCount = parsed.toolResults.length;
                    
                    return (
                      <TreeNode
                        key={round[0].id}
                        icon={<MessageCircle className="w-4 h-4 text-green-400" />}
                        label={`轮次 ${roundIdx + 1}`}
                        rightContent={
                          <span className="text-xs text-neutral-500">
                            {parsed.thoughts.length}思考
                            {parsed.finalOutput ? '+输出' : ''}
                            {toolCount > 0 ? `/${toolCount}工具` : ''}
                          </span>
                        }
                        onAnnotate={() => openAnnotation({ 
                          type: 'round', 
                          id: round[0].id, 
                          title: `轮次 ${roundIdx + 1}`,
                          data: round
                        })}
                      >
                        {/* 用户输入 */}
                        <div className="py-2 px-2 bg-neutral-800/30 rounded mb-2 group">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-blue-400">👤 用户输入</span>
                            <button
                              onClick={() => openAnnotation({ 
                                type: 'message', 
                                id: parsed.userMsg.id, 
                                title: '用户输入',
                                data: parsed.userMsg
                              })}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded font-medium"
                            >
                              标注
                            </button>
                          </div>
                          <div className="text-sm text-neutral-300 pl-4 whitespace-pre-wrap">
                            {parsed.userMsg.content}
                          </div>
                        </div>

                        {/* 思考步骤 */}
                        {parsed.thoughts.map((thought, thoughtIdx) => {
                          const thinkingContent = thought.content
                            .replace('[思考]', '')
                            .split('[工具调用]')[0]
                            .trim();
                          
                          // 查找关联的工具
                          const relatedTools = parsed.toolResults.filter(
                            t => t.parent_id === thought.id
                          );
                          const hasTools = relatedTools.length > 0;
                          const isToolExpanded = expandedTools.has(thought.id);
                          
                          return (
                            <div key={thought.id} className="mb-2">
                              <div className="bg-neutral-800/50 rounded p-3 group">
                                <div className="flex items-start gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      <Brain className="w-4 h-4 text-purple-400 shrink-0" />
                                      <span className="text-purple-400 text-sm font-medium">
                                        思考步骤 {thoughtIdx + 1}
                                      </span>
                                      
                                      <button
                                        onClick={() => openAnnotation({ 
                                          type: 'message', 
                                          id: thought.id, 
                                          title: `思考步骤 ${thoughtIdx + 1}`,
                                          data: thought
                                        })}
                                        className="text-xs px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded font-medium"
                                      >
                                        标注
                                      </button>

                                      {hasTools && (
                                        <button
                                          onClick={() => toggleTool(thought.id)}
                                          className="text-xs px-2 py-1 bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50 rounded flex items-center gap-1"
                                        >
                                          <Wrench className="w-3 h-3" />
                                          {isToolExpanded ? '隐藏工具' : `查看工具 (${relatedTools.length})`}
                                          {isToolExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                        </button>
                                      )}
                                    </div>
                                    
                                    <div className="text-neutral-200 text-sm pl-6 whitespace-pre-wrap">
                                      {thinkingContent}
                                    </div>
                                  </div>

                                  <div className="w-40 shrink-0">
                                    <ResourceUsage
                                      tokenInput={thought.token_input}
                                      tokenOutput={thought.token_output}
                                      durationMs={thought.duration_ms}
                                      provider={thought.provider}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* 工具结果 */}
                              {isToolExpanded && hasTools && (
                                <div className="ml-6 mt-2 space-y-2">
                                  {relatedTools.map((tool, toolIdx) => (
                                    <div key={tool.id} className="bg-neutral-900/50 rounded p-2 border-l-2 border-yellow-600">
                                      <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2 text-sm text-yellow-400">
                                          <Wrench className="w-3 h-3" />
                                          <span>工具 {toolIdx + 1}: {tool.tool_name || 'unknown'}</span>
                                        </div>
                                      </div>
                                      <div className="text-xs text-neutral-400 whitespace-pre-wrap pl-5">
                                        {tool.content}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* 最终输出 */}
                        {parsed.finalOutput && (
                          <div className="bg-green-900/20 rounded p-3 border-l-4 border-green-500 group">
                            <div className="flex items-start gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-green-400 text-sm font-medium">
                                    ✨ 轮次 {roundIdx + 1} Agent输出
                                  </span>
                                  
                                  <button
                                    onClick={() => openAnnotation({ 
                                      type: 'message', 
                                      id: parsed.finalOutput!.id, 
                                      title: `轮次 ${roundIdx + 1} 输出`,
                                      data: parsed.finalOutput
                                    })}
                                    className="text-xs px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded font-medium"
                                  >
                                    标注
                                  </button>
                                </div>
                                
                                <div className="text-neutral-200 text-sm pl-6 whitespace-pre-wrap">
                                  {(() => {
                                    try {
                                      const raw = JSON.parse(parsed.finalOutput!.raw_content || '{}');
                                      const textContent = raw.content?.find((c: any) => c.type === 'text')?.text;
                                      return textContent || parsed.finalOutput!.content;
                                    } catch {
                                      return parsed.finalOutput!.content;
                                    }
                                  })()}
                                </div>
                              </div>

                              <div className="w-40 shrink-0">
                                <ResourceUsage
                                  tokenInput={parsed.finalOutput.token_input}
                                  tokenOutput={parsed.finalOutput.token_output}
                                  durationMs={parsed.finalOutput.duration_ms}
                                  provider={parsed.finalOutput.provider}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </TreeNode>
                    );
                  })}
                </TreeNode>
              );
            })}
          </TreeNode>
        ))}
      </div>

      {/* 富文本编辑器侧边栏 */}
      <ResizableSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}>
        <div className="flex items-center justify-between p-4 border-b border-neutral-700 shrink-0">
          <div>
            <h3 className="text-lg font-semibold">标注文档</h3>
            {annotationTarget && (
              <p className="text-xs text-neutral-400 mt-1">
                {annotationTarget.type === 'date' && '📅 '}
                {annotationTarget.type === 'session' && '📁 '}
                {annotationTarget.type === 'round' && '💬 '}
                {annotationTarget.type === 'message' && '📝 '}
                {annotationTarget.title}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={saveAnnotation}
              className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded font-medium"
            >
              保存
            </button>
            <button 
              onClick={() => setSidebarOpen(false)} 
              className="text-neutral-400 hover:text-white px-2"
            >
              ✕
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-neutral-400 mb-2">标注内容</h4>
            <RichTextEditor
              initialContent=""
              onChange={setEditorContent}
              placeholder="开始输入标注内容..."
            />
          </div>

          <div>
            <h4 className="text-sm font-medium text-neutral-400 mb-2">标签</h4>
            <div className="flex flex-wrap gap-2">
              <input 
                type="text" 
                placeholder="添加标签，回车确认..."
                className="bg-neutral-800 rounded px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary-500 flex-1"
              />
            </div>
          </div>
        </div>
      </ResizableSidebar>

      {/* 编辑器样式 */}
      <style>{`
        .prose h1 { font-size: 1.5em; font-weight: bold; margin: 0.5em 0; }
        .prose h2 { font-size: 1.25em; font-weight: bold; margin: 0.5em 0; }
        .prose blockquote { 
          border-left: 4px solid #4b5563; 
          padding-left: 1em; 
          margin: 0.5em 0;
          font-style: italic;
          color: #9ca3af;
        }
        .prose ul { list-style-type: disc; padding-left: 1.5em; margin: 0.5em 0; }
        .prose ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.5em 0; }
        .prose pre { 
          background: #1f2937; 
          padding: 0.75em; 
          border-radius: 0.375em; 
          overflow-x: auto;
          font-family: monospace;
        }
        .prose code { 
          background: #1f2937; 
          padding: 0.125em 0.25em; 
          border-radius: 0.25em;
          font-family: monospace;
        }
        .prose b, .prose strong { font-weight: bold; }
        .prose i, .prose em { font-style: italic; }
        .prose u { text-decoration: underline; }
        .prose s, .prose strike { text-decoration: line-through; }
      `}</style>
    </div>
  );
};

export default MemoryView;
