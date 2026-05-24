import express from 'express';
import cors from 'cors';
import path from 'path';
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

export default app;
