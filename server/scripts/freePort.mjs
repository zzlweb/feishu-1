import { execSync } from 'node:child_process';

const port = Number(process.argv[2] || process.env.PORT || 3000);

function freePortOnWindows() {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const pids = new Set();

    for (const line of output.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts.at(-1);
      if (pid && pid !== '0') pids.add(pid);
    }

    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`已释放端口 ${port}（结束 PID ${pid}）`);
      } catch {
        // 进程可能已退出
      }
    }
  } catch {
    // 端口未被占用
  }
}

function freePortOnUnix() {
  try {
    const output = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
    for (const pid of output.trim().split('\n').filter(Boolean)) {
      try {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        console.log(`已释放端口 ${port}（结束 PID ${pid}）`);
      } catch {
        // 进程可能已退出
      }
    }
  } catch {
    // 端口未被占用
  }
}

if (process.platform === 'win32') freePortOnWindows();
else freePortOnUnix();
