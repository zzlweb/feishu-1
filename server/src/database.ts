import fs from 'fs';
import path from 'path';

export interface DocumentRecord {
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
  collapsed_heading_ids: string[];
}

export interface CommentRecord {
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

export interface TemplateRecord {
  id: string;
  title: string;
  content: string;
  author: string;
  created_at: string;
}

interface Database {
  documents: DocumentRecord[];
  comments: CommentRecord[];
  templates: TemplateRecord[];
}

function getDbPath() {
  return process.env.FEISHU_DOC_DB_PATH || path.join(__dirname, '..', 'data', 'db.json');
}

function getDefaultTemplates(): TemplateRecord[] {
  const baseTime = new Date().getTime();
  const t = (offsetSeconds: number) => new Date(baseTime - offsetSeconds * 1000).toISOString();
  return [
    {
      id: 'tpl-personal-summary',
      title: '个人总结',
      author: '系统',
      created_at: t(0),
      content: `<h1>📝 个人阶段总结</h1><p>回顾过去一期的工作，总结经验，反思不足，规划未来。</p><h3>🌟 工作业绩与核心贡献</h3><table class="feishu-table" style="min-width: 600px;"><colgroup><col style="width: 150px;"><col><col style="width: 100px;"></colgroup><tbody><tr><th class="feishu-table__header-cell" colspan="1" rowspan="1"><p>关键任务</p></th><th class="feishu-table__header-cell" colspan="1" rowspan="1"><p>完成情况与成果</p></th><th class="feishu-table__header-cell" colspan="1" rowspan="1"><p>自我评分</p></th></tr><tr><td class="feishu-table__cell" colspan="1" rowspan="1"><p>核心项目 A</p></td><td class="feishu-table__cell" colspan="1" rowspan="1"><p>按时交付，数据提升 20%</p></td><td class="feishu-table__cell" colspan="1" rowspan="1"><p>⭐⭐⭐⭐⭐</p></td></tr><tr><td class="feishu-table__cell" colspan="1" rowspan="1"><p>日常运营</p></td><td class="feishu-table__cell" colspan="1" rowspan="1"><p>优化了工作流，减少 30% 耗时</p></td><td class="feishu-table__cell" colspan="1" rowspan="1"><p>⭐⭐⭐⭐</p></td></tr></tbody></table><h3>🔍 反思与待改进点</h3><ul><li>时间管理上需要更合理地安排优先级。</li><li>跨部门协作时应更早进行沟通对齐。</li></ul><h3>🚀 下一阶段工作规划</h3><ol><li>全力保障项目 B 的顺利上线。</li><li>持续优化系统性能与用户体验。</li></ol>`
    },
    {
      id: 'tpl-reading-notes',
      title: '读书笔记',
      author: '系统',
      created_at: t(1),
      content: `<h1>📚 读书笔记</h1><p>在此记录你阅读书籍后的收获、思考与行动指南。</p><div class="feishu-columns-node" data-local-block="columns"><div class="feishu-columns-block__col-wrap" data-width-ratio="50" data-local-column="true"><div class="feishu-columns-block__col"><h3>💡 核心观点</h3><ul><li>核心观点 1</li><li>核心观点 2</li></ul></div></div><div class="feishu-columns-block__col-wrap" data-width-ratio="50" data-local-column="true"><div class="feishu-columns-block__col"><h3>✍️ 金句摘录</h3><blockquote>“这里是书中让你产生强烈共鸣的一句话。”</blockquote></div></div></div><h3>🎯 行动清单</h3><ul data-type="taskList"><li data-block-id="task-reading-1" id="task-reading-1" data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>转化书中知识，制定个人的具体行动步骤</p></div></li></ul>`
    },
    {
      id: 'tpl-swot-analysis',
      title: 'SWOT 分析思维导图',
      author: '系统',
      created_at: t(2),
      content: `<h1>📊 SWOT 战略分析</h1><p>通过优势、劣势、机会和威胁四个维度，系统性评估业务现状及战略决策。</p><div class="feishu-columns-node" data-local-block="columns"><div class="feishu-columns-block__col-wrap" data-width-ratio="50" data-local-column="true"><div class="feishu-columns-block__col" style="background-color: #f6ffed; padding: 12px; border-radius: 6px; border: 1px solid #b7eb8f; margin-bottom: 12px;"><h3 style="color: #389e0d;">S (Strengths) 优势</h3><ul><li>成熟的研发技术团队</li><li>行业领先的品牌效应</li></ul></div></div><div class="feishu-columns-block__col-wrap" data-width-ratio="50" data-local-column="true"><div class="feishu-columns-block__col" style="background-color: #fff2e8; padding: 12px; border-radius: 6px; border: 1px solid #ffbb96; margin-bottom: 12px;"><h3 style="color: #d4380d;">W (Weaknesses) 劣势</h3><ul><li>产品推广渠道较为单一</li><li>用户流失率略高于行业平均</li></ul></div></div></div><div class="feishu-columns-node" data-local-block="columns"><div class="feishu-columns-block__col-wrap" data-width-ratio="50" data-local-column="true"><div class="feishu-columns-block__col" style="background-color: #e6f7ff; padding: 12px; border-radius: 6px; border: 1px solid #91d5ff;"><h3 style="color: #096dd9;">O (Opportunities) 机会</h3><ul><li>出海市场空间广阔</li><li>行业政策大力支持</li></ul></div></div><div class="feishu-columns-block__col-wrap" data-width-ratio="50" data-local-column="true"><div class="feishu-columns-block__col" style="background-color: #fff1f0; padding: 12px; border-radius: 6px; border: 1px solid #ffa39e;"><h3 style="color: #cf1322;">T (Threats) 威胁</h3><ul><li>同质化竞争对手迅速崛起</li><li>行业准入规范不断收紧</li></ul></div></div></div>`
    },
    {
      id: 'tpl-work-report',
      title: '工作汇报',
      author: '系统',
      created_at: t(3),
      content: `<h1>📊 周/月工作汇报</h1><p>定期向团队 and Leader 汇报工作进展、成果及后续安排。</p><h3>📅 本期已完成工作</h3><ul data-type="taskList"><li data-block-id="task-work-1" id="task-work-1" data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>上线并部署新版本模块</p></div></li><li data-block-id="task-work-2" id="task-work-2" data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>组织并完成团队跨部门对齐会议</p></div></li></ul><h3>🔄 进行中工作与关键阻碍</h3><ul><li><strong>进度：</strong>正在进行高并发性能优化，目前测试通过率 90%。</li><li><strong>阻碍：</strong>需要更高级别的资源审批以完成压测。</li></ul><h3>🎯 下期规划与重点关注</h3><ol><li>全面完成新架构的重构与灰度发布。</li><li>编写上线发布说明及相关文档。</li></ol>`
    },
    {
      id: 'tpl-meeting-minutes',
      title: '会议记录',
      author: '系统',
      created_at: t(4),
      content: `<h1>📅 会议记录</h1><p>高效记录会议基本信息、核心议程、结论及后续待办事项。</p><div class="feishu-columns-node" data-local-block="columns"><div class="feishu-columns-block__col-wrap" data-width-ratio="50" data-local-column="true"><div class="feishu-columns-block__col"><p><strong>会议时间：</strong>2026-05-24</p><p><strong>参会人员：</strong>张正亮、李四、王五</p></div></div><div class="feishu-columns-block__col-wrap" data-width-ratio="50" data-local-column="true"><div class="feishu-columns-block__col"><p><strong>会议主题：</strong>核心项目进度沟通</p><p><strong>会议主持人：</strong>张正亮</p></div></div></div><h3>🎯 核心议题与讨论要点</h3><ul><li><strong>议题一：</strong>项目第一阶段的交付时间对齐。</li><li><strong>议题二：</strong>解决当前联调测试中的接口协议问题。</li></ul><h3>✅ 会议结论与决议</h3><blockquote>各方达成一致，将接口联调截止日期延长 2 天，发布时间维持原计划不变。</blockquote><h3>📝 任务指派与跟踪</h3><ul data-type="taskList"><li data-block-id="task-meeting-1" id="task-meeting-1" data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p><strong>@李四</strong> 重新设计接口协议并完成代码生成</p></div></li><li data-block-id="task-meeting-2" id="task-meeting-2" data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p><strong>@王五</strong> 准备部署环境 and 数据库脚本</p></div></li></ul>`
    }
  ];
}

function loadDb(): Database {
  const dbPath = getDbPath();
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      const db = JSON.parse(raw);
      if (!db.templates || db.templates.length === 0) {
        db.templates = getDefaultTemplates();
        saveDb(db);
      }
      return db;
    }
  } catch { /* ignore */ }
  const defaultDb = { documents: [], comments: [], templates: getDefaultTemplates() };
  saveDb(defaultDb);
  return defaultDb;
}

function saveDb(db: Database) {
  const dbPath = getDbPath();
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
}

function nowStr() {
  return new Date().toISOString();
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0)));
}

// ---- Documents ----

export function getAllDocuments(): DocumentRecord[] {
  const db = loadDb();
  return db.documents
    .filter(d => d.is_template === 0)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export function getDocumentById(id: string): DocumentRecord | undefined {
  const db = loadDb();
  return db.documents.find(d => d.id === id);
}

export function createDocumentRecord(doc: Partial<DocumentRecord> & { id: string }): DocumentRecord {
  const db = loadDb();
  const now = nowStr();
  const newDoc: DocumentRecord = {
    id: doc.id,
    title: doc.title ?? '',
    content: doc.content || '',
    author: doc.author || '张正亮',
    created_at: now,
    updated_at: now,
    is_template: 0,
    parent_id: doc.parent_id || null,
    cover_url: doc.cover_url || '',
    icon: doc.icon || '',
    collapsed_heading_ids: normalizeStringList(doc.collapsed_heading_ids),
  };
  db.documents.push(newDoc);
  saveDb(db);
  return newDoc;
}

export function updateDocumentRecord(id: string, updates: Partial<DocumentRecord>): DocumentRecord | undefined {
  const db = loadDb();
  const idx = db.documents.findIndex(d => d.id === id);
  if (idx === -1) return undefined;
  const doc = db.documents[idx];
  if (updates.title !== undefined) doc.title = updates.title;
  if (updates.content !== undefined) doc.content = updates.content;
  if (updates.icon !== undefined) doc.icon = updates.icon;
  if (updates.cover_url !== undefined) doc.cover_url = updates.cover_url;
  if (updates.parent_id !== undefined) doc.parent_id = updates.parent_id;
  if (updates.collapsed_heading_ids !== undefined) {
    doc.collapsed_heading_ids = normalizeStringList(updates.collapsed_heading_ids);
  }
  doc.updated_at = nowStr();
  db.documents[idx] = doc;
  saveDb(db);
  return doc;
}

export function deleteDocumentById(id: string): boolean {
  const db = loadDb();
  const before = db.documents.length;
  db.documents = db.documents.filter(d => d.id !== id);
  db.comments = db.comments.filter(c => c.document_id !== id);
  saveDb(db);
  return db.documents.length < before;
}

// ---- Comments ----

export function getCommentsByDocId(docId: string): CommentRecord[] {
  const db = loadDb();
  return db.comments
    .filter(c => c.document_id === docId)
    .map(c => ({
      ...c,
      block_id: c.block_id || '',
      thread_id: c.thread_id || c.block_id || c.id,
      message_id: c.message_id || c.id,
      status: c.status || (c.resolved ? 'resolved' : 'open'),
      visibility: c.visibility || 'public',
      updated_at: c.updated_at || c.created_at,
    }))
    .sort((a, b) => Number(a.resolved) - Number(b.resolved) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export function createCommentRecord(comment: CommentRecord): CommentRecord {
  const db = loadDb();
  db.comments.push(comment);
  saveDb(db);
  return comment;
}

export function updateCommentRecord(commentId: string, updates: Partial<CommentRecord>): CommentRecord | undefined {
  const db = loadDb();
  const idx = db.comments.findIndex(c => c.id === commentId);
  if (idx === -1) return undefined;
  const comment = db.comments[idx];
  if (updates.content !== undefined) comment.content = updates.content;
  if (updates.resolved !== undefined) {
    comment.resolved = updates.resolved;
    comment.status = updates.resolved ? 'resolved' : 'open';
    comment.resolved_at = updates.resolved ? nowStr() : '';
    comment.resolved_by = updates.resolved ? (updates.resolved_by || comment.resolved_by || comment.author) : '';
  }
  if (updates.status !== undefined) comment.status = updates.status;
  if (updates.visibility !== undefined) comment.visibility = updates.visibility;
  if (updates.anchor_json !== undefined) comment.anchor_json = updates.anchor_json;
  if (updates.quote !== undefined) comment.quote = updates.quote;
  if (updates.deleted_at !== undefined) comment.deleted_at = updates.deleted_at;
  if (updates.is_edited !== undefined) comment.is_edited = updates.is_edited;
  comment.updated_at = nowStr();
  db.comments[idx] = comment;
  saveDb(db);
  return { ...comment, block_id: comment.block_id || '', updated_at: comment.updated_at || comment.created_at };
}

export function deleteCommentRecord(docId: string, commentId: string): boolean {
  const db = loadDb();
  const idx = db.comments.findIndex(c => c.id === commentId && c.document_id === docId);
  if (idx === -1) return false;
  db.comments.splice(idx, 1);
  saveDb(db);
  return true;
}

// ---- Templates ----

export function getAllTemplates(): TemplateRecord[] {
  const db = loadDb();
  return db.templates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function createTemplateRecord(template: TemplateRecord): TemplateRecord {
  const db = loadDb();
  db.templates.push(template);
  saveDb(db);
  return template;
}
