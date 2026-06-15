import type { BaseFieldType } from '../model/bitableModel';

export interface FieldTypeOptionDef {
  type: BaseFieldType;
  label: string;
  isNew?: boolean;
}

export interface FieldTypeGroupDef {
  id: string;
  label: string;
  options: FieldTypeOptionDef[];
}

export const FIELD_TYPE_GROUPS: FieldTypeGroupDef[] = [
  {
    id: 'general',
    label: '常规',
    options: [
      { type: 'text', label: '文本' },
      { type: 'single_select', label: '单选' },
      { type: 'multi_select', label: '多选' },
      { type: 'user', label: '人员' },
      { type: 'date', label: '日期' },
      { type: 'attachment', label: '附件' },
      { type: 'number', label: '数字' },
      { type: 'checkbox', label: '复选框' },
      { type: 'url', label: '超链接' },
      { type: 'formula', label: '公式' },
      { type: 'lookup', label: '查找引用' },
    ],
  },
  {
    id: 'business',
    label: '业务',
    options: [
      { type: 'phone', label: '电话号码' },
      { type: 'email', label: 'Email', isNew: true },
    ],
  },
  {
    id: 'advanced',
    label: '高级',
    options: [
      { type: 'relation', label: '双向关联' },
      { type: 'created_by', label: '创建人' },
      { type: 'updated_by', label: '修改人' },
      { type: 'created_time', label: '创建时间' },
      { type: 'updated_time', label: '最后更新时间' },
    ],
  },
];

const FIELD_TYPE_LABEL_MAP = new Map<BaseFieldType, string>(
  FIELD_TYPE_GROUPS.flatMap(group => group.options.map(option => [option.type, option.label] as const)),
);

export function fieldTypeLabel(type: BaseFieldType) {
  return FIELD_TYPE_LABEL_MAP.get(type) || '文本';
}

export function filterFieldTypeGroups(query: string): FieldTypeGroupDef[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return FIELD_TYPE_GROUPS;
  return FIELD_TYPE_GROUPS
    .map(group => ({
      ...group,
      options: group.options.filter(option => option.label.toLowerCase().includes(keyword)),
    }))
    .filter(group => group.options.length > 0);
}
