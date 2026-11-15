import { useEffect } from 'react'
import { toast } from 'sonner'

export function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return

    // Dynamically import PWA register to avoid SSR issues
    import('virtual:pwa-register/react')
      .then(() => {
        // We do manual service-worker registration below (not the hook)
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', () => {
            navigator.serviceWorker
              .register('/sw.js', { scope: '/' })
              .then((registration) => {
                console.log('Service Worker registered:', registration)

                // Check for updates
                registration.addEventListener('updatefound', () => {
                  const newWorker = registration.installing
                  if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        toast('New version available!', {
                          description: 'Click to update to the latest version.',
                          action: {
                            label: 'Update',
                            onClick: () => {
                              newWorker.postMessage({ type: 'SKIP_WAITING' })
                              window.location.reload()
                            },
                          },
                          duration: Infinity,
                        })
                      }
                    })
                  }
                })
              })
              .catch((error) => {
                console.error('Service Worker registration failed:', error)
              })
          })
        }
      })
      .catch(() => {
        // PWA register not available, skip
        console.log('PWA features not available in development')
      })
  }, [])

  return <>{children}</>
}
