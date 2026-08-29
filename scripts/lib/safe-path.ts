/**
 * Just the members this needs, so the same code can be handed node's `path`,
 * `path.posix` or `path.win32` without depending on a type name that has moved
 * between @types/node versions.
 */
export type PathApi = {
  isAbsolute: (p: string) => boolean;
  resolve: (...parts: string[]) => string;
  sep: string;
};

/**
 * Confining a served file to one directory, on either platform.
 *
 * Extracted and made platform-explicit because the obvious version is wrong on
 * Windows and right on Linux, which is the worst way for a bug to behave. The
 * first attempt joined with a forward-slash directory and checked
 * `startsWith('public/vehicles')`; on Windows `join` returns
 * `public\\vehicles\\...`, the check never matched, and every image 404'd on
 * the one machine that mattered while passing every test here.
 *
 * Resolving both sides first removes the question: separators, `.` segments,
 * `..` traversal and relative roots are all normalised before comparison.
 */
export function resolveInside(root: string, name: string, p: PathApi): string | null {
  // An absolute or drive-qualified name would escape the root through
  // resolve's own semantics rather than through any `..`, so refuse it here.
  if (p.isAbsolute(name)) return null;

  const base = p.resolve(root);
  const target = p.resolve(base, name);

  // The trailing separator matters: without it, a sibling directory whose name
  // merely starts with the root's would pass.
  return target === base || target.startsWith(base + p.sep) ? target : null;
}
