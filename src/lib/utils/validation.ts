/**
 * Shared input-validation helpers for user-supplied and scraped content.
 */

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB

/**
 * True only for absolute http(s) URLs. Blocks `javascript:`, `data:`, `file:`,
 * and other schemes that are dangerous when rendered as an href.
 */
export function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Returns the URL if it is a safe http(s) link, otherwise a harmless fallback.
 * Use when rendering links whose origin we do not control (scraped events).
 */
export function safeExternalUrl(value: string | null | undefined): string {
  return isSafeHttpUrl(value) ? (value as string) : '#'
}

export interface DecodedImage {
  bytes: Uint8Array
  contentType: string
  /** A safe filename derived from the content type — never from user input. */
  fileName: string
}

/**
 * Validate and decode a base64 data-URL image submitted by a client.
 * Enforces the MIME allowlist and 5MB size cap *before* rendering into memory,
 * and derives the stored extension from the content type rather than the
 * attacker-controlled original filename. Throws on any violation.
 */
export function decodeAndValidateImage(
  imageData: string,
  imageType: string,
): DecodedImage {
  if (!ALLOWED_IMAGE_TYPES.includes(imageType)) {
    throw new Error('Invalid image type. Only JPEG, PNG, and WebP are allowed.')
  }

  const base64Data = imageData.includes(',')
    ? imageData.slice(imageData.indexOf(',') + 1)
    : imageData

  if (!base64Data) {
    throw new Error('Invalid image data.')
  }

  // Cheaply reject oversized payloads before allocating: base64 encodes 3 bytes
  // per 4 chars, so decoded length ≈ len * 3/4.
  const approxBytes = Math.floor((base64Data.length * 3) / 4)
  if (approxBytes > MAX_IMAGE_BYTES) {
    throw new Error('Image exceeds the 5MB size limit.')
  }

  let binaryString: string
  try {
    binaryString = atob(base64Data)
  } catch {
    throw new Error('Invalid base64 image data.')
  }

  if (binaryString.length > MAX_IMAGE_BYTES) {
    throw new Error('Image exceeds the 5MB size limit.')
  }

  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  const extension = IMAGE_EXTENSIONS[imageType] || 'jpg'
  return { bytes, contentType: imageType, fileName: `image.${extension}` }
}
