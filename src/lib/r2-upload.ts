/**
 * R2 Image Upload Handler
 *
 * This file handles image uploads to Cloudflare R2 bucket.
 *
 * Setup Instructions:
 * 1. Create an R2 bucket in your Cloudflare dashboard
 * 2. Get your R2 credentials:
 *    - Account ID
 *    - Access Key ID
 *    - Secret Access Key
 *    - Bucket Name
 * 3. Add to .env file:
 *    R2_ACCOUNT_ID=your_account_id
 *    R2_ACCESS_KEY_ID=your_access_key_id
 *    R2_SECRET_ACCESS_KEY=your_secret_access_key
 *    R2_BUCKET_NAME=your_bucket_name
 *    R2_PUBLIC_URL=https://your-bucket.r2.dev (or custom domain)
 * 4. Install AWS SDK: npm install @aws-sdk/client-s3
 * 5. Uncomment the code below
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { nanoid } from 'nanoid'

const R2_CONFIG = {
  accountId: process.env.R2_ACCOUNT_ID || '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  bucketName: process.env.R2_BUCKET_NAME || '',
  publicUrl: process.env.R2_PUBLIC_URL || '',
}

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_CONFIG.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey,
  },
})

/**
 * Upload an image to R2 bucket
 * @param file - The image file to upload (as Buffer or Uint8Array)
 * @param fileName - Original file name
 * @param contentType - MIME type (e.g., 'image/jpeg', 'image/png')
 * @returns Public URL of the uploaded image
 */
export async function uploadImageToR2(
  file: Buffer | Uint8Array,
  fileName: string,
  contentType: string
): Promise<string> {
  try {
    // Generate unique filename
    const extension = fileName.split('.').pop() || 'jpg'
    const uniqueFileName = `events/${nanoid()}.${extension}`

    const command = new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: uniqueFileName,
      Body: file,
      ContentType: contentType,
      // Make object publicly accessible
      // Note: Ensure your R2 bucket has public access configured
    })

    await s3Client.send(command)

    // Return public URL
    return `${R2_CONFIG.publicUrl}/${uniqueFileName}`
  } catch (error) {
    console.error('Failed to upload image to R2:', error)
    throw new Error('Image upload failed')
  }
}

/**
 * Delete an image from R2 bucket
 * @param imageUrl - Full URL of the image to delete
 */
export async function deleteImageFromR2(imageUrl: string): Promise<void> {
  try {
    // Extract key from URL
    const key = imageUrl.replace(`${R2_CONFIG.publicUrl}/`, '')

    const command = new DeleteObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
    })

    await s3Client.send(command)
  } catch (error) {
    console.error('Failed to delete image from R2:', error)
    throw new Error('Image deletion failed')
  }
}

/**
 * Validate image file
 * @param file - File to validate
 * @returns Validation result
 */
export function validateImageFile(file: File): {
  valid: boolean
  error?: string
} {
  const maxSize = 5 * 1024 * 1024 // 5MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
    }
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size exceeds 5MB limit.',
    }
  }

  return { valid: true }
}
