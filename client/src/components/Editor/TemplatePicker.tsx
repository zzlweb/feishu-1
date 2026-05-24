import { useEffect, useState } from 'react';
import { MessagePlugin } from 'tdesign-react';
import type { Template } from '../../types';

interface Props {
  onPick: (template: Template) => void;
}

export default function TemplatePicker({ onPick }: Props) {
  const [templates, setTemplates] = useState<Template[] | null>(null);

  useEffect(() => {
    let mounted = true;
    void fetch('/api/documents/templates/list')
      .then(res => res.json())
      .then(json => {
        if (mounted) setTemplates(Array.isArray(json.data) ? json.data : []);
      })
      .catch(() => {
        if (mounted) setTemplates([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (templates == null) {
    return <div className="slash-template-picker__empty">加载模板...</div>;
  }

  if (templates.length === 0) {
    return (
      <div className="slash-template-picker__empty">
        <div className="slash-template-picker__empty-title">暂无模板</div>
        <div className="slash-template-picker__empty-desc">可先在块菜单中保存当前块为模板</div>
      </div>
    );
  }

  return (
    <div className="slash-template-picker">
      <div className="slash-template-picker__header">选择模板插入文档</div>
      <div className="slash-template-picker__list">
        {templates.map(template => (
          <button
            key={template.id}
            type="button"
            className="slash-template-picker__item"
            onMouseDown={event => {
              event.preventDefault();
              onPick(template);
            }}
          >
            <span className="slash-template-picker__icon">▣</span>
            <span className="slash-template-picker__body">
              <span className="slash-template-picker__title">{template.title || '未命名模板'}</span>
              <span className="slash-template-picker__meta">{new Date(template.created_at).toLocaleDateString()}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="slash-template-picker__divider" />
      <button
        type="button"
        className="slash-template-picker__more"
        onMouseDown={event => {
          event.preventDefault();
          void MessagePlugin.info('更多模板正在开发中，您可以在块菜单中保存当前块为模板');
        }}
      >
        更多模板
      </button>
    </div>
  );
}

