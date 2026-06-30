import {
  createFeishuApiClient,
  getFeishuApiConfigFromEnv,
  parseFeishuUrl,
  type FeishuApiClient,
  type FeishuApiConfig,
  type FeishuObjectType,
  type ParsedFeishuUrl,
} from './feishuApiClient';

export interface FeishuRawTextElement {
  text_run?: {
    content?: string;
    text_element_style?: Record<string, unknown>;
  };
  mention_user?: Record<string, unknown>;
  mention_doc?: Record<string, unknown>;
  equation?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FeishuRawBlock {
  block_id?: string;
  parent_id?: string;
  block_type?: number | string;
  children?: string[];
  page?: { elements?: FeishuRawTextElement[]; style?: Record<string, unknown> };
  text?: { elements?: FeishuRawTextElement[]; style?: Record<string, unknown> };
  image?: { token?: string; url?: string };
  file?: { file_token?: string; token?: string; name?: string; mime_type?: string };
  table?: {
    cells?: string[][] | string[];
    row_size?: number;
    column_size?: number;
    property?: { row_size?: number; column_size?: number };
  };
  table_cell?: { row_span?: number; col_span?: number; background_color?: number | string };
  bitable?: FeishuRawBitableBlockPayload;
  reference_base?: { layout_mode?: string; token?: string; view_id?: string };
  [key: string]: unknown;
}

export interface FeishuRawBitableBlockPayload {
  app_token?: string;
  token?: string;
  table_id?: string;
  table_name?: string;
  fields?: Array<Record<string, unknown>>;
  records?: Array<Record<string, unknown>>;
  views?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface FeishuRawWikiNode {
  obj_token?: string;
  obj_type?: string;
  title?: string;
  node_token?: string;
}

export interface FeishuResolvedTarget {
  token: string;
  type: FeishuObjectType;
  title?: string;
  tableId?: string;
  viewId?: string;
  wikiNode?: FeishuRawWikiNode;
}

export interface FeishuRawBitableTableData {
  tableId: string;
  tableName?: string;
  fields: Array<Record<string, unknown>>;
  records: Array<Record<string, unknown>>;
  views: Array<Record<string, unknown>>;
}

export interface FeishuRawBitableData {
  source: 'standalone' | 'document_block' | 'reference_base';
  sourceBlockId?: string;
  appToken: string;
  preferredTableId?: string;
  preferredViewId?: string;
  tables: Array<Record<string, unknown>>;
  tableData: FeishuRawBitableTableData[];
}

export interface FeishuRawMediaRef {
  blockId?: string;
  type: 'image' | 'file' | 'bitable-attachment';
  token?: string;
  url?: string;
  name?: string;
  mimeType?: string;
  downloadUrl?: string;
  source?: 'document_block' | 'bitable_record';
  tableId?: string;
  recordId?: string;
  fieldName?: string;
}

export interface FeishuRawMediaAsset extends FeishuRawMediaRef {
  status: 'downloaded' | 'failed' | 'skipped';
  contentType?: string;
  byteLength?: number;
  data?: Buffer;
  error?: string;
}

export interface FeishuRawBlockNode {
  blockId?: string;
  block: FeishuRawBlock;
  children: FeishuRawBlockNode[];
  missingChildIds: string[];
  isCycle?: boolean;
}

export interface FeishuRawTableSummary {
  blockId?: string;
  rowSize: number;
  columnSize: number;
  cellBlockIds: string[];
  actualCellCount: number;
  isCompleteShape: boolean;
}

export interface FeishuRawTableCellContent {
  rowIndex: number;
  columnIndex: number;
  cellBlockId?: string;
  cellBlock?: FeishuRawBlock;
  childNodes: FeishuRawBlockNode[];
  rowSpan: number;
  colSpan: number;
  backgroundColor?: number | string;
  isMissing: boolean;
}

export interface FeishuRawTableDetail extends FeishuRawTableSummary {
  tableBlock: FeishuRawBlock;
  rows: FeishuRawTableCellContent[][];
  missingCellIds: string[];
  overflowCellIds: string[];
}

export interface FeishuRawFetchWarning {
  type: 'partial-data' | 'unsupported-target' | 'invalid-data' | 'asset';
  message: string;
  blockId?: string;
  blockType?: string;
}

export interface FeishuRawFetchStats {
  blockCount: number;
  rootBlockCount: number;
  bitableAppCount: number;
  bitableTableCount: number;
  bitableFieldCount: number;
  bitableRecordCount: number;
  bitableViewCount: number;
  mediaCount: number;
  downloadedMediaCount: number;
  failedMediaCount: number;
  tableBlockCount: number;
  treeNodeCount: number;
  missingChildRefCount: number;
  orphanBlockCount: number;
}

export interface FeishuRawCompletenessReport {
  isComplete: boolean;
  missing: string[];
  warnings: string[];
  notes: string[];
  blockTypeCounts: Record<string, number>;
  orphanBlockIds: string[];
  missingChildIds: string[];
  incompleteTableBlockIds: string[];
  incompleteBitableSources: Array<{ source: FeishuRawBitableData['source']; sourceBlockId?: string; appToken: string }>;
  media: {
    expectedCount: number;
    downloadedCount: number;
    failedCount: number;
    skippedCount: number;
    notDownloadedCount: number;
  };
  coverage: {
    rawBlocksPreserved: boolean;
    contentTreeBuilt: boolean;
    tableCellsExpanded: boolean;
    bitableDataFetched: boolean;
    mediaRefsCollected: boolean;
    mediaBinariesDownloaded: boolean;
  };
}

export interface FeishuRawDocumentData {
  sourceUrl: string;
  parsedUrl: ParsedFeishuUrl;
  target: FeishuResolvedTarget;
  tenantAccessToken?: string;
  document?: {
    blocks: FeishuRawBlock[];
    rootBlockIds: string[];
    blockMap: Record<string, FeishuRawBlock>;
    contentTree: FeishuRawBlockNode[];
  };
  bitables: FeishuRawBitableData[];
  mediaRefs: FeishuRawMediaRef[];
  mediaAssets?: FeishuRawMediaAsset[];
  tableSummaries: FeishuRawTableSummary[];
  tableDetails: FeishuRawTableDetail[];
  completeness: FeishuRawCompletenessReport;
  warnings: FeishuRawFetchWarning[];
  stats: FeishuRawFetchStats;
}

interface FeishuBlockListResponse {
  items?: FeishuRawBlock[];
  has_more?: boolean;
  page_token?: string;
}

interface FeishuListResponse<T> {
  items?: T[];
  has_more?: boolean;
  page_token?: string;
}

interface FeishuWikiGetNodeResponse {
  node?: FeishuRawWikiNode;
}

interface FetchFeishuRawDocumentOptions {
  config?: FeishuApiConfig;
  client?: FeishuApiClient;
  includeTenantAccessToken?: boolean;
  downloadMedia?: boolean;
  maxMediaBytes?: number;
}

const DEFAULT_BASE_URL = 'https://open.feishu.cn';
const DEFAULT_MAX_MEDIA_BYTES = 20 * 1024 * 1024;

function normalizeObjType(objType: string | undefined): FeishuObjectType {
  const value = String(objType || '').toLowerCase();
  if (value === 'docx') return 'docx';
  if (value === 'doc') return 'doc';
  if (value === 'bitable' || value === 'base') return 'bitable';
  if (value === 'sheet') return 'sheet';
  if (value === 'mindnote') return 'mindnote';
  if (value === 'file') return 'file';
  if (value === 'slides') return 'slides';
  return 'unknown';
}

function isPageBlock(block: FeishuRawBlock) {
  return block.block_type === 1 || block.block_type === 'page';
}

function getBlockId(block: FeishuRawBlock) {
  return block.block_id || '';
}

function mediaDownloadUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, '')}/open-apis/drive/v1/medias/${encodeURIComponent(token)}/download`;
}

function parseBitableToken(rawToken: string | undefined): { appToken: string; tableId?: string } | null {
  const token = rawToken?.trim();
  if (!token) return null;
  const separatorIndex = token.indexOf('_');
  if (separatorIndex > 0) {
    return {
      appToken: token.slice(0, separatorIndex),
      tableId: token.slice(separatorIndex + 1) || undefined,
    };
  }
  return { appToken: token };
}

function tableIdFromMeta(table: Record<string, unknown>): string {
  return String(table.table_id || table.id || '').trim();
}

function tableNameFromMeta(table: Record<string, unknown>): string | undefined {
  const name = table.name || table.table_name;
  return typeof name === 'string' && name.trim() ? name.trim() : undefined;
}

async function fetchPagedItems<T>(
  client: FeishuApiClient,
  path: string,
  pageSize = 500,
): Promise<T[]> {
  const items: T[] = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ page_size: String(pageSize) });
    if (pageToken) query.set('page_token', pageToken);
    const separator = path.includes('?') ? '&' : '?';
    const data = await client.request<FeishuListResponse<T>>(`${path}${separator}${query.toString()}`);
    items.push(...(data.items || []));
    pageToken = data.has_more && data.page_token ? data.page_token : '';
  } while (pageToken);
  return items;
}

async function fetchAllDocumentBlocks(client: FeishuApiClient, documentToken: string): Promise<FeishuRawBlock[]> {
  return fetchPagedItems<FeishuRawBlock>(
    client,
    `/open-apis/docx/v1/documents/${encodeURIComponent(documentToken)}/blocks`,
    500,
  );
}

async function resolveDocumentTarget(
  client: FeishuApiClient,
  parsed: ParsedFeishuUrl,
  warnings: FeishuRawFetchWarning[],
): Promise<FeishuResolvedTarget> {
  if (parsed.type !== 'wiki') {
    return {
      token: parsed.token,
      type: parsed.type === 'unknown' ? 'docx' : parsed.type,
      tableId: parsed.tableId,
      viewId: parsed.viewId,
    };
  }

  try {
    const query = new URLSearchParams({ token: parsed.token, obj_type: 'wiki' });
    const data = await client.request<FeishuWikiGetNodeResponse>(
      `/open-apis/wiki/v2/spaces/get_node?${query.toString()}`,
    );
    if (data.node?.obj_token) {
      return {
        token: data.node.obj_token,
        type: normalizeObjType(data.node.obj_type),
        title: data.node.title?.trim() || undefined,
        tableId: parsed.tableId,
        viewId: parsed.viewId,
        wikiNode: data.node,
      };
    }
  } catch (error) {
    warnings.push({
      type: 'partial-data',
      blockType: 'wiki-node',
      message: `wiki 节点解析失败，已按 docx token 尝试读取：${error instanceof Error ? error.message : '未知错误'}`,
    });
  }

  return { token: parsed.token, type: 'docx', tableId: parsed.tableId, viewId: parsed.viewId };
}

async function fetchBitableAppData(input: {
  client: FeishuApiClient;
  appToken: string;
  source: FeishuRawBitableData['source'];
  sourceBlockId?: string;
  preferredTableId?: string;
  preferredViewId?: string;
  inlineTables?: Array<Record<string, unknown>>;
  inlineFields?: Array<Record<string, unknown>>;
  inlineRecords?: Array<Record<string, unknown>>;
  inlineViews?: Array<Record<string, unknown>>;
  warnings: FeishuRawFetchWarning[];
}): Promise<FeishuRawBitableData | null> {
  const {
    client,
    appToken,
    source,
    sourceBlockId,
    preferredTableId,
    preferredViewId,
    inlineFields,
    inlineRecords,
    inlineViews,
    warnings,
  } = input;

  if (inlineFields?.length && inlineRecords) {
    return {
      source,
      sourceBlockId,
      appToken,
      preferredTableId,
      preferredViewId,
      tables: input.inlineTables || [{
        table_id: preferredTableId || sourceBlockId || 'inline_table',
        name: '飞书内联多维表格',
      }],
      tableData: [{
        tableId: preferredTableId || sourceBlockId || 'inline_table',
        fields: inlineFields,
        records: inlineRecords,
        views: inlineViews || [],
      }],
    };
  }

  let tables: Array<Record<string, unknown>> = [];
  try {
    tables = await fetchPagedItems<Record<string, unknown>>(
      client,
      `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables`,
      100,
    );
  } catch (error) {
    if (!preferredTableId) {
      warnings.push({
        type: 'partial-data',
        blockId: sourceBlockId,
        blockType: 'bitable',
        message: `多维表格 app 表列表拉取失败：${error instanceof Error ? error.message : '未知错误'}`,
      });
      return null;
    }
    tables = [{ table_id: preferredTableId }];
  }

  const orderedTables = preferredTableId
    ? [...tables].sort((left, right) =>
        (tableIdFromMeta(right) === preferredTableId ? 1 : 0) - (tableIdFromMeta(left) === preferredTableId ? 1 : 0))
    : tables;
  const selectedTables = preferredTableId
    ? orderedTables.filter(table => tableIdFromMeta(table) === preferredTableId)
    : orderedTables;
  const tableMetas = selectedTables.length ? selectedTables : orderedTables;
  const tableData: FeishuRawBitableTableData[] = [];

  for (const tableMeta of tableMetas) {
    const tableId = tableIdFromMeta(tableMeta);
    if (!tableId) continue;
    const basePath = `/open-apis/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}`;
    try {
      const [fields, records, views] = await Promise.all([
        fetchPagedItems<Record<string, unknown>>(client, `${basePath}/fields`, 200),
        fetchPagedItems<Record<string, unknown>>(client, `${basePath}/records`, 500),
        fetchPagedItems<Record<string, unknown>>(client, `${basePath}/views`, 200),
      ]);
      tableData.push({
        tableId,
        tableName: tableNameFromMeta(tableMeta),
        fields,
        records,
        views,
      });
    } catch (error) {
      warnings.push({
        type: 'partial-data',
        blockId: sourceBlockId,
        blockType: 'bitable',
        message: `多维表格「${tableNameFromMeta(tableMeta) || tableId}」数据拉取失败：${error instanceof Error ? error.message : '未知错误'}`,
      });
    }
  }

  return {
    source,
    sourceBlockId,
    appToken,
    preferredTableId,
    preferredViewId,
    tables,
    tableData,
  };
}

function collectRootBlockIds(blocks: FeishuRawBlock[]) {
  const containedChildren = new Set(blocks.flatMap(block => block.children || []));
  return blocks
    .filter(block => !block.block_id || !containedChildren.has(block.block_id))
    .flatMap(block => (isPageBlock(block) && block.children?.length ? block.children : [getBlockId(block)]))
    .filter(Boolean);
}

function collectMediaRefs(blocks: FeishuRawBlock[], apiBaseUrl: string): FeishuRawMediaRef[] {
  const refs: FeishuRawMediaRef[] = [];
  blocks.forEach(block => {
    if (block.image?.token || block.image?.url) {
      refs.push({
        blockId: block.block_id,
        type: 'image',
        token: block.image.token,
        url: block.image.url,
        downloadUrl: block.image.token ? mediaDownloadUrl(apiBaseUrl, block.image.token) : undefined,
        source: 'document_block',
      });
    }
    const fileToken = block.file?.file_token || block.file?.token;
    if (fileToken || block.file?.name) {
      refs.push({
        blockId: block.block_id,
        type: 'file',
        token: fileToken,
        name: block.file?.name,
        mimeType: block.file?.mime_type,
        downloadUrl: fileToken ? mediaDownloadUrl(apiBaseUrl, fileToken) : undefined,
        source: 'document_block',
      });
    }
  });
  return refs;
}

function collectBitableAttachmentRefs(bitables: FeishuRawBitableData[], apiBaseUrl: string): FeishuRawMediaRef[] {
  const refs: FeishuRawMediaRef[] = [];

  function pushAttachmentRef(input: {
    tableId: string;
    recordId?: string;
    fieldName: string;
    attachment: Record<string, unknown>;
    index: number;
  }) {
    const { tableId, recordId, fieldName, attachment, index } = input;
    const token = String(attachment.file_token || attachment.token || attachment.fileToken || attachment.file_id || attachment.fileId || '').trim();
    const url = String(attachment.url || attachment.tmp_url || attachment.preview_url || '').trim();
    const name = String(attachment.name || attachment.file_name || attachment.fileName || `附件 ${index + 1}`);
    const mimeType = String(attachment.mime_type || attachment.mimeType || attachment.type || '');
    if (!token && !url && !name) return;
    refs.push({
      type: 'bitable-attachment',
      token: token || undefined,
      url: url || undefined,
      name,
      mimeType: mimeType || undefined,
      downloadUrl: token ? mediaDownloadUrl(apiBaseUrl, token) : url || undefined,
      source: 'bitable_record',
      tableId,
      recordId,
      fieldName,
    });
  }

  for (const bitable of bitables) {
    for (const table of bitable.tableData) {
      for (const record of table.records) {
        const recordId = String(record.record_id || record.id || '').trim() || undefined;
        const fields = record.fields && typeof record.fields === 'object' ? record.fields as Record<string, unknown> : {};
        for (const [fieldName, value] of Object.entries(fields)) {
          const values = Array.isArray(value) ? value : [value];
          values.forEach((item, index) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return;
            const attachment = item as Record<string, unknown>;
            const hasAttachmentShape = Boolean(
              attachment.file_token
                || attachment.token
                || attachment.fileToken
                || attachment.file_id
                || attachment.fileId
                || attachment.tmp_url
                || attachment.preview_url
                || attachment.mime_type
                || attachment.file_name,
            );
            if (hasAttachmentShape) {
              pushAttachmentRef({
                tableId: table.tableId,
                recordId,
                fieldName,
                attachment,
                index,
              });
            }
          });
        }
      }
    }
  }

  return refs;
}

function flattenTableCellIds(block: FeishuRawBlock): string[] {
  const cells = block.table?.cells;
  if (Array.isArray(cells)) {
    return (Array.isArray(cells[0]) ? (cells as string[][]).flat() : cells as string[])
      .filter(cell => typeof cell === 'string');
  }
  return (block.children || []).filter(Boolean);
}

function buildContentTree(
  rootBlockIds: string[],
  blockMap: Map<string, FeishuRawBlock>,
  warnings: FeishuRawFetchWarning[],
): FeishuRawBlockNode[] {
  function buildNode(blockId: string, ancestors: Set<string>): FeishuRawBlockNode | null {
    const block = blockMap.get(blockId);
    if (!block) {
      warnings.push({
        type: 'invalid-data',
        blockId,
        message: `飞书 block 引用了不存在的子 block：${blockId}`,
      });
      return null;
    }

    if (ancestors.has(blockId)) {
      warnings.push({
        type: 'invalid-data',
        blockId,
        blockType: String(block.block_type || ''),
        message: `飞书 block 树存在循环引用：${blockId}`,
      });
      return {
        blockId,
        block,
        children: [],
        missingChildIds: [],
        isCycle: true,
      };
    }

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(blockId);
    const missingChildIds: string[] = [];
    const children = (block.children || []).map(childId => {
      const child = buildNode(childId, nextAncestors);
      if (!child) missingChildIds.push(childId);
      return child;
    }).filter((child): child is FeishuRawBlockNode => Boolean(child));

    return {
      blockId,
      block,
      children,
      missingChildIds,
    };
  }

  return rootBlockIds.map(blockId => buildNode(blockId, new Set()))
    .filter((node): node is FeishuRawBlockNode => Boolean(node));
}

function countTreeNodes(nodes: FeishuRawBlockNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countTreeNodes(node.children), 0);
}

function countMissingChildRefs(nodes: FeishuRawBlockNode[]): number {
  return nodes.reduce(
    (sum, node) => sum + node.missingChildIds.length + countMissingChildRefs(node.children),
    0,
  );
}

function collectTreeBlockIds(nodes: FeishuRawBlockNode[], ids = new Set<string>()): Set<string> {
  nodes.forEach(node => {
    if (node.blockId) ids.add(node.blockId);
    collectTreeBlockIds(node.children, ids);
  });
  return ids;
}

function collectMissingChildIds(nodes: FeishuRawBlockNode[], ids = new Set<string>()): Set<string> {
  nodes.forEach(node => {
    node.missingChildIds.forEach(id => ids.add(id));
    collectMissingChildIds(node.children, ids);
  });
  return ids;
}

function collectBlockTypeCounts(blocks: FeishuRawBlock[]): Record<string, number> {
  return blocks.reduce<Record<string, number>>((counts, block) => {
    const key = String(block.block_type || 'unknown');
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function collectOrphanBlockIds(blocks: FeishuRawBlock[], contentTree: FeishuRawBlockNode[]): string[] {
  const treeBlockIds = collectTreeBlockIds(contentTree);
  return blocks
    .filter(block => block.block_id && !treeBlockIds.has(block.block_id) && !isPageBlock(block))
    .map(block => block.block_id!)
    .sort();
}

function collectTableDetails(
  blocks: FeishuRawBlock[],
  blockMap: Map<string, FeishuRawBlock>,
  warnings: FeishuRawFetchWarning[],
): FeishuRawTableDetail[] {
  return blocks
    .filter(block => block.table)
    .map(block => {
      const cellBlockIds = flattenTableCellIds(block);
      const rowSize = Number(block.table?.row_size || block.table?.property?.row_size || 0);
      const columnSize = Math.max(1, Number(block.table?.column_size || block.table?.property?.column_size || 0));
      const expectedCellCount = rowSize > 0 && columnSize > 0 ? rowSize * columnSize : cellBlockIds.length;
      const missingCellIds: string[] = [];
      const rows: FeishuRawTableCellContent[][] = [];
      const visibleCellIds = cellBlockIds.slice(0, Math.max(expectedCellCount, cellBlockIds.length));

      visibleCellIds.forEach((cellBlockId, index) => {
        const rowIndex = Math.floor(index / columnSize);
        const columnIndex = index % columnSize;
        const cellBlock = blockMap.get(cellBlockId);
        if (!cellBlock) {
          missingCellIds.push(cellBlockId);
          warnings.push({
            type: 'invalid-data',
            blockId: cellBlockId,
            blockType: 'table_cell',
            message: `表格 ${block.block_id || ''} 引用了不存在的单元格 block：${cellBlockId}`,
          });
        }
        const childNodes = cellBlock?.children?.length
          ? buildContentTree(cellBlock.children, blockMap, warnings)
          : [];
        if (!rows[rowIndex]) rows[rowIndex] = [];
        rows[rowIndex][columnIndex] = {
          rowIndex,
          columnIndex,
          cellBlockId,
          cellBlock,
          childNodes,
          rowSpan: Number(cellBlock?.table_cell?.row_span || 1),
          colSpan: Number(cellBlock?.table_cell?.col_span || 1),
          backgroundColor: cellBlock?.table_cell?.background_color,
          isMissing: !cellBlock,
        };
      });

      const overflowCellIds = expectedCellCount > 0 && cellBlockIds.length > expectedCellCount
        ? cellBlockIds.slice(expectedCellCount)
        : [];
      const isCompleteShape = expectedCellCount > 0
        ? cellBlockIds.length >= expectedCellCount && missingCellIds.length === 0
        : missingCellIds.length === 0;

      return {
        blockId: block.block_id,
        tableBlock: block,
        rowSize,
        columnSize,
        cellBlockIds,
        actualCellCount: cellBlockIds.length,
        isCompleteShape,
        rows,
        missingCellIds,
        overflowCellIds,
      };
    });
}

function summarizeTableDetails(tableDetails: FeishuRawTableDetail[]): FeishuRawTableSummary[] {
  return tableDetails.map(detail => ({
    blockId: detail.blockId,
    rowSize: detail.rowSize,
    columnSize: detail.columnSize,
    cellBlockIds: detail.cellBlockIds,
    actualCellCount: detail.actualCellCount,
    isCompleteShape: detail.isCompleteShape,
  }));
}

async function downloadMediaAsset(
  mediaRef: FeishuRawMediaRef,
  token: string,
  maxMediaBytes: number,
): Promise<FeishuRawMediaAsset> {
  const requestUrl = mediaRef.downloadUrl || mediaRef.url;
  if (!requestUrl) {
    return {
      ...mediaRef,
      status: 'skipped',
      error: '缺少可下载 URL',
    };
  }

  try {
    const response = await fetch(requestUrl, {
      headers: mediaRef.token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > maxMediaBytes) {
      return {
        ...mediaRef,
        status: 'skipped',
        contentType: response.headers.get('content-type') || undefined,
        byteLength: contentLength,
        error: `媒体资源超过限制 ${maxMediaBytes} bytes`,
      };
    }
    if (!response.ok) {
      return {
        ...mediaRef,
        status: 'failed',
        contentType: response.headers.get('content-type') || undefined,
        error: `媒体资源下载失败 (${response.status})`,
      };
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxMediaBytes) {
      return {
        ...mediaRef,
        status: 'skipped',
        contentType: response.headers.get('content-type') || undefined,
        byteLength: arrayBuffer.byteLength,
        error: `媒体资源超过限制 ${maxMediaBytes} bytes`,
      };
    }
    return {
      ...mediaRef,
      status: 'downloaded',
      contentType: response.headers.get('content-type') || mediaRef.mimeType,
      byteLength: arrayBuffer.byteLength,
      data: Buffer.from(arrayBuffer),
    };
  } catch (error) {
    return {
      ...mediaRef,
      status: 'failed',
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

async function downloadMediaAssets(
  client: FeishuApiClient,
  mediaRefs: FeishuRawMediaRef[],
  maxMediaBytes: number,
  warnings: FeishuRawFetchWarning[],
): Promise<FeishuRawMediaAsset[]> {
  const token = await client.getTenantAccessToken();
  const assets = await Promise.all(mediaRefs.map(ref => downloadMediaAsset(ref, token, maxMediaBytes)));
  assets.forEach(asset => {
    if (asset.status !== 'downloaded') {
      warnings.push({
        type: 'asset',
        blockId: asset.blockId,
        blockType: asset.type,
        message: `${asset.type === 'image' ? '图片' : '附件'}资源未完整下载：${asset.error || '未知错误'}`,
      });
    }
  });
  return assets;
}

async function collectDocumentBitables(
  client: FeishuApiClient,
  blocks: FeishuRawBlock[],
  target: FeishuResolvedTarget,
  warnings: FeishuRawFetchWarning[],
): Promise<FeishuRawBitableData[]> {
  const bitables: FeishuRawBitableData[] = [];

  for (const block of blocks) {
    if (block.bitable) {
      let appToken = block.bitable.app_token?.trim() || '';
      let tableId = block.bitable.table_id?.trim();
      const parsedToken = parseBitableToken(block.bitable.token);
      if (!appToken && parsedToken) appToken = parsedToken.appToken;
      if (!tableId && parsedToken?.tableId) tableId = parsedToken.tableId;
      if (block.bitable.fields?.length && block.bitable.records) {
        const data = await fetchBitableAppData({
          client,
          appToken: appToken || block.bitable.token?.trim() || `inline_${block.block_id || 'bitable'}`,
          source: 'document_block',
          sourceBlockId: block.block_id,
          preferredTableId: tableId || block.block_id,
          preferredViewId: target.viewId,
          inlineFields: block.bitable.fields,
          inlineRecords: block.bitable.records,
          inlineViews: block.bitable.views,
          warnings,
        });
        if (data) bitables.push(data);
        continue;
      }
      if (!appToken) {
        warnings.push({
          type: 'invalid-data',
          blockId: block.block_id,
          blockType: 'bitable',
          message: '多维表格块缺少 app_token/token，无法继续拉取完整数据。',
        });
        continue;
      }
      const data = await fetchBitableAppData({
        client,
        appToken,
        source: 'document_block',
        sourceBlockId: block.block_id,
        preferredTableId: tableId,
        preferredViewId: target.viewId,
        inlineFields: block.bitable.fields,
        inlineRecords: block.bitable.records,
        inlineViews: block.bitable.views,
        warnings,
      });
      if (data) bitables.push(data);
    }

    if (block.reference_base?.token) {
      const parsedToken = parseBitableToken(block.reference_base.token);
      if (!parsedToken) continue;
      const data = await fetchBitableAppData({
        client,
        appToken: parsedToken.appToken,
        source: 'reference_base',
        sourceBlockId: block.block_id,
        preferredTableId: parsedToken.tableId,
        preferredViewId: block.reference_base.view_id || target.viewId,
        warnings,
      });
      if (data) bitables.push(data);
    }
  }

  return bitables;
}

function buildStats(input: {
  blocks: FeishuRawBlock[];
  rootBlockIds: string[];
  contentTree: FeishuRawBlockNode[];
  orphanBlockIds: string[];
  bitables: FeishuRawBitableData[];
  mediaRefs: FeishuRawMediaRef[];
  mediaAssets?: FeishuRawMediaAsset[];
  tableSummaries: FeishuRawTableSummary[];
}): FeishuRawFetchStats {
  const tableData = input.bitables.flatMap(bitable => bitable.tableData);
  const downloadedMediaCount = input.mediaAssets?.filter(asset => asset.status === 'downloaded').length || 0;
  const failedMediaCount = input.mediaAssets?.filter(asset => asset.status === 'failed').length || 0;
  return {
    blockCount: input.blocks.length,
    rootBlockCount: input.rootBlockIds.length,
    bitableAppCount: input.bitables.length,
    bitableTableCount: tableData.length,
    bitableFieldCount: tableData.reduce((sum, table) => sum + table.fields.length, 0),
    bitableRecordCount: tableData.reduce((sum, table) => sum + table.records.length, 0),
    bitableViewCount: tableData.reduce((sum, table) => sum + table.views.length, 0),
    mediaCount: input.mediaRefs.length,
    downloadedMediaCount,
    failedMediaCount,
    tableBlockCount: input.tableSummaries.length,
    treeNodeCount: countTreeNodes(input.contentTree),
    missingChildRefCount: countMissingChildRefs(input.contentTree),
    orphanBlockCount: input.orphanBlockIds.length,
  };
}

function buildCompletenessReport(input: {
  target: FeishuResolvedTarget;
  blocks: FeishuRawBlock[];
  contentTree: FeishuRawBlockNode[];
  bitables: FeishuRawBitableData[];
  mediaRefs: FeishuRawMediaRef[];
  mediaAssets?: FeishuRawMediaAsset[];
  tableDetails: FeishuRawTableDetail[];
  warnings: FeishuRawFetchWarning[];
  downloadMedia: boolean;
}): FeishuRawCompletenessReport {
  const orphanBlockIds = collectOrphanBlockIds(input.blocks, input.contentTree);
  const missingChildIds = Array.from(collectMissingChildIds(input.contentTree)).sort();
  const incompleteTableBlockIds = input.tableDetails
    .filter(table => !table.isCompleteShape || table.missingCellIds.length > 0)
    .map(table => table.blockId || '')
    .filter(Boolean);
  const incompleteBitableSources = input.bitables
    .filter(bitable => bitable.tableData.length === 0 || bitable.tableData.some(table =>
      table.fields.length === 0 || table.views.length === 0))
    .map(bitable => ({
      source: bitable.source,
      sourceBlockId: bitable.sourceBlockId,
      appToken: bitable.appToken,
    }));
  const downloadedCount = input.mediaAssets?.filter(asset => asset.status === 'downloaded').length || 0;
  const failedCount = input.mediaAssets?.filter(asset => asset.status === 'failed').length || 0;
  const skippedCount = input.mediaAssets?.filter(asset => asset.status === 'skipped').length || 0;
  const notDownloadedCount = input.downloadMedia ? 0 : input.mediaRefs.length;
  const missing: string[] = [];
  const notes: string[] = [
    '所有飞书返回的原始 block JSON 均保存在 document.blocks/blockMap，未知 block 字段不会被过滤。',
    'contentTree 按 children 递归组装，tableDetails 会继续展开普通表格单元格内的子 block。',
  ];

  if (input.target.type !== 'docx' && input.target.type !== 'doc' && input.target.type !== 'bitable' && input.target.type !== 'unknown') {
    missing.push(`目标类型 ${input.target.type} 暂未展开完整正文数据`);
  }
  if (input.blocks.length > 0 && input.contentTree.length === 0) missing.push('文档 blocks 已返回，但未能构建正文树');
  if (orphanBlockIds.length > 0) missing.push(`存在 ${orphanBlockIds.length} 个未挂入正文树的孤儿 block`);
  if (missingChildIds.length > 0) missing.push(`存在 ${missingChildIds.length} 个缺失的 child block 引用`);
  if (incompleteTableBlockIds.length > 0) missing.push(`存在 ${incompleteTableBlockIds.length} 个表格结构不完整`);
  if (incompleteBitableSources.length > 0) missing.push(`存在 ${incompleteBitableSources.length} 个多维表格未拉全 fields/views`);
  if (input.mediaRefs.length > 0 && !input.downloadMedia) {
    missing.push(`存在 ${input.mediaRefs.length} 个媒体/附件资源只收集了引用，尚未下载二进制`);
  }
  if (failedCount > 0 || skippedCount > 0) {
    missing.push(`存在 ${failedCount + skippedCount} 个媒体/附件资源未成功下载`);
  }
  input.warnings.forEach(warning => {
    if (warning.type === 'partial-data' || warning.type === 'invalid-data' || warning.type === 'unsupported-target') {
      missing.push(warning.message);
    }
  });

  const uniqueMissing = Array.from(new Set(missing));
  return {
    isComplete: uniqueMissing.length === 0,
    missing: uniqueMissing,
    warnings: input.warnings.map(warning => warning.message),
    notes,
    blockTypeCounts: collectBlockTypeCounts(input.blocks),
    orphanBlockIds,
    missingChildIds,
    incompleteTableBlockIds,
    incompleteBitableSources,
    media: {
      expectedCount: input.mediaRefs.length,
      downloadedCount,
      failedCount,
      skippedCount,
      notDownloadedCount,
    },
    coverage: {
      rawBlocksPreserved: true,
      contentTreeBuilt: input.blocks.length === 0 || input.contentTree.length > 0,
      tableCellsExpanded: incompleteTableBlockIds.length === 0,
      bitableDataFetched: incompleteBitableSources.length === 0,
      mediaRefsCollected: true,
      mediaBinariesDownloaded: input.mediaRefs.length === 0 || (input.downloadMedia && downloadedCount === input.mediaRefs.length),
    },
  };
}

export async function fetchFeishuRawDocumentData(
  sourceUrl: string,
  options: FetchFeishuRawDocumentOptions = {},
): Promise<FeishuRawDocumentData> {
  const config = options.config || getFeishuApiConfigFromEnv();
  if (!options.client && !config) {
    throw new Error('缺少飞书 Open API 配置，请传入 config 或设置 FEISHU_APP_ID / FEISHU_APP_SECRET');
  }

  const client = options.client || createFeishuApiClient(config!);
  const apiBaseUrl = config?.baseUrl || DEFAULT_BASE_URL;
  const parsedUrl = parseFeishuUrl(sourceUrl);
  const warnings: FeishuRawFetchWarning[] = [];
  const target = await resolveDocumentTarget(client, parsedUrl, warnings);
  const tenantAccessToken = options.includeTenantAccessToken ? await client.getTenantAccessToken() : undefined;

  let blocks: FeishuRawBlock[] = [];
  let rootBlockIds: string[] = [];
  let contentTree: FeishuRawBlockNode[] = [];
  let bitables: FeishuRawBitableData[] = [];

  if (target.type === 'bitable') {
    const standalone = await fetchBitableAppData({
      client,
      appToken: target.token,
      source: 'standalone',
      preferredTableId: target.tableId,
      preferredViewId: target.viewId,
      warnings,
    });
    if (standalone) bitables = [standalone];
  } else if (target.type === 'docx' || target.type === 'doc' || target.type === 'unknown') {
    blocks = await fetchAllDocumentBlocks(client, target.token);
    rootBlockIds = collectRootBlockIds(blocks);
    const treeBlockMap = new Map(blocks.filter(block => block.block_id).map(block => [block.block_id!, block]));
    contentTree = buildContentTree(rootBlockIds, treeBlockMap, warnings);
    bitables = await collectDocumentBitables(client, blocks, target, warnings);
  } else {
    warnings.push({
      type: 'unsupported-target',
      message: `当前原始数据模块暂不展开 ${target.type} 类型对象，只返回链接解析和目标信息。`,
    });
  }

  const blockMap = Object.fromEntries(blocks.filter(block => block.block_id).map(block => [block.block_id!, block]));
  const tableBlockMap = new Map(blocks.filter(block => block.block_id).map(block => [block.block_id!, block]));
  const tableDetails = collectTableDetails(blocks, tableBlockMap, warnings);
  const tableSummaries = summarizeTableDetails(tableDetails);
  const mediaRefs = [
    ...collectMediaRefs(blocks, apiBaseUrl),
    ...collectBitableAttachmentRefs(bitables, apiBaseUrl),
  ];
  const mediaAssets = options.downloadMedia
    ? await downloadMediaAssets(
        client,
        mediaRefs,
        options.maxMediaBytes || DEFAULT_MAX_MEDIA_BYTES,
        warnings,
      )
    : undefined;
  const orphanBlockIds = collectOrphanBlockIds(blocks, contentTree);
  const stats = buildStats({
    blocks,
    rootBlockIds,
    contentTree,
    orphanBlockIds,
    bitables,
    mediaRefs,
    mediaAssets,
    tableSummaries,
  });
  const completeness = buildCompletenessReport({
    target,
    blocks,
    contentTree,
    bitables,
    mediaRefs,
    mediaAssets,
    tableDetails,
    warnings,
    downloadMedia: Boolean(options.downloadMedia),
  });

  return {
    sourceUrl,
    parsedUrl,
    target,
    tenantAccessToken,
    document: blocks.length ? { blocks, rootBlockIds, blockMap, contentTree } : undefined,
    bitables,
    mediaRefs,
    mediaAssets,
    tableSummaries,
    tableDetails,
    completeness,
    warnings,
    stats,
  };
}
