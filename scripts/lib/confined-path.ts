import * as nodePath from 'node:path';

type PathApi = Pick<typeof nodePath, 'isAbsolute' | 'relative' | 'resolve' | 'sep'>;

/**
 * Resolve a requested file beneath root, or return null when it escapes.
 *
 * path.relative supplies the containment check using the same platform rules
 * that resolved the path, so Windows separators and drive letters are handled
 * correctly without comparing slash-dependent string prefixes.
 */
export function confinedPath(
  root: string,
  requestedPath: string,
  pathApi: PathApi = nodePath,
): string | null {
  const resolvedRoot = pathApi.resolve(root);
  const candidate = pathApi.resolve(resolvedRoot, requestedPath);
  const relative = pathApi.relative(resolvedRoot, candidate);

  if (
    relative === '' ||
    relative === '..' ||
    relative.startsWith(`..${pathApi.sep}`) ||
    pathApi.isAbsolute(relative)
  ) {
    return null;
  }

  return candidate;
}
