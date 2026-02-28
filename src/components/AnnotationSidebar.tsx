import React, { useState, useEffect } from 'react';
import { X, Save, Tag, MessageSquare, Zap, Plus } from 'lucide-react';
import { useTranslation } from '@/lib/translations';

interface Message {
  id: string;
  session_id: string;
  message_type: string;
  content: string;
  timestamp: string;
  role: string;
  is_collapsible?: boolean;
  is_final_output?: boolean;
  raw_content?: string;
  level1_categories?: string[];
  level2_categories?: string[];
  level3_tags?: string[];
}

interface Props {
  message: Message | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (messageId: string, data: { suggested_revision: string; tags: string[] }) => void;
  onAddTag: (tagName: string) => void;
}

const parseUsage = (rawContent: string): { provider?: string; model?: string; inputTokens?: number; outputTokens?: number; durationMs?: number } => {
  try {
    if (!rawContent) return {};
    const parsed = JSON.parse(rawContent);
    const usage = parsed.usage || {};
    const details = parsed.details || {};
    return {
      provider: details.provider || parsed.provider,
      model: details.model || parsed.model,
      inputTokens: usage.input || usage.prompt_tokens,
      outputTokens: usage.output || usage.completion_tokens,
      durationMs: details.durationMs || parsed.durationMs
    };
  } catch {
    return {};
  }
};

const formatDuration = (ms?: number): string => {
  if (!ms) return '-';
  return (ms / 1000).toFixed(1) + 's';
};

const AnnotationSidebar: React.FC<Props> = ({ message, isOpen, onClose, onSave, onAddTag }) => {
  const { language } = useTranslation();
  const [suggestedRevision, setSuggestedRevision] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (message) {
      setSuggestedRevision('');
      setTags(message.level3_tags || []);
    }
  }, [message]);

  const handleSave = async () => {
    if (!message) return;
    setSaving(true);
    await onSave(message.id, { suggested_revision: suggestedRevision, tags });
    setSaving(false);
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      setTags([...tags, newTag.trim()]);
      onAddTag(newTag.trim());
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const usage = message?.raw_content ? parseUsage(message.raw_content) : {};

  const getMessageTypeLabel = () => {
    if (!message) return '';
    if (message.role === 'user') return language === 'zh' ? '用户消息' : 'User';
    if (message.is_final_output) return language === 'zh' ? '最终输出' : 'Final';
    if (message.message_type === 'thinking') return language === 'zh' ? '思考' : 'Thinking';
    if (message.message_type === 'tool_call') return language === 'zh' ? '工具调用' : 'Tool';
    if (message.message_type === 'tool_result') return language === 'zh' ? '工具结果' : 'Result';
    return language === 'zh' ? '消息' : 'Message';
  };

  if (!isOpen || !message) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-neutral-900 border-l border-neutral-700 shadow-2xl transform transition-transform duration-300 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-neutral-700">
        <h3 className="text-lg font-semibold text-neutral-200">
          {language === 'zh' ? '标注' : 'Annotation'}
        </h3>
        <button onClick={onClose} className="text-neutral-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="flex items-center space-x-2 text-sm">
          <span className="text-neutral-400">{language === 'zh' ? '类型:' : 'Type:'}</span>
          <span className="px-2 py-1 bg-primary-500/20 text-primary-300 rounded">
            {getMessageTypeLabel()}
          </span>
        </div>

        {(usage.provider || usage.inputTokens) && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center space-x-2 text-neutral-400">
              <Zap className="w-4 h-4" />
              <span>{language === 'zh' ? '资源消耗:' : ' Resource:'}</span>
            </div>
            <div className="pl-6 space-y-1">
              {usage.provider && <div className="text-neutral-300">🔥 {usage.provider}</div>}
              {usage.inputTokens !== undefined && (
                <div className="text-neutral-300">💰 {language === 'zh' ? '输入' : 'In'}: {usage.inputTokens} / {language === 'zh' ? '输出' : 'Out'}: {usage.outputTokens || 0}</div>
              )}
              {usage.durationMs !== undefined && <div className="text-neutral-300">⏱️ {formatDuration(usage.durationMs)}</div>}
            </div>
          </div>
        )}

        <div className="border-t border-neutral-700" />

        <div>
          <label className="flex items-center space-x-2 text-sm text-neutral-400 mb-2">
            <MessageSquare className="w-4 h-4" />
            <span>{language === 'zh' ? '建议修改:' : 'Suggested Revision:'}</span>
          </label>
          <textarea
            value={suggestedRevision}
            onChange={(e) => setSuggestedRevision(e.target.value)}
            placeholder={language === 'zh' ? '输入你的修改建议...' : 'Enter your suggestion...'}
            className="w-full h-32 bg-neutral-800 border border-neutral-600 rounded-lg p-3 text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-primary-500 resize-none"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-2 w-full flex items-center justify-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg py-2 px-4 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? (language === 'zh' ? '保存中...' : 'Saving...') : (language === 'zh' ? '保存' : 'Save')}</span>
          </button>
        </div>

        <div className="border-t border-neutral-700" />

        <div>
          <label className="flex items-center space-x-2 text-sm text-neutral-400 mb-2">
            <Tag className="w-4 h-4" />
            <span>{language === 'zh' ? '分类标签:' : 'Tags:'}</span>
          </label>
          
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map(tag => (
              <span key={tag} className="flex items-center space-x-1 px-2 py-1 bg-purple-900/30 text-purple-300 rounded-lg text-sm">
                <span>{tag}</span>
                <button onClick={() => handleRemoveTag(tag)} className="hover:text-white"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>

          <div className="flex space-x-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder={language === 'zh' ? '添加标签...' : 'Add tag...'}
              className="flex-1 bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-2 text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-primary-500"
            />
            <button onClick={handleAddTag} className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnotationSidebar;
