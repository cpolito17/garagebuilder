import { mkdir, rm, writeFile } from 'node:fs/promises';

await rm('public/vehicles', { recursive: true, force: true });
await mkdir('src/data/generated', { recursive: true });
await writeFile('src/data/generated/images.json', '{}\n');
