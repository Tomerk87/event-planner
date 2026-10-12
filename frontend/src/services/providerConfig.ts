const DATA_PROVIDERS = ['mock', 'api'] as const

export type DataProvider = (typeof DATA_PROVIDERS)[number]

function isDataProvider(value: string): value is DataProvider {
  return (DATA_PROVIDERS as readonly string[]).includes(value)
}

export function parseDataProvider(value: string | undefined): DataProvider {
  if (value === undefined || value === '') {
    return 'mock'
  }
  if (isDataProvider(value)) {
    return value
  }
  throw new Error(
    `Invalid VITE_DATA_PROVIDER "${value}". Expected one of: ${DATA_PROVIDERS.join(', ')}.`,
  )
}
