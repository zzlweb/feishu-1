import type { Template } from '../../../types';

export const TEMPLATE_PICKER_LIST_WIDTH = 220;
export const TEMPLATE_PICKER_PREVIEW_WIDTH = 368;
export const TEMPLATE_PICKER_GAP = 8;
export const TEMPLATE_PICKER_HEIGHT = 420;
/** 仅用于子菜单定位：对齐「模板」菜单项，不含右侧预览宽度 */
export const TEMPLATE_PICKER_LIST_HEIGHT = 300;
export const TEMPLATE_PICKER_FULL_WIDTH =
  TEMPLATE_PICKER_LIST_WIDTH + TEMPLATE_PICKER_GAP + TEMPLATE_PICKER_PREVIEW_WIDTH;

const FEISHU_TEMPLATE_ORDER = [
  '个人总结',
  '读书笔记',
  'SWOT 分析思维导图',
  '工作汇报',
  '会议记录',
];

export function sortTemplatesForPicker(templates: Template[]): Template[] {
  return [...templates].sort((a, b) => {
    const ai = FEISHU_TEMPLATE_ORDER.indexOf(a.title);
    const bi = FEISHU_TEMPLATE_ORDER.indexOf(b.title);
    if (ai === -1 && bi === -1) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
