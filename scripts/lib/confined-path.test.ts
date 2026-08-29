import { describe, expect, it } from 'vitest';
import { posix, win32 } from 'node:path';
import { confinedPath } from './confined-path';

describe('confinedPath', () => {
  const windowsRoot = 'C:\\repo\\public\\vehicles';
  const posixRoot = '/repo/public/vehicles';

  it.each([
    ['plain Windows filename', windowsRoot, 'mazda-mx5-nc-1.jpg', win32, 'C:\\repo\\public\\vehicles\\mazda-mx5-nc-1.jpg'],
    ['nested Windows filename', windowsRoot, 'archive\\car.jpg', win32, 'C:\\repo\\public\\vehicles\\archive\\car.jpg'],
    ['plain POSIX filename', posixRoot, 'mazda-mx5-nc-1.jpg', posix, '/repo/public/vehicles/mazda-mx5-nc-1.jpg'],
    ['nested POSIX filename', posixRoot, 'archive/car.jpg', posix, '/repo/public/vehicles/archive/car.jpg'],
  ])('allows a %s', (_label, root, request, pathApi, expected) => {
    expect(confinedPath(root, request, pathApi)).toBe(expected);
  });

  it.each([
    ['Windows parent traversal', windowsRoot, '..\\secret.jpg', win32],
    ['Windows nested traversal', windowsRoot, 'archive\\..\\..\\secret.jpg', win32],
    ['Windows sibling-prefix path', windowsRoot, '..\\vehicles-private\\secret.jpg', win32],
    ['Windows absolute path', windowsRoot, 'D:\\secret.jpg', win32],
    ['POSIX parent traversal', posixRoot, '../secret.jpg', posix],
    ['POSIX sibling-prefix path', posixRoot, '../vehicles-private/secret.jpg', posix],
    ['the root itself', posixRoot, '.', posix],
  ])('rejects a %s', (_label, root, request, pathApi) => {
    expect(confinedPath(root, request, pathApi)).toBeNull();
  });
});
