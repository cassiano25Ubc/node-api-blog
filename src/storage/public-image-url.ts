export function toPublicImageUrl(relativePath: string | null): string | null {
  if (!relativePath) {
    return null;
  }

  const encodedPath = relativePath
    .split(/[\\/]/)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `/uploads/${encodedPath}`;
}
