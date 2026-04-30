import express from 'express';
import cors from 'cors';
import documentsRouter from './routes/documents';

const app = express();
const PORT = Number(process.env.PORT || 3005);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/documents', documentsRouter);

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
