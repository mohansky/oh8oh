/**
 * Event Categorization Utility
 * Infers event categories based on title and description keywords
 */

export type EventCategory =
  | 'Music'
  | 'Theatre'
  | 'Dance'
  | 'Film'
  | 'Art'
  | 'Workshop'
  | 'Talk'
  | 'Literature'
  | 'Heritage'
  | 'Comedy'
  | 'Kids'
  | 'Food'
  | 'Other'

// Keyword mappings for each category
const categoryKeywords: Record<EventCategory, Array<string>> = {
  Music: [
    'concert',
    'music',
    'musical',
    'band',
    'orchestra',
    'recital',
    'performance',
    'singer',
    'acoustic',
    'jazz',
    'classical music',
    'rock',
    'indie',
    'folk',
    'choir',
    'symphony',
    'instrumental',
    'live music',
    'dj',
    'electronic',
    'hip-hop',
    'rap',
    'pop',
    'carnatic',
    'hindustani',
    'blues',
    'metal',
    'punk',
    'reggae',
    'edm',
    'techno',
    'house music',
  ],
  Theatre: [
    'theatre',
    'theater',
    'play',
    'drama',
    'monologue',
    'theatrical',
    'stage',
    'production',
    'shakespeare',
    'acting',
    'musical theatre',
    'broadway',
    'mime',
    'improv theatre',
    'repertory',
    'dramaturgy',
  ],
  Dance: [
    'dance',
    'ballet',
    'bharatanatyam',
    'kathak',
    'contemporary dance',
    'choreography',
    'odissi',
    'kuchipudi',
    'performance',
    'salsa',
    'tango',
    'hip hop dance',
    'breakdance',
    'modern dance',
    'folk dance',
    'classical dance',
    'mohiniyattam',
  ],
  Film: [
    'film',
    'movie',
    'cinema',
    'screening',
    'documentary',
    'short film',
    'film festival',
    'filmmaker',
    'premiere',
    'cinephile',
    'film screening',
    'indie film',
    'animation',
    'cinematic',
  ],
  Art: [
    'art',
    'exhibition',
    'gallery',
    'painting',
    'sculpture',
    'artist',
    'artwork',
    'photography',
    'installation',
    'visual art',
    'contemporary art',
    'modern art',
    'abstract',
    'mural',
    'graffiti',
    'street art',
    'fine art',
    'mixed media',
    'printmaking',
    'ceramics',
    'textile art',
  ],
  Workshop: [
    'workshop',
    'masterclass',
    'class',
    'course',
    'training',
    'hands-on',
    'learn',
    'tutorial',
    'session',
    'bootcamp',
    'skill-building',
    'learning',
    'educational',
    'teach',
  ],
  Talk: [
    'talk',
    'lecture',
    'discussion',
    'panel',
    'conversation',
    'seminar',
    'symposium',
    'debate',
    'presentation',
    'speaker',
    'keynote',
    'ted',
    'conference',
    'summit',
    'forum',
  ],
  Literature: [
    'book',
    'literature',
    'reading',
    'author',
    'poetry',
    'writing',
    'literary',
    'novel',
    'story',
    'storytelling',
    'poet',
    'writer',
    'book launch',
    'book reading',
    'literature festival',
    'spoken word',
  ],
  Heritage: [
    'heritage',
    'culture',
    'cultural',
    'history',
    'historical',
    'tradition',
    'traditional',
    'festival',
    'walk',
    'tour',
    'heritage walk',
    'museum',
    'archaeological',
    'monument',
    'conservation',
    'folklore',
  ],
  Comedy: [
    'comedy',
    'stand-up',
    'standup',
    'comedian',
    'humor',
    'humour',
    'improv',
    'funny',
    'comic',
    'laugh',
    'satire',
    'comedy show',
    'open mic',
  ],
  Kids: [
    'kids',
    'children',
    'family',
    'child',
    'toddler',
    'youth',
    'young',
    'family-friendly',
    'all ages',
    'kid-friendly',
  ],
  Food: [
    'food',
    'dining',
    'culinary',
    'cooking',
    'chef',
    'cuisine',
    'tasting',
    'dinner',
    'lunch',
    'brunch',
    'food festival',
    'gastronomy',
    'wine tasting',
    'beer',
    'coffee',
    'dessert',
    'baking',
  ],
  Other: [],
}

/**
 * Infer categories from event title and description
 * @param title - Event title
 * @param description - Event description (optional)
 * @param existingCategory - Existing category from scraper (optional)
 * @param multiCategory - Whether to return multiple categories (default: true)
 * @returns Inferred categories as array or single category string
 */
export function categorizeEvent(
  title: string,
  description?: string,
  existingCategory?: string,
  multiCategory: boolean = true
): string | Array<string> {
  const textToAnalyze = `${title} ${description || ''}`.toLowerCase()

  // Score each category based on keyword matches
  const categoryScores: Record<string, number> = {}

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (category === 'Other') continue

    let score = 0
    for (const keyword of keywords) {
      if (textToAnalyze.includes(keyword.toLowerCase())) {
        // Give higher weight to matches in the title
        if (title.toLowerCase().includes(keyword.toLowerCase())) {
          score += 2
        } else {
          score += 1
        }
      }
    }
    categoryScores[category] = score
  }

  // If existing category provided, give it a boost
  if (existingCategory && existingCategory.trim() !== '') {
    const normalizedExisting = existingCategory.trim()
    if (categoryScores[normalizedExisting] !== undefined) {
      categoryScores[normalizedExisting] += 5 // Boost score to ensure it's included
    }
  }

  // Sort categories by score
  const sortedCategories = Object.entries(categoryScores)
    .filter(([_, score]) => score > 0)
    .sort(([_, scoreA], [__, scoreB]) => scoreB - scoreA)

  if (sortedCategories.length === 0) {
    // If no matches but existing category provided, use it
    if (existingCategory && existingCategory.trim() !== '') {
      return multiCategory ? [existingCategory] : existingCategory
    }
    return multiCategory ? ['Other'] : 'Other'
  }

  if (!multiCategory) {
    // Return only the top category
    return sortedCategories[0][0]
  }

  // Return multiple categories if they have significant scores
  const matchedCategories: Array<string> = []
  const topScore = sortedCategories[0][1]

  for (const [category, score] of sortedCategories) {
    // Include categories with score >= 40% of top score, or score >= 2
    if (score >= topScore * 0.4 || score >= 2) {
      matchedCategories.push(category)
    }
    // Limit to max 3 categories
    if (matchedCategories.length >= 3) break
  }

  return matchedCategories.length > 0 ? matchedCategories : ['Other']
}

/**
 * Get all available categories
 */
export function getAllCategories(): Array<EventCategory> {
  return Object.keys(categoryKeywords) as Array<EventCategory>
}

/**
 * Normalize category to array format
 */
export function normalizeCategories(category?: string | Array<string>): Array<string> {
  if (!category) return ['Other']
  if (Array.isArray(category)) return category
  if (typeof category === 'string') {
    // Handle JSON string from database
    if (category.startsWith('[')) {
      try {
        return JSON.parse(category)
      } catch {
        return [category]
      }
    }
    return [category]
  }
  return ['Other']
}

/**
 * Serialize categories for database storage.
 * Returns null for empty/absent input so callers can store SQL NULL.
 */
export function serializeCategories(
  categories?: string | Array<string> | null,
): string | null {
  if (categories == null) return null
  if (Array.isArray(categories)) {
    return categories.length > 0 ? JSON.stringify(categories) : null
  }
  return JSON.stringify([categories])
}
