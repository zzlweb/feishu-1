import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllDocuments,
  getDocumentById,
  createDocumentRecord,
  updateDocumentRecord,
  deleteDocumentById,
  getCommentsByDocId,
  createCommentRecord,
  updateCommentRecord,
  deleteCommentRecord,
  getAllTemplates,
  createTemplateRecord,
  deleteTemplateById,
} from '../database';
import { importDocumentFile } from '../documentImporter';
import { importFeishuPublicUrl } from '../feishuPublicImporter';

const router = Router();
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

// GET /api/documents - 获取文档列表
router.get('/', (_req: Request, res: Response) => {
  try {
    const docs = getAllDocuments();
    res.json({ code: 0, data: docs });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// GET /api/documents/templates/list - 获取模板列表
router.get('/templates/list', (_req: Request, res: Response) => {
  try {
    const templates = getAllTemplates();
    res.json({ code: 0, data: templates });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// POST /api/documents/templates - 创建模板
router.post('/templates', (req: Request, res: Response) => {
  try {
    const { title = '未命名模板', content = '<p></p>', author = '张正亮' } = req.body;
    const trimmedTitle = String(title).trim() || '未命名模板';
    const template = createTemplateRecord({
      id: uuidv4(),
      title: trimmedTitle,
      content: String(content || '<p></p>'),
      author: String(author || '张正亮'),
      created_at: new Date().toISOString(),
    });
    res.status(201).json({ code: 0, data: template });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// GET /api/documents/:id - 获取单个文档
// POST /api/documents/import-url - import a public Feishu wiki URL as an editable document.
router.post('/import-url', async (req: Request, res: Response) => {
  try {
    const { url, author, save_as_template: saveAsTemplate } = req.body ?? {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ code: -1, message: '请输入飞书文档链接' });
    }

    const imported = await importFeishuPublicUrl(url.trim());
    const doc = createDocumentRecord({
      id: uuidv4(),
      title: imported.title,
      content: imported.content,
      author: String(author || '导入用户'),
      icon: imported.coverUrl ? '📘' : '📄',
      cover_url: imported.coverUrl || '',
      read_only: 0,
      import_metadata: imported.importMetadata ? JSON.stringify(imported.importMetadata) : '',
    });

    let template = null;
    if (saveAsTemplate) {
      template = createTemplateRecord({
        id: uuidv4(),
        title: imported.title,
        content: imported.content,
        author: String(author || '导入用户'),
        created_at: new Date().toISOString(),
      });
    }

    res.status(201).json({
      code: 0,
      data: {
        document: doc,
        template,
        source_name: imported.sourceName,
        source_url: imported.sourceUrl,
        asset_count: imported.assetCount,
        warnings: imported.warnings,
        import_quality: imported.importQuality,
        unsupported_blocks: imported.unsupportedBlocks,
        import_metadata: imported.importMetadata,
      },
    });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : '导入失败';
    res.status(400).json({ code: -1, message });
  }
});

// POST /api/documents/import - import Feishu-exported HTML/Markdown/TXT/ZIP as an editable document.
router.post('/import', importUpload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ code: -1, message: '未选择文件' });
    }
    const imported = await importDocumentFile(req.file);
    const doc = createDocumentRecord({
      id: uuidv4(),
      title: imported.title,
      content: imported.content,
      author: String(req.body.author || '导入用户'),
      icon: '📄',
      read_only: 0,
      import_metadata: imported.importMetadata ? JSON.stringify(imported.importMetadata) : '',
    });
    res.status(201).json({
      code: 0,
      data: {
        document: doc,
        source_name: imported.sourceName,
        asset_count: imported.assetCount,
        warnings: imported.warnings,
        import_quality: imported.importQuality,
        unsupported_blocks: imported.unsupportedBlocks,
        import_metadata: imported.importMetadata,
      },
    });
  } catch (err: any) {
    const message = err instanceof Error ? err.message : '导入失败';
    res.status(400).json({ code: -1, message });
  }
});

// DELETE /api/documents/templates/:templateId - delete a saved template
router.delete('/templates/:templateId', (req: Request, res: Response) => {
  try {
    const success = deleteTemplateById(req.params.templateId);
    if (!success) {
      return res.status(404).json({ code: -1, message: '模板不存在' });
    }
    res.json({ code: 0, message: '删除成功' });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const doc = getDocumentById(req.params.id);
    if (!doc) {
      return res.status(404).json({ code: -1, message: '文档不存在' });
    }
    res.json({ code: 0, data: doc });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// POST /api/documents - 创建文档
router.post('/', (req: Request, res: Response) => {
  try {
    const id = uuidv4();
    const { title, content, author, parent_id, icon } = req.body;
    const doc = createDocumentRecord({ id, title, content, author, parent_id, icon });
    res.status(201).json({ code: 0, data: doc });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// PUT /api/documents/:id - 更新文档
router.put('/:id', (req: Request, res: Response) => {
  try {
    const doc = updateDocumentRecord(req.params.id, req.body);
    if (!doc) {
      return res.status(404).json({ code: -1, message: '文档不存在' });
    }
    res.json({ code: 0, data: doc });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// DELETE /api/documents/:id - 删除文档
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const success = deleteDocumentById(req.params.id);
    if (!success) {
      return res.status(404).json({ code: -1, message: '文档不存在' });
    }
    res.json({ code: 0, message: '删除成功' });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// POST /api/documents/:id/duplicate - 复制文档
router.post('/:id/duplicate', (req: Request, res: Response) => {
  try {
    const original = getDocumentById(req.params.id);
    if (!original) {
      return res.status(404).json({ code: -1, message: '文档不存在' });
    }
    const newId = uuidv4();
    const doc = createDocumentRecord({
      id: newId,
      title: original.title + ' (副本)',
      content: original.content,
      author: original.author,
      parent_id: original.parent_id,
      icon: original.icon,
      cover_url: original.cover_url,
      collapsed_heading_ids: original.collapsed_heading_ids,
    });
    res.status(201).json({ code: 0, data: doc });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// POST /api/documents/:id/children - 在当前文档下创建子文档
router.post('/:id/children', (req: Request, res: Response) => {
  try {
    const parent = getDocumentById(req.params.id);
    if (!parent) {
      return res.status(404).json({ code: -1, message: '父文档不存在' });
    }
    const id = uuidv4();
    const { title = '未命名子文档', content = '<p></p>', author = parent.author, icon = '📄' } = req.body;
    const doc = createDocumentRecord({
      id,
      title: String(title).trim() || '未命名子文档',
      content: String(content || '<p></p>'),
      author: String(author || parent.author || '张正亮'),
      parent_id: parent.id,
      icon: String(icon || '📄'),
    });
    res.status(201).json({ code: 0, data: doc });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// POST /api/documents/:id/to-child - 转换为子文档
router.post('/:id/to-child', (req: Request, res: Response) => {
  try {
    const { parent_id } = req.body;
    const doc = updateDocumentRecord(req.params.id, { parent_id });
    if (!doc) {
      return res.status(404).json({ code: -1, message: '文档不存在' });
    }
    res.json({ code: 0, data: doc });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// ---- Comments ----

// GET /api/documents/:id/comments
router.get('/:id/comments', (req: Request, res: Response) => {
  try {
    const blockId = typeof req.query.block_id === 'string' ? req.query.block_id : '';
    const comments = getCommentsByDocId(req.params.id)
      .filter(comment => !blockId || comment.block_id === blockId);
    res.json({ code: 0, data: comments });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// POST /api/documents/:id/comments
router.post('/:id/comments', (req: Request, res: Response) => {
  try {
    const id = uuidv4();
    const { content, author = '张正亮', block_id = '', position_from = 0, position_to = 0 } = req.body;
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ code: -1, message: '评论内容不能为空' });
    }
    const now = new Date().toISOString();
    const comment = createCommentRecord({
      id,
      document_id: req.params.id,
      block_id,
      content: content.trim(),
      author,
      position_from,
      position_to,
      created_at: now,
      updated_at: now,
      resolved: 0,
    });
    res.status(201).json({ code: 0, data: comment });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// PATCH /api/documents/:id/comments/:commentId
router.patch('/:id/comments/:commentId', (req: Request, res: Response) => {
  try {
    const updates: any = {};
    if (req.body.content !== undefined) {
      const t = String(req.body.content).trim();
      if (!t) {
        return res.status(400).json({ code: -1, message: '评论内容不能为空' });
      }
      updates.content = t;
    }
    if (req.body.resolved !== undefined) updates.resolved = req.body.resolved ? 1 : 0;
    const comment = updateCommentRecord(req.params.commentId, updates);
    if (!comment || comment.document_id !== req.params.id) {
      return res.status(404).json({ code: -1, message: '评论不存在' });
    }
    res.json({ code: 0, data: comment });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// DELETE /api/documents/:id/comments/:commentId
router.delete('/:id/comments/:commentId', (req: Request, res: Response) => {
  try {
    const ok = deleteCommentRecord(req.params.id, req.params.commentId);
    if (!ok) {
      return res.status(404).json({ code: -1, message: '评论不存在' });
    }
    res.json({ code: 0, message: '删除成功' });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// ---- Templates ----

// POST /api/documents/:id/save-as-template
router.post('/:id/save-as-template', (req: Request, res: Response) => {
  try {
    const doc = getDocumentById(req.params.id);
    if (!doc) {
      return res.status(404).json({ code: -1, message: '文档不存在' });
    }
    const templateId = uuidv4();
    const template = createTemplateRecord({
      id: templateId,
      title: doc.title,
      content: doc.content,
      author: doc.author,
      created_at: new Date().toISOString(),
    });
    res.status(201).json({ code: 0, data: template });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

export default router;
