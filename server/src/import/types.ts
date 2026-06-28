export type ImportQuality = 'full' | 'partial' | 'fallback';

export interface ImportWarning {
  type: 'auth' | 'unsupported-block' | 'asset' | 'fallback' | 'partial-data';
  message: string;
  blockType?: string;
}

export interface ImportedAsset {
  id: string;
  sourceUrl: string;
  localUrl?: string;
  name?: string;
  mimeType?: string;
  status: 'downloaded' | 'skipped' | 'failed';
  warning?: string;
}

export interface ImportedInline {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  link?: string;
}

export interface ImportedTableCell {
  content: string;
  header?: boolean;
  rowSpan?: number;
  colSpan?: number;
  bgColor?: string;
}

export interface ImportedBitableBlock {
  table: unknown;
  defaultView?: string;
}

export interface ImportedDashboardBlock {
  title: string;
  config: Record<string, unknown>;
  fallbackSlices?: Array<{ label: string; value: number; color?: string }>;
}

export type ImportedBlock =
  | { type: 'heading'; level: number; inlines: ImportedInline[] }
  | { type: 'paragraph'; inlines: ImportedInline[] }
  | { type: 'quote'; blocks: ImportedBlock[] }
  | { type: 'code'; code: string; language?: string }
  | { type: 'divider' }
  | { type: 'image'; src: string; alt?: string }
  | { type: 'table'; rows: ImportedTableCell[][] }
  | { type: 'taskList'; items: Array<{ id: string; text: string; checked?: boolean }> }
  | { type: 'list'; ordered?: boolean; items: Array<{ blocks: ImportedBlock[] }> }
  | { type: 'docNav'; links: Array<{ label: string; href?: string }> }
  | { type: 'columns'; columns: ImportedBlock[][]; ratios?: number[] }
  | { type: 'highlight'; content: ImportedBlock[]; bgColor?: string; borderColor?: string; textColor?: string; icon?: string }
  | { type: 'bitable'; payload: ImportedBitableBlock }
  | { type: 'dashboard'; payload: ImportedDashboardBlock }
  | { type: 'embed'; title: string; url?: string; kind?: string; desc?: string }
  | { type: 'html'; html: string };

export interface ImportedDocument {
  title: string;
  sourceUrl?: string;
  sourceName: string;
  blocks: ImportedBlock[];
  assets: ImportedAsset[];
  warnings: ImportWarning[];
  importQuality: ImportQuality;
  coverUrl?: string;
  showSourceAttribution?: boolean;
  importMetadata?: ImportMetadata;
}

export interface ImportMetadata {
  permission: 'unknown' | 'readable' | 'readonly' | 'editable';
  readonly: boolean;
  comments: 'not_requested' | 'not_supported' | 'partial' | 'imported';
  notes: string[];
}

export interface EmittedImportPayload {
  title: string;
  content: string;
  sourceName: string;
  sourceUrl?: string;
  assetCount: number;
  warnings: string[];
  importQuality: ImportQuality;
  unsupportedBlocks?: Array<{ type: string; reason: string }>;
  coverUrl?: string;
  importMetadata?: ImportMetadata;
}
