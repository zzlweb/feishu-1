import express from 'express';
import cors from 'cors';
import path from 'path';
import documentsRouter from './routes/documents';
import uploadsRouter from './routes/uploads';

const app = express();
const PORT = Number(process.env.PORT || 3005);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/static', express.static(path.resolve(__dirname, '..', 'public')));

// Routes
app.use('/api/documents', documentsRouter);
app.use('/api/uploads', uploadsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 飞书文档服务器已启动: http://localhost:${PORT}`);
  });
}

export default app;
