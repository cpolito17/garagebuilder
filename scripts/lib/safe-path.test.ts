import { describe, it, expect } from 'vitest';
import { posix, win32 } from 'node:path';
import { resolveInside } from './safe-path';

/**
 * Both platforms are tested explicitly. The bug this covers was invisible on
 * Linux and total on Windows: every image 404'd because the containment check
 * compared a backslash path against a forward-slash prefix.
 */
describe('confining a served file to one directory', () => {
  describe.each([
    ['posix', posix, '/repo/public/vehicles'],
    ['win32', win32, 'D:\\repo\\public\\vehicles'],
  ] as const)('on %s', (_name, p, root) => {
    it('resolves an ordinary filename inside the root', () => {
      const got = resolveInside(root, 'mazda-mx5-nc-1.jpg', p);
      expect(got).toBe(p.join(root, 'mazda-mx5-nc-1.jpg'));
    });

    it('resolves a name with an @2x suffix', () => {
      expect(resolveInside(root, 'mazda-mx5-nc-0@2x.jpg', p)).not.toBeNull();
    });

    it('refuses traversal out of the root', () => {
      expect(resolveInside(root, '../images.json', p)).toBeNull();
      expect(resolveInside(root, '../../src/data/generated/images.json', p)).toBeNull();
      expect(resolveInside(root, 'a/../../../etc/passwd', p)).toBeNull();
    });

    it('refuses an absolute path', () => {
      expect(resolveInside(root, p === win32 ? 'C:\\Windows\\win.ini' : '/etc/passwd', p)).toBeNull();
    });

    it('refuses a sibling directory that merely shares the prefix', () => {
      // "public/vehicles-old" starts with "public/vehicles" as a string.
      expect(resolveInside(root, '../vehicles-old/x.jpg', p)).toBeNull();
    });
  });

  it('accepts a relative root, which is how the server holds it', () => {
    // The server's root is the literal string "public/vehicles".
    expect(resolveInside('public/vehicles', 'car.jpg', win32))
      .toBe(win32.join(win32.resolve('public/vehicles'), 'car.jpg'));
    expect(resolveInside('public/vehicles', '../../secret', win32)).toBeNull();
  });
});
