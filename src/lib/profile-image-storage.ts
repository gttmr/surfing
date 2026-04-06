import { Storage } from "@google-cloud/storage";

const PROFILE_IMAGE_PROXY_PREFIX = "/api/profile/avatar/file/";

let storageClient: Storage | null = null;

function getStorageClient() {
  if (!storageClient) {
    storageClient = new Storage();
  }
  return storageClient;
}

export function getGcsProfileImageBucketName() {
  return process.env.GCS_PROFILE_IMAGE_BUCKET?.trim() ?? "";
}

export function hasGcsProfileImageBucket() {
  return !!getGcsProfileImageBucketName();
}

function getGcsProfileImageBucket() {
  const bucketName = getGcsProfileImageBucketName();
  if (!bucketName) {
    throw new Error("GCS_PROFILE_IMAGE_BUCKET is not configured");
  }

  return getStorageClient().bucket(bucketName);
}

export function buildProfileImageObjectName(kakaoId: string, extension: string) {
  return `profiles/${kakaoId}/${Date.now()}.${extension}`;
}

export function buildProfileImageProxyUrl(objectName: string) {
  return `${PROFILE_IMAGE_PROXY_PREFIX}${objectName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

export function extractProfileImageObjectName(url: string) {
  if (!url.startsWith(PROFILE_IMAGE_PROXY_PREFIX)) return null;

  return url
    .slice(PROFILE_IMAGE_PROXY_PREFIX.length)
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

export function isGcsProfileImageUrl(url: string) {
  return extractProfileImageObjectName(url) !== null;
}

export async function saveGcsProfileImage(objectName: string, file: File) {
  const bucket = getGcsProfileImageBucket();
  const buffer = Buffer.from(await file.arrayBuffer());

  await bucket.file(objectName).save(buffer, {
    resumable: false,
    contentType: file.type,
    metadata: {
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  return {
    pathname: objectName,
    url: buildProfileImageProxyUrl(objectName),
  };
}

export async function deleteGcsProfileImageByUrl(url: string) {
  const objectName = extractProfileImageObjectName(url);
  if (!objectName) return;

  await getGcsProfileImageBucket().file(objectName).delete({ ignoreNotFound: true });
}

export async function readGcsProfileImage(objectName: string) {
  const file = getGcsProfileImageBucket().file(objectName);
  const [exists] = await file.exists();
  if (!exists) return null;

  const [[buffer], [metadata]] = await Promise.all([file.download(), file.getMetadata()]);

  return {
    buffer,
    contentType: metadata.contentType ?? "application/octet-stream",
    cacheControl: metadata.cacheControl ?? "public, max-age=3600",
    etag: metadata.etag ?? undefined,
  };
}
