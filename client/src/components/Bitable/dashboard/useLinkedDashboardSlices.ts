import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  BITABLE_MODEL_UPDATED,
  parseDashboardConfig,
  resolveLinkedChartSlices,
  type DashboardChartSlice,
} from './chartFromTable';

interface UseLinkedDashboardSlicesOptions {
  editor?: Editor | null;
  configRaw: string;
  sourceTableId: string;
}

export function useLinkedDashboardSlices({
  editor,
  configRaw,
  sourceTableId,
}: UseLinkedDashboardSlicesOptions) {
  const [revision, setRevision] = useState(0);
  const config = useMemo(() => parseDashboardConfig(configRaw), [configRaw]);

  const bumpRevision = useCallback(() => {
    setRevision(value => value + 1);
  }, []);

  useEffect(() => {
    const onModelUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ tableId?: string }>).detail;
      const linkedId = sourceTableId || config.link?.sourceTableId || '';
      if (!linkedId || detail?.tableId === linkedId) bumpRevision();
    };
    window.addEventListener(BITABLE_MODEL_UPDATED, onModelUpdated);
    return () => window.removeEventListener(BITABLE_MODEL_UPDATED, onModelUpdated);
  }, [bumpRevision, config.link?.sourceTableId, sourceTableId]);

  useEffect(() => {
    if (!editor) return;
    const onEditorUpdate = () => bumpRevision();
    editor.on('update', onEditorUpdate);
    return () => {
      editor.off('update', onEditorUpdate);
    };
  }, [editor, bumpRevision]);

  const slices = useMemo(
    () => resolveLinkedChartSlices(editor, config, sourceTableId),
    [editor, config, sourceTableId, revision],
  );

  const isLinked = Boolean(sourceTableId || config.link?.sourceTableId);

  return { slices, isLinked, refresh: bumpRevision, config };
}

export function buildDonutPaths(slices: DashboardChartSlice[], size: number, strokeWidth: number) {
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const total = slices.reduce((sum, slice) => sum + Math.max(slice.value, 0), 0) || 1;
  let cursor = -Math.PI / 2;

  return slices.map(slice => {
    const angle = (Math.max(slice.value, 0) / total) * Math.PI * 2;
    const start = cursor;
    const end = cursor + angle;
    cursor = end;
    const largeArc = angle > Math.PI ? 1 : 0;
    const x1 = center + radius * Math.cos(start);
    const y1 = center + radius * Math.sin(start);
    const x2 = center + radius * Math.cos(end);
    const y2 = center + radius * Math.sin(end);
    if (angle >= Math.PI * 2 - 0.001) {
      return {
        d: `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.001} ${center - radius}`,
        slice,
        percent: Math.round((slice.value / total) * 100),
      };
    }
    return {
      d: `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      slice,
      percent: Math.round((slice.value / total) * 100),
    };
  });
}
