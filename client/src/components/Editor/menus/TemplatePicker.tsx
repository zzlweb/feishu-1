import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Template } from '../../../types';
import { sortTemplatesForPicker } from './templatePickerConfig';

interface Props {
  onPick: (template: Template) => void;
}

function TemplatePreview({ template }: { template: Template }) {
  return (
    <div className="slash-template-preview__document">
      <div
        className="slash-template-preview__html"
        dangerouslySetInnerHTML={{ __html: template.content }}
      />
    </div>
  );
}

export default function TemplatePicker({ onPick }: Props) {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [hovered, setHovered] = useState<Template | null>(null);
  const [previewArrowTop, setPreviewArrowTop] = useState(18);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());

  useLayoutEffect(() => {
    if (!hovered) return;
    const item = itemRefs.current.get(hovered.id);
    if (!item) return;
    setPreviewArrowTop(Math.max(12, item.offsetTop + item.offsetHeight / 2 - 6));
  }, [hovered, templates]);

  useEffect(() => {
    let mounted = true;
    void fetch('/api/documents/templates/list')
      .then(res => res.json())
      .then(json => {
        if (!mounted) return;
        const next = sortTemplatesForPicker(Array.isArray(json.data) ? json.data : []);
        setTemplates(next);
        setHovered(next[0] ?? null);
      })
      .catch(() => {
        if (mounted) {
          setTemplates([]);
          setHovered(null);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!templates?.length) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'Enter'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      const activeIndex = Math.max(0, templates.findIndex(template => template.id === hovered?.id));
      if (event.key === 'Enter') {
        onPick(templates[activeIndex]);
        return;
      }
      const nextIndex = Math.max(0, Math.min(templates.length - 1, activeIndex + (event.key === 'ArrowDown' ? 1 : -1)));
      setHovered(templates[nextIndex]);
      itemRefs.current.get(templates[nextIndex].id)?.scrollIntoView({ block: 'nearest' });
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [hovered?.id, onPick, templates]);

  if (templates == null) {
    return (
      <div className="slash-template-flyout-inner">
        <div className="slash-template-picker">
          <div className="slash-template-picker__empty">加载模板...</div>
        </div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="slash-template-flyout-inner">
        <div className="slash-template-picker">
          <div className="slash-template-picker__empty">
            <div className="slash-template-picker__empty-title">暂无模板</div>
            <div className="slash-template-picker__empty-desc">可先在块菜单中保存当前块为模板</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="slash-template-flyout-inner">
      <div className="slash-template-picker">
        <div className="slash-template-picker__header">选择模板插入文档</div>
        <div className="slash-template-picker__list">
          {templates.map(template => (
            <button
              key={template.id}
              ref={el => {
                if (el) itemRefs.current.set(template.id, el);
                else itemRefs.current.delete(template.id);
              }}
              type="button"
              className={`slash-template-picker__item${hovered?.id === template.id ? ' is-active' : ''}`}
              aria-selected={hovered?.id === template.id}
              tabIndex={-1}
              onMouseEnter={() => setHovered(template)}
              onMouseDown={event => {
                event.preventDefault();
                onPick(template);
              }}
            >
              {template.title || '未命名模板'}
            </button>
          ))}
        </div>
      </div>
      {hovered && (
        <div className="slash-template-preview">
          <span className="slash-template-preview__arrow" style={{ top: previewArrowTop }} aria-hidden />
          <TemplatePreview template={hovered} />
        </div>
      )}
    </div>
  );
}
