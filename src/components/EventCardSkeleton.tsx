import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'
import { AspectRatio } from './ui/aspect-ratio'
import { Skeleton } from './ui/skeleton'

export function EventCardSkeleton() {
  return (
    <Card className="pt-0 overflow-hidden">
      {/* Image Skeleton */}
      <AspectRatio ratio={1 / 1} className="overflow-hidden">
        <Skeleton className="w-full h-full rounded-none" />
      </AspectRatio>

      <CardHeader>
        {/* Badge Skeleton */}
        <Skeleton className="h-5 w-20 mb-2" />
        {/* Title Skeleton */}
        <Skeleton className="h-6 w-3/4" />
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          {/* Venue Skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>

          {/* Date Skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>

          {/* Time Skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded-full" />
            <Skeleton className="h-4 w-1/3" />
          </div>

          {/* Price Skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="w-4 h-4 rounded-full" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        </div>
      </CardContent>

      <CardFooter>
        {/* Button Skeleton */}
        <Skeleton className="h-10 w-28" />
      </CardFooter>
    </Card>
  )
}
