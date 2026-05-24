export interface Document {
  id: string;
  title: string;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
  is_template: number;
  parent_id: string | null;
  cover_url: string;
  icon: string;
  collapsed_heading_ids?: string[];
}

export interface Comment {
  id: string;
  document_id: string;
  block_id: string;
  thread_id?: string;
  parent_id?: string;
  message_id?: string;
  content: string;
  author: string;
  position_from: number;
  position_to: number;
  created_at: string;
  updated_at: string;
  resolved: number;
  status?: 'open' | 'resolved' | 'deleted' | 'anchor_lost';
  visibility?: 'public' | 'private';
  quote?: string;
  anchor_type?: 'text-range' | 'block' | 'image' | 'video' | 'file' | 'table-cell' | 'table-range' | 'document';
  anchor_json?: string;
  mentioned_user_ids?: string;
  private_visible_user_ids?: string;
  deleted_at?: string;
  resolved_at?: string;
  resolved_by?: string;
  is_edited?: number;
}

export interface Template {
  id: string;
  title: string;
  content: string;
  author: string;
  created_at: string;
}

export interface ApiResponse<T> {
  code: number;
  data?: T;
  message?: string;
}

export interface HeadingItem {
  level: number;
  text: string;
  id: string;
}

/** 侧栏目录中与「文档标题」输入行对应的首项 id（与 Sidebar 一致） */
export const DOC_TITLE_CATALOGUE_ID = '__document-title__';
