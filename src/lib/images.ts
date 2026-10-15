/** Normalize local public paths and this store's public Storage endpoint. */
export function getImageUrl(url: string | null | undefined): string {
  if (!url || !url.trim()) return "/placeholder.svg";
  // Supabase's public endpoint needs this segment; it is not a local folder.
  if (
    /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/product-images\//.test(
      url,
    )
  ) {
    return url.replace(
      "/storage/v1/object/product-images/",
      "/storage/v1/object/public/product-images/",
    );
  }
  const normalized = url.replace(/^\/?public\//, "/");
  return normalized === "/" ? "/placeholder.svg" : normalized;
}
