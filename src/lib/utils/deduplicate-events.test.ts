import { describe, expect, it } from 'vitest'
import { deduplicateEvents } from './deduplicate-events'
import type { Event } from '../scrapers/types'

const event = (overrides: Partial<Event>): Event => ({
  title: 'Carnatic Evening',
  date: 'Sat 14 Nov 2026',
  time: '6:30 pm',
  link: 'https://example.com/a',
  source: 'BIC',
  ...overrides,
})

describe('deduplicateEvents', () => {
  it('merges the same event listed by two sources', () => {
    const result = deduplicateEvents([
      event({ source: 'BIC', link: 'https://bic.example/carnatic' }),
      event({ source: 'Urbanaut', link: 'https://urbanaut.example/carnatic' }),
    ])
    expect(result).toHaveLength(1)
  })

  it('treats punctuation and case differences in the title as the same event', () => {
    const result = deduplicateEvents([
      event({ title: 'Carnatic Evening!' }),
      event({ title: 'carnatic evening', source: 'Sabha' }),
    ])
    expect(result).toHaveLength(1)
  })

  it('keeps events with different titles apart', () => {
    const result = deduplicateEvents([
      event({ title: 'Carnatic Evening' }),
      event({ title: 'Stand-up Comedy Night' }),
    ])
    expect(result).toHaveLength(2)
  })

  it('keeps the same title on different dates apart', () => {
    const result = deduplicateEvents([
      event({ date: 'Sat 14 Nov 2026' }),
      event({ date: 'Fri 25 Dec 2026' }),
    ])
    expect(result).toHaveLength(2)
  })

  it('returns an empty list unchanged', () => {
    expect(deduplicateEvents([])).toEqual([])
  })
})
