import type { Event } from '../scrapers/types'

// Calculate similarity between two strings (0-1, where 1 is identical)
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  // Exact match
  if (s1 === s2) return 1

  // Normalize strings by removing special characters and extra spaces
  const normalize = (s: string) =>
    s.replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()

  const n1 = normalize(s1)
  const n2 = normalize(s2)

  if (n1 === n2) return 0.95

  // Check if one contains the other
  if (n1.includes(n2) || n2.includes(n1)) return 0.8

  // Jaccard similarity on words
  const words1 = new Set(n1.split(' '))
  const words2 = new Set(n2.split(' '))
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}

// Normalize date strings for comparison
function normalizeDate(dateStr: string): string {
  return dateStr.toLowerCase().replace(/[^\w\s]/g, '').trim()
}

// Check if two events are likely duplicates
function areEventsDuplicate(event1: Event, event2: Event): boolean {
  // Title similarity threshold
  const titleSimilarity = stringSimilarity(event1.title, event2.title)
  if (titleSimilarity < 0.7) return false // Not similar enough

  // If titles are similar, check dates if available
  const date1 = normalizeDate(event1.date)
  const date2 = normalizeDate(event2.date)

  // If both have specific dates, they should match
  if (
    date1 &&
    date2 &&
    !date1.includes('check website') &&
    !date2.includes('check website')
  ) {
    const dateSimilarity = stringSimilarity(date1, date2)
    // Dates should be very similar for it to be the same event
    return dateSimilarity > 0.6
  }

  // If one or both don't have specific dates, rely on title similarity
  return titleSimilarity > 0.85
}

// Merge two events, keeping the best information from both
function mergeEvents(event1: Event, event2: Event): Event {
  // Prefer more specific information over generic
  const isGeneric = (str: string | undefined) =>
    !str ||
    str.includes('Check website') ||
    str.includes('See Website') ||
    str.includes('Visit') ||
    str.includes('TBA') ||
    str.includes('details')

  return {
    // Use longer/more descriptive title
    title: event1.title.length > event2.title.length ? event1.title : event2.title,

    // Prefer specific dates over generic
    date: isGeneric(event1.date) ? event2.date : event1.date,

    // Prefer non-empty time
    time: event1.time || event2.time,

    // Prefer non-empty link, or BookMyShow link if available
    link:
      event1.source === 'BookMyShow'
        ? event1.link
        : event2.source === 'BookMyShow'
          ? event2.link
          : event1.link || event2.link,

    // Use longer description
    description:
      !isGeneric(event1.description) &&
      (event1.description?.length ?? 0) > (event2.description?.length ?? 0)
        ? event1.description
        : event2.description,

    // Keep category
    category: event1.category || event2.category,

    // Prefer non-empty image
    image: event1.image || event2.image,

    // Prefer more specific venue
    venue:
      event1.venue &&
      event1.venue !== 'Bangalore' &&
      event1.venue.length > (event2.venue?.length ?? 0)
        ? event1.venue
        : event2.venue,

    // Prefer actual price over generic "Ticketed"
    price:
      event1.price && !event1.price.startsWith('Ticketed')
        ? event1.price
        : event2.price && !event2.price.startsWith('Ticketed')
          ? event2.price
          : event1.price || event2.price,

    // Combine sources
    source: event1.source === event2.source ? event1.source : `${event1.source}, ${event2.source}`,
  }
}

/**
 * Deduplicates events from multiple sources, merging information
 * from duplicate events to create the most complete event records
 */
export function deduplicateEvents(events: Array<Event>): Array<Event> {
  const uniqueEvents: Array<Event> = []
  const processedIndices = new Set<number>()

  for (let i = 0; i < events.length; i++) {
    if (processedIndices.has(i)) continue

    let mergedEvent = events[i]
    processedIndices.add(i)

    // Find all duplicates of this event
    for (let j = i + 1; j < events.length; j++) {
      if (processedIndices.has(j)) continue

      if (areEventsDuplicate(mergedEvent, events[j])) {
        // Merge the duplicate into our merged event
        mergedEvent = mergeEvents(mergedEvent, events[j])
        processedIndices.add(j)
      }
    }

    uniqueEvents.push(mergedEvent)
  }

  return uniqueEvents
}
