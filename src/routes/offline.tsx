import { createFileRoute } from '@tanstack/react-router'
import { WifiOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

export const Route = createFileRoute('/offline')({
  component: OfflinePage,
})

function OfflinePage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <WifiOff className="h-16 w-16 text-zinc-500" />
          </div>
          <CardTitle className="text-3xl">You're Offline</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-400">
            It looks like you've lost your internet connection. Don't worry, you can still browse events you've viewed before.
          </p>
          <p className="text-gray-400">
            Once you're back online, we'll automatically sync the latest events for you.
          </p>
          <div className="pt-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
