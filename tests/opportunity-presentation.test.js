import { describe, expect, it } from 'vitest'
import {
  filterOpportunitiesBySource,
  opportunityMatchesSource,
  opportunitySourceNames,
  opportunitySourcePresentation,
} from '../app/utils/opportunity-presentation'

describe('opportunity presentation helpers', () => {
  it('recognises supported public opportunity sources', () => {
    expect(
      opportunitySourcePresentation('Devpost'),
    ).toMatchObject({
      key: 'devpost',
      label: 'Devpost',
    })

    expect(
      opportunitySourcePresentation('Volunteer.gov.sg'),
    ).toMatchObject({
      key: 'volunteer-gov-sg',
      label: 'Volunteer.gov.sg',
    })

    expect(
      opportunitySourcePresentation('NTU Events'),
    ).toMatchObject({
      key: 'ntu-events',
      label: 'NTU Events',
    })
  })

  it('uses a readable fallback for other sources', () => {
    expect(
      opportunitySourcePresentation('Manual import'),
    ).toMatchObject({
      key: 'other',
      label: 'Manual import',
    })
  })

  it('collects public and fallback source names defensively', () => {
    expect(opportunitySourceNames({
      publicSourceNames: [
        'Devpost',
        'Devpost',
      ],
      sourceName: 'Manual import',
    })).toEqual([
      'Devpost',
      'Manual import',
    ])

    expect(
      opportunitySourceNames({
        publicSourceNames: null,
      }),
    ).toEqual([])
  })

  it('filters already loaded discovery items by source', () => {
    const items = [
      {
        id: 'devpost',
        publicSourceNames: ['Devpost'],
      },
      {
        id: 'volunteer',
        publicSourceNames: ['Volunteer.gov.sg'],
      },
      {
        id: 'ntu',
        sourceName: 'NTU Events',
      },
    ]

    expect(
      filterOpportunitiesBySource(items, 'devpost')
        .map(item => item.id),
    ).toEqual(['devpost'])

    expect(
      filterOpportunitiesBySource(items, 'volunteer-gov-sg')
        .map(item => item.id),
    ).toEqual(['volunteer'])

    expect(
      filterOpportunitiesBySource(items, 'ntu-events')
        .map(item => item.id),
    ).toEqual(['ntu'])

    expect(
      filterOpportunitiesBySource(items, 'all'),
    ).toHaveLength(3)

    expect(
      opportunityMatchesSource(items[0], 'ntu-events'),
    ).toBe(false)
  })
})

describe('opportunity card presentation', () => {
  it('keeps deadline and event date selection explicitly separate', async () => {
    const { readFile } = await import('node:fs/promises')

    const card = await readFile(
      new URL(
        '../app/components/opportunities/OpportunityCard.vue',
        import.meta.url,
      ),
      'utf8',
    )

    expect(card).toContain("label: 'Deadline'")
    expect(card).toContain("label: 'Event'")
    expect(card).toContain('opportunity.personal')
    expect(card).toContain('opportunity-card__location')
    expect(card).toContain('OpportunitiesOpportunitySourceBadge')
  })
})

describe('Events and Learning presentation', () => {
  it('provides NTU Events-specific context and empty states', async () => {
    const { readFile } = await import('node:fs/promises')

    const page = await readFile(
      new URL(
        '../app/pages/app/opportunities/category/[slug].vue',
        import.meta.url,
      ),
      'utf8',
    )

    expect(page).toContain('isEventsSection')
    expect(page).toContain('Official NTU Events may appear')
    expect(page).toContain(
      'Event dates describe when something happens',
    )
    expect(page).toContain(
      'No events match these filters',
    )
    expect(page).toContain(
      'OpportunitiesOpportunitySourceBadge name="NTU Events"',
    )
  })
})
