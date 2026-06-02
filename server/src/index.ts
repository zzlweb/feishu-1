import appModule from './app';

const app = (appModule as any).default ?? appModule;

const PORT = Number(process.env.PORT || 3000);

if (process.platform === 'win32') {
  process.stdout.setDefaultEncoding?.('utf8');
  process.stderr.setDefaultEncoding?.('utf8');
}

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
