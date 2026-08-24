import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const preview = spawn(npm, ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4200'], { stdio: 'inherit' });

async function ready() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch('http://127.0.0.1:4200/')).ok) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Preview server did not become ready');
}

try {
  await ready();
  const audit = spawn(process.execPath, ['scripts/audit.mjs'], { stdio: 'inherit' });
  const code = await new Promise((resolve) => audit.once('exit', resolve));
  if (code !== 0) process.exitCode = typeof code === 'number' ? code : 1;
} finally {
  preview.kill('SIGTERM');
}
