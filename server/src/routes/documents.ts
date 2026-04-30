import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllDocuments,
  getDocumentById,
  createDocumentRecord,
  updateDocumentRecord,
  deleteDocumentById,
  getCommentsByDocId,
  createCommentRecord,
  getAllTemplates,
  createTemplateRecord,
} from '../database';

const router = Router();

// GET /api/documents - 获取文档列表
router.get('/', (_req: Request, res: Response) => {
  try {
    const docs = getAllDocuments();
    res.json({ code: 0, data: docs });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// GET /api/documents/:id - 获取单个文档
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
    const comments = getCommentsByDocId(req.params.id);
    res.json({ code: 0, data: comments });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// POST /api/documents/:id/comments
router.post('/:id/comments', (req: Request, res: Response) => {
  try {
    const id = uuidv4();
    const { content, author = '张正亮', position_from, position_to } = req.body;
    const comment = createCommentRecord({
      id,
      document_id: req.params.id,
      content,
      author,
      position_from,
      position_to,
      created_at: new Date().toISOString(),
      resolved: 0,
    });
    res.status(201).json({ code: 0, data: comment });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

// ---- Templates ----

// GET /api/templates
router.get('/templates/list', (_req: Request, res: Response) => {
  try {
    const templates = getAllTemplates();
    res.json({ code: 0, data: templates });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

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
