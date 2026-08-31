export function withOpenverseCredentials(existing: string, clientId: string, clientSecret: string): string {
  const lines = existing.split(/\r?\n/).filter((line) =>
    !line.startsWith('OPENVERSE_CLIENT_ID=')
    && !line.startsWith('OPENVERSE_CLIENT_SECRET='));
  while (lines.at(-1) === '') lines.pop();
  return [
    ...lines,
    `OPENVERSE_CLIENT_ID=${clientId}`,
    `OPENVERSE_CLIENT_SECRET=${clientSecret}`,
    '',
  ].join('\n');
}
