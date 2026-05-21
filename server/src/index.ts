import express from 'express';
import cors from 'cors';
import path from 'path';
import documentsRouter from './routes/documents';
import uploadsRouter from './routes/uploads';

const app = express();
const PORT = Number(process.env.PORT || 3000);

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
  let server = app.listen(PORT, () => {
    console.log(`🚀 飞书文档服务器已启动: http://localhost:${PORT}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ 端口 ${PORT} 已被占用，无法启动后端。`);
      console.error(`   可执行: npm run free-port  或  netstat -ano | findstr :${PORT}`);
      process.exit(1);
    }
    throw err;
  });

  const shutdown = () => {
    if (!server.listening) {
      process.exit(0);
      return;
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 800).unref();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGUSR2', shutdown);
}

export default app;
