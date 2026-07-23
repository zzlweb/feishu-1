import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Document, HeadingItem } from '../../types';
import { DOC_TITLE_CATALOGUE_ID } from '../../types';

type OutlineDocument = Pick<Document, 'id' | 'title' | 'collapsed_heading_ids'>;

/**
 * 目录内容状态与编辑器布局解耦：负责标题快照、标题集合和折叠状态，
 * 不负责目录滚动定位或侧栏宽度策略。
 */
export function useDocumentOutline(document: OutlineDocument | null) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const [titleInputSnapshot, setTitleInputSnapshot] = useState('');
  const [catalogueActiveId, setCatalogueActiveId] = useState<string | null>(null);
  const [collapsedHeadingIds, setCollapsedHeadingIds] = useState<Set<string>>(() => new Set());
  const headingSnapshotDocumentRef = useRef<string | null>(null);

  const collapsedHeadingIdList = useMemo(
    () => Array.from(collapsedHeadingIds).sort(),
    [collapsedHeadingIds],
  );
  const catalogueTitleDisplay = titleInputSnapshot.trim();
  const showOutlineSidebar = headings.length > 0 || catalogueTitleDisplay.length > 0;

  const handleTitleInputChange = useCallback((title: string) => {
    setTitleInputSnapshot(title);
  }, []);

  useEffect(() => {
    if (!document) return;
    setTitleInputSnapshot(document.title === '未命名文档' ? '' : document.title);
  }, [document?.id, document?.title]);

  useEffect(() => {
    headingSnapshotDocumentRef.current = null;
    setHeadings([]);
    setCatalogueActiveId(null);
    setCollapsedHeadingIds(new Set(document?.collapsed_heading_ids ?? []));
  }, [document?.id]);

  const handleHeadingsChange = useCallback((nextHeadings: HeadingItem[]) => {
    headingSnapshotDocumentRef.current = document?.id || null;
    setHeadings(nextHeadings);
  }, [document?.id]);

  useEffect(() => {
    if (!document?.id || headingSnapshotDocumentRef.current !== document.id) return;
    const validIds = new Set(headings.map(heading => heading.id));
    setCollapsedHeadingIds(current => {
      const next = new Set(Array.from(current).filter(headingId => validIds.has(headingId)));
      if (next.size === current.size && Array.from(next).every(headingId => current.has(headingId))) {
        return current;
      }
      return next;
    });
  }, [document?.id, headings]);

  const handleToggleHeadingCollapse = useCallback((headingId: string) => {
    setCollapsedHeadingIds(current => {
      const next = new Set(current);
      if (next.has(headingId)) next.delete(headingId);
      else next.add(headingId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (catalogueActiveId === null) return;
    if (catalogueActiveId === DOC_TITLE_CATALOGUE_ID) {
      if (catalogueTitleDisplay.length === 0) setCatalogueActiveId(null);
      return;
    }
    if (!headings.some(heading => heading.id === catalogueActiveId)) {
      setCatalogueActiveId(null);
    }
  }, [catalogueActiveId, catalogueTitleDisplay, headings]);

  return {
    headings,
    catalogueTitleDisplay,
    showOutlineSidebar,
    catalogueActiveId,
    setCatalogueActiveId,
    collapsedHeadingIds,
    collapsedHeadingIdList,
    handleTitleInputChange,
    handleHeadingsChange,
    handleToggleHeadingCollapse,
  };
}
