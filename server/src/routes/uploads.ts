import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const uploadDir = path.resolve(__dirname, '..', '..', 'public', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
});

router.post('/', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ code: -1, message: '未选择文件' });
    }
    res.status(201).json({
      code: 0,
      data: {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        url: `/static/uploads/${req.file.filename}`,
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: -1, message: err.message });
  }
});

export default router;
