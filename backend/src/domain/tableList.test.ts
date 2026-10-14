import { describe, expect, it } from 'vitest'
import { makeTable } from '../test/factories.ts'
import {
  DEFAULT_TABLE_SORT,
  filterTables,
  sortTables,
  type SeatedTable,
} from './tableList.ts'

function seated(
  number: number,
  capacity: number,
  assigned: number,
  shape: SeatedTable['table']['shape'] = 'CIRCLE',
): SeatedTable {
  return {
    table: makeTable({ id: `t-${number}`, number, capacity, shape }),
    assigned,
    available: capacity - assigned,
  }
}

const tables = [
  seated(12, 10, 12),
  seated(1, 10, 10, 'SQUARE'),
  seated(21, 8, 2, 'RECTANGLE'),
  seated(3, 12, 11),
]

const numbers = (items: readonly SeatedTable[]) =>
  items.map((item) => item.table.number)

describe('filterTables', () => {
  it('keeps every table when nothing is asked', () => {
    expect(filterTables(tables, { query: ' ', shape: 'ALL' })).toHaveLength(4)
  })

  it('matches a table whose number contains the digits typed', () => {
    expect(numbers(filterTables(tables, { query: '1', shape: 'ALL' }))).toEqual(
      [12, 1, 21],
    )
    expect(
      numbers(filterTables(tables, { query: 'table 12', shape: 'ALL' })),
    ).toEqual([12])
  })

  it('matches nothing for text without a digit', () => {
    expect(filterTables(tables, { query: 'family', shape: 'ALL' })).toEqual([])
  })

  it('filters by shape, together with the search', () => {
    expect(
      numbers(filterTables(tables, { query: '', shape: 'CIRCLE' })),
    ).toEqual([12, 3])
    expect(
      numbers(filterTables(tables, { query: '1', shape: 'SQUARE' })),
    ).toEqual([1])
  })
})

describe('sortTables', () => {
  it('sorts by number by default, without changing the list given', () => {
    expect(numbers(sortTables(tables, DEFAULT_TABLE_SORT))).toEqual([
      1, 3, 12, 21,
    ])
    expect(numbers(tables)).toEqual([12, 1, 21, 3])
  })

  it.each([
    ['number', 'desc', [21, 12, 3, 1]],
    ['capacity', 'asc', [21, 1, 12, 3]],
    ['assigned', 'desc', [12, 3, 1, 21]],
    ['available', 'asc', [12, 1, 3, 21]],
    ['shape', 'asc', [3, 12, 21, 1]],
    // Over Capacity, Full, Almost Full, Ready.
    ['status', 'asc', [12, 1, 3, 21]],
    ['status', 'desc', [21, 3, 1, 12]],
  ] as const)('sorts by %s %s', (key, direction, expected) => {
    expect(numbers(sortTables(tables, { key, direction }))).toEqual(expected)
  })
})
