import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { Badge } from './Badge.tsx'
import { cx } from './cx.ts'
import styles from './Tabs.module.css'

export interface TabItem {
  id: string
  label: string
  count?: number
  badge?: string
  disabled?: boolean
  panel?: ReactNode
}

interface TabsProps {
  label: string
  tabs: TabItem[]
  variant?: 'underline' | 'segmented'
  value?: string
  defaultValue?: string
  onChange?: (id: string) => void
}

export function Tabs({
  label,
  tabs,
  variant = 'underline',
  value,
  defaultValue,
  onChange,
}: TabsProps) {
  const baseId = useId()
  const tabRefs = useRef(new Map<string, HTMLButtonElement>())
  const enabledTabs = tabs.filter((tab) => !tab.disabled)
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? enabledTabs[0]?.id,
  )
  const activeId = value ?? internalValue
  const activeTab = tabs.find((tab) => tab.id === activeId)

  function select(id: string) {
    setInternalValue(id)
    onChange?.(id)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const isRtl =
      event.currentTarget.closest('[dir]')?.getAttribute('dir') === 'rtl'
    const currentIndex = enabledTabs.findIndex((tab) => tab.id === activeId)
    const lastIndex = enabledTabs.length - 1
    const forwardKey = isRtl ? 'ArrowLeft' : 'ArrowRight'
    const backwardKey = isRtl ? 'ArrowRight' : 'ArrowLeft'
    let nextIndex: number

    if (event.key === forwardKey) {
      nextIndex = currentIndex >= lastIndex ? 0 : currentIndex + 1
    } else if (event.key === backwardKey) {
      nextIndex = currentIndex <= 0 ? lastIndex : currentIndex - 1
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = lastIndex
    } else {
      return
    }

    const next = enabledTabs[nextIndex]
    if (next) {
      event.preventDefault()
      select(next.id)
      tabRefs.current.get(next.id)?.focus()
    }
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        className={cx(styles.list, styles[variant])}
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeId
          return (
            <button
              key={tab.id}
              ref={(element) => {
                if (element) {
                  tabRefs.current.set(tab.id, element)
                } else {
                  tabRefs.current.delete(tab.id)
                }
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={
                tab.panel === undefined
                  ? undefined
                  : `${baseId}-panel-${tab.id}`
              }
              disabled={tab.disabled}
              tabIndex={selected ? 0 : -1}
              className={cx(styles.tab, selected && styles.selected)}
              onClick={() => select(tab.id)}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={styles.count}>{tab.count}</span>
              )}
              {tab.badge && <Badge tone="info">{tab.badge}</Badge>}
            </button>
          )
        })}
      </div>
      {activeTab?.panel !== undefined && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${activeTab.id}`}
          aria-labelledby={`${baseId}-tab-${activeTab.id}`}
          tabIndex={0}
          className={styles.panel}
        >
          {activeTab.panel}
        </div>
      )}
    </div>
  )
}
