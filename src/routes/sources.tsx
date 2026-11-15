import { createFileRoute } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import { getSources } from '../lib/server/get-sources'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'

export const Route = createFileRoute('/sources')({
  component: SourcesPage,
  loader: async () => {
    // @ts-ignore - Server function typing
    return await getSources()
  },
})

function SourcesPage() {
  const sources = Route.useLoaderData()
  const enabledSources = sources.filter((s) => s.enabled)
  const disabledSources = sources.filter((s) => !s.enabled)

  return (
    <div className="py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Event Sources</h1>
        <p className="text-gray-400 mb-8">
          We aggregate events from {enabledSources.length} trusted sources across Bangalore
        </p>

        {/* Active Sources */}
        <div className="space-y-3 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Active Sources</h2>
          {enabledSources.map((source) => (
            <Card key={source.id} className="hover:border-slate-600 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-lg">{source.name}</CardTitle>
                  <Badge variant="secondary" className="shrink-0">Active</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <a
                  href={source.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  {source.website}
                </a>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Inactive Sources */}
        {disabledSources.length > 0 && (
          <div className="space-y-3 mb-8">
            <h2 className="text-2xl font-semibold mb-4">Inactive Sources</h2>
            {disabledSources.map((source) => (
              <Card key={source.id} className="opacity-60">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="text-lg">{source.name}</CardTitle>
                    <Badge variant="outline" className="shrink-0">Inactive</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <a
                    href={source.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-400 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {source.website}
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Contact */}
        <Card className="bg-slate-800/30">
          <CardContent className="pt-6">
            <p className="text-sm text-gray-400">
              Missing a source? Contact us at{' '}
              <a
                href="mailto:contact@oh8oh.com"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                contact@oh8oh.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
