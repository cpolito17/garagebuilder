/** Register this local image tool for Openverse's batch-friendly API limits. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { withOpenverseCredentials } from './lib/openverse-env';

const REGISTER_URL = 'https://api.openverse.org/v1/auth_tokens/register/';
const ENV_FILE = '.env.local';
const args = process.argv.slice(2);
const emailIndex = args.indexOf('--email');
const email = emailIndex >= 0 ? args[emailIndex + 1]?.trim() : undefined;

async function main() {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Usage: npm run images:openverse -- --email you@example.com');
    console.error('Openverse requires an email when registering an API client.');
    process.exit(1);
  }

  const res = await fetch(REGISTER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Garage Challenge image reviewer',
      description: 'Find freely licensed vehicle photography for local visual review.',
      email,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Openverse registration ${res.status} ${res.statusText}: ${detail.slice(0, 500)}`);
  }
  const json = await res.json() as { client_id?: string; client_secret?: string };
  if (!json.client_id || !json.client_secret) throw new Error('Openverse registration returned no credentials');

  const existing = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
  writeFileSync(ENV_FILE, withOpenverseCredentials(existing, json.client_id, json.client_secret));
  console.log(`Openverse credentials saved to ${ENV_FILE} (which is ignored by Git).`);
  console.log('The image fetcher will now authenticate automatically.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
