/** Prefix for all FitCheck outfit images in Blob storage (used by upload + gallery list). */
export const FITCHECK_BLOB_PREFIX = "fitcheck/";

export function userAlbumPrefix(userId: string) {
  return `${FITCHECK_BLOB_PREFIX}users/${userId}/`;
}
