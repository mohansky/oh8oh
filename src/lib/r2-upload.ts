/**
 * R2 Image Upload Handler
 *
 * Uses Cloudflare's native R2 binding for Workers compatibility.
 * The R2 bucket is bound via wrangler.toml as "R2".
 */

import { nanoid } from 'nanoid'
import type { R2Bucket } from '@cloudflare/workers-types'

// R2 public URL - set this to your R2 public bucket URL or custom domain
function getR2PublicUrl() {
  return process.env.R2_PUBLIC_URL || (globalThis as any).__env__?.R2_PUBLIC_URL || ''
}

/**
 * Upload an image to R2 bucket using native Cloudflare R2 binding
 * @param r2 - The R2 bucket binding from Cloudflare env
 * @param file - The image file to upload (as ArrayBuffer or Uint8Array)
 * @param fileName - Original file name
 * @param contentType - MIME type (e.g., 'image/jpeg', 'image/png')
 * @returns Public URL of the uploaded image
 */
export async function uploadImageToR2(
  r2: R2Bucket,
  file: ArrayBuffer | Uint8Array,
  fileName: string,
  contentType: string
): Promise<string> {
  try {
    // Generate unique filename
    const extension = fileName.split('.').pop() || 'jpg'
    const uniqueFileName = `events/${nanoid()}.${extension}`

    // Upload using native R2 binding
    await r2.put(uniqueFileName, file, {
      httpMetadata: {
        contentType,
      },
    })

    // Return public URL
    return getR2PublicUrl() ? `${getR2PublicUrl()}/${uniqueFileName}` : uniqueFileName
  } catch (error) {
    console.error('Failed to upload image to R2:', error)
    throw new Error('Image upload failed')
  }
}

/**
 * Delete an image from R2 bucket
 * @param r2 - The R2 bucket binding from Cloudflare env
 * @param imageUrl - Full URL of the image to delete
 */
export async function deleteImageFromR2(r2: R2Bucket, imageUrl: string): Promise<void> {
  try {
    // Extract key from URL
    const key = getR2PublicUrl() ? imageUrl.replace(`${getR2PublicUrl()}/`, '') : imageUrl

    await r2.delete(key)
  } catch (error) {
    console.error('Failed to delete image from R2:', error)
    throw new Error('Image deletion failed')
  }
}
