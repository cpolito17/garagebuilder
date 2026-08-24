import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const preview = spawn(npm, ['run', 'preview', '--', '--port', '4211'], { stdio: 'inherit' });

async function ready() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:4211/');
      if (response.ok) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Preview server did not become ready');
}

try {
  await ready();
  const capture = spawn(process.execPath, ['scripts/og-default.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, URL: 'http://127.0.0.1:4211/' },
  });
  const code = await new Promise((resolve) => capture.once('exit', resolve));
  if (code !== 0) process.exitCode = typeof code === 'number' ? code : 1;
} finally {
  preview.kill('SIGTERM');
}
