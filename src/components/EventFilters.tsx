// import { Input } from '@/components/ui/input'
import { RefreshCw, Search } from 'lucide-react'
import { Button } from './ui/button'
// import { Label } from './ui/label'
import { InputGroup, InputGroupAddon, InputGroupInput } from './ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

interface EventFiltersProps {
  filter: string
  setFilter: (value: string) => void
  sourceFilter: string
  setSourceFilter: (value: string) => void
  dateFilter: 'all' | 'today' | 'tomorrow' | 'weekend'
  setDateFilter: (value: 'all' | 'today' | 'tomorrow' | 'weekend') => void
  categoryFilter: string
  setCategoryFilter: (value: string) => void
  sources: Array<string>
  categories: Array<string>
  filteredCount: number
  totalCount: number
  showSourceFilter?: boolean
  cacheAge?: number
  onRefresh?: () => void
  isRefreshing?: boolean
  isAdmin?: boolean
}

export function EventFilters({
  filter,
  setFilter,
  sourceFilter,
  setSourceFilter,
  sources,
  showSourceFilter = true,
  dateFilter,
  setDateFilter,
  categoryFilter,
  setCategoryFilter,
  categories,
  filteredCount,
  totalCount,
  cacheAge,
  onRefresh,
  isRefreshing,
  isAdmin = false,
}: EventFiltersProps) {
  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Cache status and refresh button - Admin only */}
      {isAdmin && cacheAge !== undefined && onRefresh && (
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-muted-foreground">
            {cacheAge === 0 ? (
              <span>✨ Fresh data</span>
            ) : (
              <span>Last updated {cacheAge} {cacheAge === 1 ? 'minute' : 'minutes'} ago</span>
            )}
          </div>
          <Button
            onClick={onRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      )}

      {/* Search, Category and Source filters */}
      <div className="flex flex-wrap gap-4 mt-4">
        {/* Search */}
        <InputGroup className="flex-1 min-w-60">
          <InputGroupInput
          type="text"
            placeholder="Search by title or venue..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">{filteredCount}/{totalCount}</InputGroupAddon>
        </InputGroup>

        {/* Category Filter */}
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-45">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Source Filter */}
        {showSourceFilter && sources.length > 2 && (
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-45" aria-label="Filter by source">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              {sources.map((source) => (
                <SelectItem key={source} value={source}>
                  {source === 'all' ? 'All Sources' : source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Date Filter Buttons */}
      <div className="flex flex-wrap gap-4 mt-4">
        <Button
          onClick={() => setDateFilter('all')}
          variant={dateFilter === 'all' ? 'default' : 'outline'}
        >
          All
        </Button>
        <Button
          onClick={() => setDateFilter('today')}
          variant={dateFilter === 'today' ? 'default' : 'outline'}
        >
          Today
        </Button>
        <Button
          onClick={() => setDateFilter('tomorrow')}
          variant={dateFilter === 'tomorrow' ? 'default' : 'outline'}
        >
          Tomorrow
        </Button>
        <Button
          onClick={() => setDateFilter('weekend')}
          variant={dateFilter === 'weekend' ? 'default' : 'outline'}
        >
          This Weekend
        </Button>
      </div>

      {/* Results count */}
      {/* <Label className="ml-2 mt-1 text-muted-foreground">
        Showing {filteredCount} of {totalCount} upcoming events
      </Label> */}
    </div>
  )
}
