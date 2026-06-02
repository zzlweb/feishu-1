import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import documentsRouter from './routes/documents';
import uploadsRouter from './routes/uploads';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/static', express.static(path.resolve(__dirname, '..', 'public')));

app.use('/api/documents', documentsRouter);
app.use('/api/uploads', uploadsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? '文件大小超过 200MB 限制' : '文件上传失败';
    res.status(400).json({ code: -1, message });
    return;
  }
  const message = err instanceof Error ? err.message : '服务器错误';
  res.status(500).json({ code: -1, message });
});

export default app;
