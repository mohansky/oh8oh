import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils' // shadcn cn utility

interface ImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  fill?: boolean
  sizes?: string
  quality?: number
  priority?: boolean
  className?: string
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  onLoad?: () => void
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
}

/**
 * Optimized Image component for TanStack Start using vite-imagetools
 * 
 * Features:
 * - Lazy loading (unless priority is true)
 * - Responsive images with srcset
 * - Blur placeholder support
 * - WebP/AVIF format support
 * - Automatic aspect ratio preservation
 * - Similar API to Next.js Image
 */
export function Image({
  src,
  alt,
  width,
  height,
  fill = false,
  sizes = '100vw',
  quality = 75,
  priority = false,
  className,
  objectFit = 'cover',
  onLoad,
  onError,
  placeholder = 'empty',
  blurDataURL,
}: ImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isInView, setIsInView] = useState(priority)
  const imgRef = useRef<HTMLDivElement>(null)

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !imgRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '50px',
      }
    )

    observer.observe(imgRef.current)

    return () => {
      observer.disconnect()
    }
  }, [priority])

  const handleLoad = () => {
    setIsLoading(false)
    onLoad?.()
  }

  // Generate responsive widths for srcset
  const responsiveWidths = width
    ? [width, width * 2] // 1x and 2x for fixed sizes
    : [640, 750, 828, 1080, 1200, 1920, 2048, 3840] // Standard breakpoints

  // Build image URLs with vite-imagetools query params
  // Note: In actual use, you'd import images with these queries
  // Example: import hero from './hero.jpg?w=640;750;828&format=webp'
  const buildSrcSet = (format: 'webp' | 'jpg') => {
    const widths = responsiveWidths.join(';')
    return `${src}?w=${widths}&format=${format}&quality=${quality}&as=srcset`
  }

  const buildSrc = () => {
    const w = width || 1200
    return `${src}?w=${w}&format=jpg&quality=${quality}`
  }

  const blurDataUrl =
    blurDataURL || (placeholder === 'blur' ? `${src}?w=10&blur=20` : undefined)

  // Container styles for fill mode
  const containerStyles = fill
    ? {
        position: 'relative' as const,
        width: '100%',
        height: '100%',
      }
    : {
        position: 'relative' as const,
        width: width ? `${width}px` : undefined,
        height: height ? `${height}px` : undefined,
      }

  // Image styles
  const imageStyles = fill
    ? {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit,
      }
    : {
        width: '100%',
        height: 'auto',
        objectFit,
      }

  return (
    <div
      ref={imgRef}
      style={containerStyles}
      className={cn('overflow-hidden', className)}
    >
      {/* Blur placeholder */}
      {placeholder === 'blur' && blurDataUrl && isLoading && (
        <img
          src={blurDataUrl}
          alt=""
          aria-hidden="true"
          style={{
            ...imageStyles,
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
          }}
          className="absolute inset-0 z-0"
        />
      )}

      {/* Main image - only render when in view or priority */}
      {isInView && (
        <picture>
          {/* AVIF format - best compression */}
          <source
            type="image/avif"
            srcSet={buildSrcSet('webp')} // vite-imagetools can handle avif too
            sizes={sizes}
          />

          {/* WebP format - fallback */}
          <source
            type="image/webp"
            srcSet={buildSrcSet('webp')}
            sizes={sizes}
          />

          {/* JPEG fallback */}
          <img
            src={buildSrc()}
            alt={alt}
            width={width}
            height={height}
            loading={priority ? 'eager' : 'lazy'}
            decoding={priority ? 'sync' : 'async'}
            onLoad={handleLoad}
            onError={onError}
            style={imageStyles}
            className={cn(
              'transition-opacity duration-300',
              isLoading ? 'opacity-0' : 'opacity-100',
              fill && 'absolute inset-0'
            )}
          />
        </picture>
      )}

      {/* Loading skeleton */}
      {isLoading && placeholder === 'empty' && (
        <div
          className="absolute inset-0 bg-muted animate-pulse"
          style={imageStyles}
        />
      )}
    </div>
  )
}

// Utility component for background images
export function ImageBackground({
  src,
  alt = '',
  children,
  className,
  ...props
}: ImageProps & { children?: React.ReactNode }) {
  return (
    <div className={cn('relative', className)}>
      <Image {...props} src={src} alt={alt} fill objectFit="cover" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}