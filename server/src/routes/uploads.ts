import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { decodeUploadedFilename } from '../encoding';

const router = Router();
const uploadDir = path.resolve(__dirname, '..', '..', 'public', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const original = decodeUploadedFilename(file.originalname || '');
    const ext = path.extname(original || '');
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
});

function uploadErrorMessage(err: unknown): string {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return '文件大小超过 200MB 限制';
    if (err.code === 'LIMIT_UNEXPECTED_FILE') return '上传字段无效';
    return '文件上传失败';
  }
  if (err instanceof Error && err.message) return err.message;
  return '文件上传失败';
}

router.post('/', (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ code: -1, message: uploadErrorMessage(err) });
    }
    next();
  });
}, (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ code: -1, message: '未选择文件' });
    }
    const name = decodeUploadedFilename(req.file.originalname || req.file.filename);
    res.status(201).json({
      code: 0,
      data: {
        name,
        size: req.file.size,
        type: req.file.mimetype,
        url: `/static/uploads/${req.file.filename}`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '文件上传失败';
    res.status(500).json({ code: -1, message });
  }
});

export default router;
