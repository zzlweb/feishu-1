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
}

export interface Comment {
  id: string;
  document_id: string;
  content: string;
  author: string;
  position_from: number;
  position_to: number;
  created_at: string;
  resolved: number;
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
