/** 与设计稿对齐：字体 8 色「A」行 + 背景浅/深两行色板 */

export const FONT_COLORS = [
  { label: '默认', value: '' },
  { label: '灰色', value: '#8a8f8d' },
  { label: '红色', value: '#d83931' },
  { label: '橙色', value: '#de7802' },
  { label: '黄色', value: '#dc9b04' },
  { label: '绿色', value: '#21a121' },
  { label: '蓝色', value: '#245bdb' },
  { label: '紫色', value: '#6425d0' },
] as const;

export const BG_COLORS_LIGHT = [
  { value: '' },
  { value: '#f1f1f0' },
  { value: '#fdebec' },
  { value: '#fef0e1' },
  { value: '#fefce8' },
  { value: '#ebfaeb' },
  { value: '#e8f0fe' },
  { value: '#f3e8fd' },
] as const;

export const BG_COLORS_DEEP = [
  { value: '#dee0e3' },
  { value: '#bbbfc4' },
  { value: '#f8a5a5' },
  { value: '#f5b041' },
  { value: '#f4d03f' },
  { value: '#58d68d' },
  { value: '#5dade2' },
  { value: '#af7ac5' },
] as const;
