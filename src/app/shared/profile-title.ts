export function formatProfileTitle(title: string): string {
  return title.replace(/\bfront[ -]end developer\b/gi, 'Front-End Engineer');
}
