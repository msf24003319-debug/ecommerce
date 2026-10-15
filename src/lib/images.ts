/** Normalize local public-directory paths without altering remote Storage URLs. */
export function getImageUrl(url: string | null | undefined): string {
  if (!url || !url.trim()) return "/placeholder.svg";
  const normalized = url.replace(/^\/?public\//, "/");
  return normalized === "/" ? "/placeholder.svg" : normalized;
}
