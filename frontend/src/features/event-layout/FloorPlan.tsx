import { Expand, Scan, Shrink, ZoomIn, ZoomOut } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  type DragEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  CHAIR_SIZE_CM,
  chairPositions,
  findLayoutIssues,
  normalizeRotation,
  tableSize,
  type LayoutItem,
} from '../../domain/layout.ts'
import type { EventLayout, VenueObject } from '../../domain/models.ts'
import { tableStatus } from '../../domain/seating.ts'
import type { SeatedTable } from '../../domain/tableList.ts'
import { useFormatters } from '../../i18n/format.ts'
import { IconButton } from '../../shared/ui/Button.tsx'
import { cx } from '../../shared/ui/cx.ts'
import styles from './FloorPlan.module.css'
import { DRAG_TYPE, OBJECT_ICONS } from './planParts.ts'

/** What the drawing needs of a plan: everything but whose and which version. */
export type PlanLayout = Omit<EventLayout, 'eventId' | 'version'>

export type PlanChange =
  | { type: 'move'; item: LayoutItem; x: number; y: number }
  | { type: 'resize'; id: string; width: number; height: number }
  | { type: 'rotate'; item: LayoutItem; rotation: number }

export interface FloorPlanHandle {
  /** The middle of what is in view, in centimetres, inside the room. */
  centre(): { x: number; y: number }
}

interface FloorPlanProps {
  layout: PlanLayout
  tables: readonly SeatedTable[]
  /** Tables ticked in the list, drawn as selected. */
  selected: ReadonlySet<string>
  /** The item being edited, drawn with its handles. */
  active?: LayoutItem | null
  /** A small picture beside the list: no controls, no panning. */
  compact?: boolean
  editing?: boolean
  /** Snapping step for moves, in centimetres; 0 for none. */
  snap?: number
  onTable?: (tableId: string) => void
  onObject?: (objectId: string) => void
  /** A click on the floor, away from every item. */
  onBackground?: () => void
  onChange?: (change: PlanChange) => void
  /** A palette item dropped at a point of the room. */
  onDrop?: (payload: string, at: { x: number; y: number }) => void
  onItemKey?: (item: LayoutItem, event: KeyboardEvent) => void
  /** Shown after the zoom buttons, such as Edit Layout. */
  toolbarEnd?: ReactNode
  ref?: Ref<FloorPlanHandle>
}

interface View {
  x: number
  y: number
  width: number
  height: number
}

type Gesture =
  | {
      kind: 'pan'
      start: { x: number; y: number }
      view: View
      moved: boolean
      tableId: string | null
    }
  | {
      kind: 'move'
      item: LayoutItem
      offset: { x: number; y: number }
    }
  | { kind: 'resize'; object: VenueObject }
  | { kind: 'rotate'; item: LayoutItem; centre: { x: number; y: number } }
  | { kind: 'pinch'; distance: number; view: View }

/** Pointer travel, in screen pixels, below which a press is a click. */
const CLICK_SLOP = 5
const ZOOM_STEP = 1.25
const MIN_VIEW = 200
const ROTATE_SNAP = 5
const SIZE_SNAP = 10

function fitView(layout: PlanLayout): View {
  const margin = Math.max(layout.roomWidth, layout.roomDepth) * 0.04
  return {
    x: -margin,
    y: -margin,
    width: layout.roomWidth + 2 * margin,
    height: layout.roomDepth + 2 * margin,
  }
}

function zoomView(
  view: View,
  factor: number,
  around: { x: number; y: number },
  layout: PlanLayout,
): View {
  const largest = Math.max(layout.roomWidth, layout.roomDepth) * 3
  const width = Math.min(largest, Math.max(MIN_VIEW, view.width / factor))
  const scale = width / view.width
  return {
    x: around.x - (around.x - view.x) * scale,
    y: around.y - (around.y - view.y) * scale,
    width,
    height: view.height * scale,
  }
}

const itemKey = (item: LayoutItem) => `${item.type}:${item.id}`

const snapTo = (value: number, step: number) =>
  step > 0 ? Math.round(value / step) * step : Math.round(value)

/**
 * The floor plan (D100): the room, the floor picture under everything,
 * the venue's objects and the tables with a chair per seat. It is drawn in
 * centimetres and never mirrored: a room looks the same in every language.
 * Zoom and pan with the buttons, the mouse, a trackpad pinch (or Ctrl and
 * the wheel) or two fingers.
 */
export function FloorPlan({
  layout,
  tables,
  selected,
  active = null,
  compact = false,
  editing = false,
  snap = 0,
  onTable,
  onObject,
  onBackground,
  onChange,
  onDrop,
  onItemKey,
  toolbarEnd,
  ref,
}: FloorPlanProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const frameRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<View>(() => fitView(layout))
  const [fullscreen, setFullscreen] = useState(false)
  const gesture = useRef<Gesture | null>(null)
  const dragged = useRef(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const roomSize = `${layout.roomWidth}x${layout.roomDepth}`

  // A different room is shown whole again.
  const [shownRoom, setShownRoom] = useState(roomSize)
  if (shownRoom !== roomSize) {
    setShownRoom(roomSize)
    setView(fitView(layout))
  }

  useImperativeHandle(ref, () => ({
    centre: () => ({
      x: Math.round(
        Math.min(layout.roomWidth, Math.max(0, view.x + view.width / 2)),
      ),
      y: Math.round(
        Math.min(layout.roomDepth, Math.max(0, view.y + view.height / 2)),
      ),
    }),
  }))

  /** A point of the screen as centimetres of the room. */
  const toRoom = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const svg = svgRef.current
      const matrix = svg?.getScreenCTM?.()
      if (!svg || !matrix) {
        return { x: view.x + view.width / 2, y: view.y + view.height / 2 }
      }
      const point = new DOMPoint(clientX, clientY).matrixTransform(
        matrix.inverse(),
      )
      return { x: point.x, y: point.y }
    },
    [view],
  )

  // Ctrl or ⌘ with the wheel, which is also what a trackpad pinch sends,
  // zooms; the wheel alone keeps scrolling the page.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || compact) {
      return
    }
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return
      }
      event.preventDefault()
      const around = toRoom(event.clientX, event.clientY)
      setView((current) =>
        zoomView(current, Math.exp(-event.deltaY / 200), around, layout),
      )
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [compact, layout, toRoom])

  useEffect(() => {
    const onChangeFullscreen = () => {
      if (!document.fullscreenElement) {
        setFullscreen(false)
      }
    }
    document.addEventListener('fullscreenchange', onChangeFullscreen)
    return () =>
      document.removeEventListener('fullscreenchange', onChangeFullscreen)
  }, [])

  async function toggleFullscreen() {
    const frame = frameRef.current
    if (fullscreen) {
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => undefined)
      }
      setFullscreen(false)
    } else {
      // Where the browser cannot, such as on an iPhone, the plan fills the
      // window instead.
      await frame?.requestFullscreen?.().catch(() => undefined)
      setFullscreen(true)
    }
    setView(fitView(layout))
  }

  function zoom(factor: number) {
    setView((current) =>
      zoomView(
        current,
        factor,
        {
          x: current.x + current.width / 2,
          y: current.y + current.height / 2,
        },
        layout,
      ),
    )
  }

  // --- Pointer gestures -------------------------------------------------

  function startItem(
    event: PointerEvent,
    item: LayoutItem,
    centre: { x: number; y: number },
  ) {
    event.stopPropagation()
    if (!editing) {
      // Viewing: a press on a table may still become a pan.
      startPan(event, item.type === 'table' ? item.id : null)
      return
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    if (item.type === 'table') {
      onTable?.(item.id)
    } else {
      onObject?.(item.id)
    }
    const at = toRoom(event.clientX, event.clientY)
    gesture.current = {
      kind: 'move',
      item,
      offset: { x: at.x - centre.x, y: at.y - centre.y },
    }
  }

  function startPan(event: PointerEvent, tableId: string | null = null) {
    if (compact) {
      return
    }
    dragged.current = false
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current = {
        kind: 'pinch',
        distance: Math.hypot(a!.x - b!.x, a!.y - b!.y),
        view,
      }
      return
    }
    gesture.current = {
      kind: 'pan',
      start: { x: event.clientX, y: event.clientY },
      view,
      moved: false,
      tableId,
    }
  }

  function handleMove(event: PointerEvent) {
    const current = gesture.current
    if (!current) {
      return
    }
    if (pointers.current.has(event.pointerId)) {
      pointers.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      })
    }
    if (current.kind === 'pinch') {
      const [a, b] = [...pointers.current.values()]
      if (!a || !b) {
        return
      }
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      const middle = toRoom((a.x + b.x) / 2, (a.y + b.y) / 2)
      setView(
        zoomView(current.view, distance / current.distance, middle, layout),
      )
      return
    }
    if (current.kind === 'pan') {
      const dx = event.clientX - current.start.x
      const dy = event.clientY - current.start.y
      if (!current.moved && Math.hypot(dx, dy) < CLICK_SLOP) {
        return
      }
      current.moved = true
      // Held only once it is a drag, so a plain click still reaches its table.
      svgRef.current?.setPointerCapture?.(event.pointerId)
      const svg = svgRef.current
      const scale = svg
        ? Math.max(
            current.view.width / (svg.clientWidth || 1),
            current.view.height / (svg.clientHeight || 1),
          )
        : 1
      setView({
        ...current.view,
        x: current.view.x - dx * scale,
        y: current.view.y - dy * scale,
      })
      return
    }
    const at = toRoom(event.clientX, event.clientY)
    if (current.kind === 'move') {
      onChange?.({
        type: 'move',
        item: current.item,
        x: clampToRoom(snapTo(at.x - current.offset.x, snap), 'x'),
        y: clampToRoom(snapTo(at.y - current.offset.y, snap), 'y'),
      })
    } else if (current.kind === 'resize') {
      const { object } = current
      const angle = (-object.rotation * Math.PI) / 180
      const dx = at.x - object.x
      const dy = at.y - object.y
      const localX = dx * Math.cos(angle) - dy * Math.sin(angle)
      const localY = dx * Math.sin(angle) + dy * Math.cos(angle)
      onChange?.({
        type: 'resize',
        id: object.id,
        width: Math.max(20, snapTo(2 * Math.abs(localX), SIZE_SNAP)),
        height: Math.max(20, snapTo(2 * Math.abs(localY), SIZE_SNAP)),
      })
    } else {
      const degrees =
        (Math.atan2(at.y - current.centre.y, at.x - current.centre.x) * 180) /
          Math.PI +
        90
      onChange?.({
        type: 'rotate',
        item: current.item,
        rotation: normalizeRotation(snapTo(degrees, ROTATE_SNAP)),
      })
    }
  }

  function handleUp(event: PointerEvent) {
    const current = gesture.current
    pointers.current.delete(event.pointerId)
    // A press that moved the plan is not a click on what it started on.
    dragged.current = current?.kind === 'pan' && current.moved
    if (current?.kind === 'pan' && !current.moved && !current.tableId) {
      onBackground?.()
    }
    gesture.current = pointers.current.size > 0 ? gesture.current : null
    if (current?.kind === 'pinch' && pointers.current.size < 2) {
      gesture.current = null
    }
  }

  function clampToRoom(value: number, axis: 'x' | 'y'): number {
    const limit = axis === 'x' ? layout.roomWidth : layout.roomDepth
    return Math.min(limit, Math.max(0, value))
  }

  function handleDrop(event: DragEvent) {
    const payload = event.dataTransfer.getData(DRAG_TYPE)
    if (!payload || !onDrop) {
      return
    }
    event.preventDefault()
    const at = toRoom(event.clientX, event.clientY)
    onDrop(payload, {
      x: clampToRoom(snapTo(at.x, snap), 'x'),
      y: clampToRoom(snapTo(at.y, snap), 'y'),
    })
  }

  // --- Drawing -------------------------------------------------------------

  const issues = findLayoutIssues(
    layout,
    tables.map((item) => item.table),
  )
  const flagged = new Set(
    [...issues.overlapping.flat(), ...issues.outside].map(itemKey),
  )
  const byId = new Map(tables.map((item) => [item.table.id, item]))
  const centreX = layout.roomWidth / 2
  const centreY = layout.roomDepth / 2
  const clipId = `room-${roomSize}`
  const isActive = (item: LayoutItem) =>
    active !== null && active.type === item.type && active.id === item.id

  /** Clicks, taps, and what assistive technology sends for them. */
  function itemClick(item: LayoutItem) {
    return () => {
      if (dragged.current) {
        dragged.current = false
        return
      }
      if (item.type === 'table') {
        onTable?.(item.id)
      } else if (editing) {
        onObject?.(item.id)
      }
    }
  }

  function itemKeys(item: LayoutItem) {
    return (event: KeyboardEvent) => {
      if (editing) {
        onItemKey?.(item, event)
        return
      }
      if (
        item.type === 'table' &&
        (event.key === 'Enter' || event.key === ' ')
      ) {
        event.preventDefault()
        onTable?.(item.id)
      }
    }
  }

  function handles(
    item: LayoutItem,
    width: number,
    height: number,
    canResize: boolean,
  ) {
    const reach = height / 2 + 60
    return (
      <g className={styles.handles}>
        <rect
          className={styles.outline}
          x={-width / 2 - 8}
          y={-height / 2 - 8}
          width={width + 16}
          height={height + 16}
        />
        <line
          className={styles.stalk}
          x1={0}
          y1={-height / 2 - 8}
          x2={0}
          y2={-reach}
        />
        <circle
          className={styles.handle}
          cx={0}
          cy={-reach}
          r={18}
          aria-hidden="true"
          onPointerDown={(event) => {
            event.stopPropagation()
            event.currentTarget.setPointerCapture?.(event.pointerId)
            const centre =
              item.type === 'table'
                ? layout.placements.find((p) => p.tableId === item.id)!
                : layout.objects.find((o) => o.id === item.id)!
            gesture.current = {
              kind: 'rotate',
              item,
              centre: { x: centre.x, y: centre.y },
            }
          }}
        />
        {canResize && (
          <rect
            className={styles.handle}
            x={width / 2 - 14}
            y={height / 2 - 14}
            width={28}
            height={28}
            aria-hidden="true"
            onPointerDown={(event) => {
              event.stopPropagation()
              event.currentTarget.setPointerCapture?.(event.pointerId)
              const object = layout.objects.find((o) => o.id === item.id)
              if (object) {
                gesture.current = { kind: 'resize', object }
              }
            }}
          />
        )}
      </g>
    )
  }

  const objectsDrawn = layout.objects.map((object) => {
    const item: LayoutItem = { type: 'object', id: object.id }
    const Icon = OBJECT_ICONS[object.kind]
    const name = object.label ?? t(`layout.objects.${object.kind}`)
    const small = Math.min(object.width, object.height)
    const icon = Math.min(small * 0.6, 80)
    const showText = small >= 60 && object.kind !== 'PLANT'
    return (
      <g
        key={`object-${object.id}`}
        className={cx(
          styles.object,
          styles[`kind${object.kind}`],
          flagged.has(itemKey(item)) && styles.issue,
          editing && styles.movable,
        )}
        transform={`translate(${object.x} ${object.y}) rotate(${object.rotation})`}
        role={editing ? 'button' : 'img'}
        tabIndex={editing ? 0 : undefined}
        aria-label={name}
        aria-pressed={editing ? isActive(item) : undefined}
        onPointerDown={(event) => startItem(event, item, object)}
        onClick={itemClick(item)}
        onKeyDown={itemKeys(item)}
      >
        {object.kind === 'PLANT' ? (
          <circle className={styles.objectShape} r={small / 2} />
        ) : (
          <rect
            className={styles.objectShape}
            x={-object.width / 2}
            y={-object.height / 2}
            width={object.width}
            height={object.height}
            rx={Math.min(12, small / 4)}
          />
        )}
        {small >= 40 && (
          <Icon
            x={-icon / 2}
            y={showText ? -icon * 0.9 : -icon / 2}
            width={icon}
            height={icon}
            className={styles.objectIcon}
            aria-hidden="true"
          />
        )}
        {showText && (
          <text
            className={styles.objectText}
            y={icon * 0.55}
            fontSize={Math.min(36, small / 4)}
          >
            {name}
          </text>
        )}
        {editing &&
          isActive(item) &&
          handles(item, object.width, object.height, true)}
      </g>
    )
  })

  const tablesDrawn = layout.placements.flatMap((placement) => {
    const seated = byId.get(placement.tableId)
    if (!seated) {
      return []
    }
    const { table, assigned } = seated
    const item: LayoutItem = { type: 'table', id: table.id }
    const size = tableSize(table.shape, table.capacity)
    const over = assigned > table.capacity
    const status = tableStatus(table.capacity, assigned)
    const chairs = chairPositions(table.shape, table.capacity)
    const name = t('layout.tableNumber', {
      number: format.number(table.number),
    })
    const isSelected = selected.has(table.id)
    const label = t('layout.arrangement.tableLabel', {
      name,
      assigned: format.number(assigned),
      capacity: format.number(table.capacity),
      status: t(`layout.status.${status}`),
    })
    return [
      <g
        key={`table-${table.id}`}
        className={cx(
          styles.table,
          over && styles.over,
          isSelected && styles.selectedTable,
          flagged.has(itemKey(item)) && styles.issue,
          editing && styles.movable,
        )}
        transform={`translate(${placement.x} ${placement.y}) rotate(${placement.rotation})`}
        role="button"
        tabIndex={compact ? -1 : 0}
        aria-label={label}
        aria-pressed={editing ? isActive(item) : isSelected}
        onPointerDown={(event) => startItem(event, item, placement)}
        onClick={itemClick(item)}
        onKeyDown={itemKeys(item)}
      >
        {chairs.map((chair, index) => (
          <rect
            key={index}
            className={cx(styles.chair, index < assigned && styles.taken)}
            x={chair.x - CHAIR_SIZE_CM / 2}
            y={chair.y - CHAIR_SIZE_CM / 2}
            width={CHAIR_SIZE_CM}
            height={CHAIR_SIZE_CM}
            rx={10}
          />
        ))}
        {table.shape === 'CIRCLE' ? (
          <circle className={styles.top} r={size.width / 2} />
        ) : (
          <rect
            className={styles.top}
            x={-size.width / 2}
            y={-size.height / 2}
            width={size.width}
            height={size.height}
            rx={8}
          />
        )}
        <text
          className={styles.number}
          transform={`rotate(${-placement.rotation})`}
          fontSize={Math.min(
            56,
            Math.max(28, Math.min(size.width, size.height) / 2.6),
          )}
        >
          {format.number(table.number)}
        </text>
        {over && (
          <g
            className={styles.alert}
            transform={`rotate(${-placement.rotation}) translate(${size.width / 2} ${-size.height / 2})`}
          >
            <circle r={26} />
            <text>!</text>
          </g>
        )}
        {editing &&
          isActive(item) &&
          handles(item, size.width, size.height, false)}
      </g>,
    ]
  })

  // Clipped by its parent: a clip on the turned picture would turn too.
  const picture = layout.floorImage && (
    <g clipPath={`url(#${clipId})`}>
      <image
        className={styles.picture}
        href={layout.floorImage}
        x={0}
        y={0}
        width={layout.roomWidth}
        height={layout.roomDepth}
        preserveAspectRatio="xMidYMid meet"
        opacity={(100 - layout.floorImageTransparency) / 100}
        transform={`translate(${centreX} ${centreY}) rotate(${layout.floorImageRotation}) scale(${layout.floorImageZoom / 100}) translate(${-centreX} ${-centreY})`}
      />
    </g>
  )

  return (
    <div
      ref={frameRef}
      className={cx(
        styles.frame,
        compact && styles.compact,
        fullscreen && styles.fullscreen,
      )}
      dir="ltr"
      // As tall as the room is deep, for the width there is.
      style={
        fullscreen
          ? undefined
          : {
              aspectRatio: `${fitView(layout).width} / ${fitView(layout).height}`,
            }
      }
    >
      {!compact && (
        <div className={styles.toolbar}>
          <IconButton
            label={t('layout.arrangement.zoomIn')}
            variant="ghost"
            onClick={() => zoom(ZOOM_STEP)}
          >
            <ZoomIn />
          </IconButton>
          <IconButton
            label={t('layout.arrangement.zoomOut')}
            variant="ghost"
            onClick={() => zoom(1 / ZOOM_STEP)}
          >
            <ZoomOut />
          </IconButton>
          <IconButton
            label={t('layout.arrangement.fit')}
            variant="ghost"
            onClick={() => setView(fitView(layout))}
          >
            <Scan />
          </IconButton>
          <IconButton
            label={t(
              fullscreen
                ? 'layout.arrangement.exitFullscreen'
                : 'layout.arrangement.fullscreen',
            )}
            variant="ghost"
            onClick={() => void toggleFullscreen()}
          >
            {fullscreen ? <Shrink /> : <Expand />}
          </IconButton>
          {toolbarEnd}
        </div>
      )}
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={t('layout.arrangement.planLabel')}
        onPointerDown={(event) => startPan(event)}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onDragOver={(event) => {
          if (onDrop && event.dataTransfer.types.includes(DRAG_TYPE)) {
            event.preventDefault()
          }
        }}
        onDrop={handleDrop}
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={0}
              y={0}
              width={layout.roomWidth}
              height={layout.roomDepth}
            />
          </clipPath>
          <pattern
            id={`grid-${roomSize}`}
            width={100}
            height={100}
            patternUnits="userSpaceOnUse"
          >
            <path className={styles.gridLine} d="M 100 0 L 0 0 0 100" />
          </pattern>
        </defs>
        <rect
          className={styles.room}
          x={0}
          y={0}
          width={layout.roomWidth}
          height={layout.roomDepth}
        />
        {picture}
        <rect
          className={styles.grid}
          x={0}
          y={0}
          width={layout.roomWidth}
          height={layout.roomDepth}
          fill={`url(#grid-${roomSize})`}
        />
        <rect
          className={styles.walls}
          x={0}
          y={0}
          width={layout.roomWidth}
          height={layout.roomDepth}
        />
        {objectsDrawn}
        {tablesDrawn}
      </svg>
    </div>
  )
}
