import { describe, expect, it } from 'vitest';
import { withOpenverseCredentials } from './lib/openverse-env';

describe('Openverse local credential storage', () => {
  it('preserves unrelated settings and replaces old credentials', () => {
    expect(withOpenverseCredentials(
      'OTHER=value\nOPENVERSE_CLIENT_ID=old\nOPENVERSE_CLIENT_SECRET=old-secret\n',
      'new-id',
      'new-secret',
    )).toBe('OTHER=value\nOPENVERSE_CLIENT_ID=new-id\nOPENVERSE_CLIENT_SECRET=new-secret\n');
  });
});
