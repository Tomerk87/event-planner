import {
  ImageUp,
  Pencil,
  Plus,
  RotateCcw,
  RotateCw,
  Trash2,
  Undo2,
} from 'lucide-react'
import {
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { isDomainError } from '../../domain/errors.ts'
import {
  DEFAULT_FLOOR_IMAGE,
  DEFAULT_OBJECT_SIZE,
  FLOOR_IMAGE,
  FLOOR_IMAGE_MAX_LENGTH,
  findLayoutIssues,
  LAYOUT_LIMITS,
  normalizeRotation,
  type LayoutInput,
  type LayoutItem,
} from '../../domain/layout.ts'
import {
  VENUE_OBJECT_KINDS,
  type EventLayout,
  type VenueObject,
  type VenueObjectKind,
} from '../../domain/models.ts'
import type { SeatedTable } from '../../domain/tableList.ts'
import { useFormatters } from '../../i18n/format.ts'
import { describeError } from '../../shared/errorMessage.ts'
import {
  checkImageFile,
  IMAGE_TYPES,
  shrinkImage,
  type ImageProblem,
} from '../../shared/imageTools.ts'
import { Badge } from '../../shared/ui/Badge.tsx'
import { Button } from '../../shared/ui/Button.tsx'
import { Card } from '../../shared/ui/Card.tsx'
import { TextField } from '../../shared/ui/Field.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { RangeField } from '../../shared/ui/RangeField.tsx'
import { ErrorState, LoadingState } from '../../shared/ui/States.tsx'
import { Switch } from '../../shared/ui/Switch.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import { UnsavedChangesGuard } from '../../shared/UnsavedChangesGuard.tsx'
import styles from './Arrangement.module.css'
import pageStyles from './EventLayout.module.css'
import {
  FloorPlan,
  type FloorPlanHandle,
  type PlanChange,
} from './FloorPlan.tsx'
import { DRAG_TYPE, OBJECT_ICONS } from './planParts.ts'
import { useLayout, useSaveLayout } from './layoutQueries.ts'

/** Where moves land when snapping is on, in centimetres. */
const SNAP = 50
const NUDGE = 10
const NUDGE_FAR = 100
const TURN = 15

/** The floor picture's sliders: field, label, step, unit. */
const PICTURE_CONTROLS = [
  ['floorImageTransparency', 'transparency', 5, '%'],
  ['floorImageZoom', 'zoom', 5, '%'],
  ['floorImageRotation', 'rotate', 1, '°'],
] as const

interface ArrangementTabProps {
  eventId: string
  tables: readonly SeatedTable[]
  /** The chosen table, shared with the Tables tab. */
  chosenId: string | null
  /** Chooses a table, or clears the choice when it is the chosen one. */
  onChooseTable: (tableId: string) => void
  canEdit: boolean
  isPhone: boolean
  onAddTable: () => void
  /** The Selected Table card, or its hint; beside the plan in View mode. */
  side: ReactNode
}

function toInput(layout: EventLayout): LayoutInput {
  const { eventId: _eventId, ...input } = layout
  return {
    ...input,
    placements: input.placements.map((placement) => ({ ...placement })),
    objects: input.objects.map((object) => ({ ...object })),
  }
}

/** A centimetre value shown in metres. */
const metres = (centimetres: number) => String(Math.round(centimetres) / 100)

/**
 * The Table Arrangement tab (D100). It opens in View mode: the plan, to
 * explore and to choose a table in. Owners and Admins of an upcoming event
 * change it in Edit mode, on a screen wider than a phone, and save the
 * whole plan at once.
 */
export function ArrangementTab({
  eventId,
  tables,
  chosenId,
  onChooseTable,
  canEdit,
  isPhone,
  onAddTable,
  side,
}: ArrangementTabProps) {
  const { t } = useTranslation()
  const format = useFormatters()
  const { showToast } = useToast()
  const layout = useLayout(eventId)
  const save = useSaveLayout(eventId)
  const planRef = useRef<FloorPlanHandle>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<LayoutInput | null>(null)
  const [active, setActive] = useState<LayoutItem | null>(null)
  const [snapOn, setSnapOn] = useState(true)
  const [failure, setFailure] = useState<{
    message: string
    changed: boolean
  } | null>(null)
  const [pictureProblem, setPictureProblem] = useState<ImageProblem | null>(
    null,
  )

  const editing = draft !== null && canEdit && !isPhone
  const stored = layout.data ? toInput(layout.data) : null
  const plan = editing ? draft : stored
  const dirty =
    editing &&
    stored !== null &&
    JSON.stringify(draft) !== JSON.stringify(stored)

  if (layout.isError) {
    return (
      <Card>
        <ErrorState
          description={describeError(t, layout.error)}
          onRetry={() => void layout.refetch()}
        />
      </Card>
    )
  }
  if (!plan) {
    return (
      <Card>
        <LoadingState />
      </Card>
    )
  }

  const tableName = (item: SeatedTable) =>
    t('layout.tableNumber', { number: format.number(item.table.number) })
  const placed = new Set(plan.placements.map((placement) => placement.tableId))
  const unplaced = tables.filter((item) => !placed.has(item.table.id))
  const issues = findLayoutIssues(
    plan,
    tables.map((item) => item.table),
  )
  const nameOf = (item: LayoutItem) => {
    if (item.type === 'table') {
      const table = tables.find((candidate) => candidate.table.id === item.id)
      return table ? tableName(table) : ''
    }
    const object = plan.objects.find((candidate) => candidate.id === item.id)
    return object ? (object.label ?? t(`layout.objects.${object.kind}`)) : ''
  }

  // --- Changes to the draft ---------------------------------------------

  function change(update: (current: LayoutInput) => LayoutInput) {
    setDraft((current) => (current ? update(current) : current))
  }

  function moveItem(item: LayoutItem, x: number, y: number) {
    change((current) => ({
      ...current,
      placements: current.placements.map((placement) =>
        item.type === 'table' && placement.tableId === item.id
          ? { ...placement, x, y }
          : placement,
      ),
      objects: current.objects.map((object) =>
        item.type === 'object' && object.id === item.id
          ? { ...object, x, y }
          : object,
      ),
    }))
  }

  function turnItem(item: LayoutItem, rotation: number) {
    change((current) => ({
      ...current,
      placements: current.placements.map((placement) =>
        item.type === 'table' && placement.tableId === item.id
          ? { ...placement, rotation }
          : placement,
      ),
      objects: current.objects.map((object) =>
        item.type === 'object' && object.id === item.id
          ? { ...object, rotation }
          : object,
      ),
    }))
  }

  function updateObject(id: string, fields: Partial<VenueObject>) {
    change((current) => ({
      ...current,
      objects: current.objects.map((object) =>
        object.id === id ? { ...object, ...fields } : object,
      ),
    }))
  }

  function removeItem(item: LayoutItem) {
    change((current) => ({
      ...current,
      placements: current.placements.filter(
        (placement) =>
          !(item.type === 'table' && placement.tableId === item.id),
      ),
      objects: current.objects.filter(
        (object) => !(item.type === 'object' && object.id === item.id),
      ),
    }))
    setActive(null)
  }

  function onPlanChange(planChange: PlanChange) {
    if (planChange.type === 'move') {
      moveItem(planChange.item, planChange.x, planChange.y)
    } else if (planChange.type === 'rotate') {
      turnItem(planChange.item, planChange.rotation)
    } else {
      updateObject(planChange.id, {
        width: planChange.width,
        height: planChange.height,
      })
    }
  }

  const where = (at?: { x: number; y: number }) =>
    at ?? planRef.current?.centre() ?? { x: 0, y: 0 }

  function placeTable(tableId: string, at?: { x: number; y: number }) {
    const point = where(at)
    change((current) => ({
      ...current,
      placements: [
        ...current.placements.filter(
          (placement) => placement.tableId !== tableId,
        ),
        { tableId, x: point.x, y: point.y, rotation: 0 },
      ],
    }))
    setActive({ type: 'table', id: tableId })
  }

  function addObject(kind: VenueObjectKind, at?: { x: number; y: number }) {
    const point = where(at)
    const id = `${kind.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}`
    change((current) => ({
      ...current,
      objects: [
        ...current.objects,
        {
          id,
          kind,
          x: point.x,
          y: point.y,
          ...DEFAULT_OBJECT_SIZE[kind],
          rotation: 0,
          label: null,
        },
      ],
    }))
    setActive({ type: 'object', id })
  }

  function onDrop(payload: string, at: { x: number; y: number }) {
    const [type, value] = payload.split(':')
    if (type === 'table' && value) {
      placeTable(value, at)
    } else if (
      type === 'object' &&
      (VENUE_OBJECT_KINDS as readonly string[]).includes(value ?? '')
    ) {
      addObject(value as VenueObjectKind, at)
    }
  }

  /** Arrows move, R turns, Delete takes off the plan, Escape lets go. */
  function onItemKey(item: LayoutItem, event: KeyboardEvent) {
    if (!draft) {
      return
    }
    const centre =
      item.type === 'table'
        ? draft.placements.find((placement) => placement.tableId === item.id)
        : draft.objects.find((object) => object.id === item.id)
    if (!centre) {
      return
    }
    const step = event.shiftKey ? NUDGE_FAR : NUDGE
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const arrow = arrows[event.key]
    if (arrow) {
      event.preventDefault()
      setActive(item)
      moveItem(
        item,
        Math.min(draft.roomWidth, Math.max(0, centre.x + arrow[0])),
        Math.min(draft.roomDepth, Math.max(0, centre.y + arrow[1])),
      )
    } else if (event.key === 'r' || event.key === 'R') {
      event.preventDefault()
      setActive(item)
      turnItem(
        item,
        normalizeRotation(centre.rotation + (event.shiftKey ? -TURN : TURN)),
      )
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      removeItem(item)
    } else if (event.key === 'Escape') {
      setActive(null)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setActive(item)
    }
  }

  function setRoom(field: 'roomWidth' | 'roomDepth', value: number) {
    const { min, max } = LAYOUT_LIMITS.room
    const size = Math.min(max, Math.max(min, Math.round(value)))
    const axis = field === 'roomWidth' ? 'x' : 'y'
    // Everything stays inside a smaller room.
    change((current) => ({
      ...current,
      [field]: size,
      placements: current.placements.map((placement) => ({
        ...placement,
        [axis]: Math.min(size, placement[axis]),
      })),
      objects: current.objects.map((object) => ({
        ...object,
        [axis]: Math.min(size, object[axis]),
      })),
    }))
  }

  async function handlePicture(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    const problem = checkImageFile(file)
    setPictureProblem(problem)
    if (problem) {
      return
    }
    try {
      const floorImage = await shrinkImage(file, {
        maxSide: 2000,
        maxLength: FLOOR_IMAGE_MAX_LENGTH,
      })
      change((current) => ({ ...current, floorImage }))
    } catch {
      setPictureProblem('failed')
    }
  }

  function startEditing() {
    if (stored) {
      setDraft(stored)
      setActive(null)
      setFailure(null)
    }
  }

  function stopEditing() {
    setDraft(null)
    setActive(null)
    setFailure(null)
    setPictureProblem(null)
  }

  async function saveChanges(): Promise<boolean> {
    if (!draft) {
      return true
    }
    setFailure(null)
    try {
      await save.mutateAsync(draft)
      showToast({ tone: 'success', message: t('layout.arrangement.saved') })
      stopEditing()
      return true
    } catch (error) {
      setFailure({
        message: describeError(t, error),
        changed: isDomainError(error, 'LAYOUT_CHANGED'),
      })
      return false
    }
  }

  async function reload() {
    const fresh = await layout.refetch()
    if (fresh.data) {
      setDraft(toInput(fresh.data))
      setActive(null)
      setFailure(null)
    }
  }

  // --- Parts ------------------------------------------------------------------

  const issueNotice = (issues.overlapping.length > 0 ||
    issues.outside.length > 0) && (
    <Notice tone="warning" title={t('layout.arrangement.issues.title')}>
      <ul className={styles.issueList}>
        {issues.overlapping.map(([a, b]) => (
          <li key={`${a.type}${a.id}-${b.type}${b.id}`}>
            {t('layout.arrangement.issues.overlap', {
              first: nameOf(a),
              second: nameOf(b),
            })}
          </li>
        ))}
        {issues.outside.map((item) => (
          <li key={`out-${item.type}${item.id}`}>
            {t('layout.arrangement.issues.outside', { name: nameOf(item) })}
          </li>
        ))}
      </ul>
    </Notice>
  )

  const floorPlan = (
    <FloorPlan
      ref={planRef}
      layout={plan}
      tables={tables}
      selected={new Set(!editing && chosenId ? [chosenId] : [])}
      active={editing ? active : null}
      editing={editing}
      snap={snapOn ? SNAP : 0}
      onTable={(tableId) =>
        editing
          ? setActive({ type: 'table', id: tableId })
          : onChooseTable(tableId)
      }
      onObject={(objectId) => setActive({ type: 'object', id: objectId })}
      onBackground={() => setActive(null)}
      onChange={onPlanChange}
      onDrop={editing ? onDrop : undefined}
      onItemKey={onItemKey}
    />
  )

  if (!editing) {
    return (
      <div className={pageStyles.withSide}>
        <Card
          title={t('layout.arrangement.title')}
          actions={
            canEdit && !isPhone ? (
              <Button icon={<Pencil />} onClick={startEditing}>
                {t('layout.arrangement.edit')}
              </Button>
            ) : (
              <Badge tone="info">{t('layout.arrangement.viewMode')}</Badge>
            )
          }
        >
          <div className={styles.stack}>
            <p className={styles.muted}>
              {t(
                isPhone
                  ? 'layout.arrangement.hintTouch'
                  : 'layout.arrangement.hint',
              )}
            </p>
            {canEdit && isPhone && (
              <p className={styles.muted}>
                {t('layout.arrangement.editWider')}
              </p>
            )}
            {unplaced.length > 0 && (
              <Notice
                tone="info"
                title={t('layout.arrangement.unplacedCount', {
                  count: unplaced.length,
                  formatted: format.number(unplaced.length),
                })}
              />
            )}
            {issueNotice}
            {floorPlan}
          </div>
        </Card>
        {side}
      </div>
    )
  }

  // --- Edit mode ----------------------------------------------------------

  const activeTable =
    active?.type === 'table'
      ? tables.find((item) => item.table.id === active.id)
      : undefined
  const activePlacement =
    active?.type === 'table'
      ? draft.placements.find((placement) => placement.tableId === active.id)
      : undefined
  const activeObject =
    active?.type === 'object'
      ? draft.objects.find((object) => object.id === active.id)
      : undefined

  const positionFields = (
    item: LayoutItem,
    at: { x: number; y: number; rotation: number },
  ) => (
    <div className={styles.fieldGrid}>
      <TextField
        label={t('layout.arrangement.inspector.x')}
        type="number"
        step={0.1}
        min={0}
        max={draft.roomWidth / 100}
        value={metres(at.x)}
        onChange={(event) => {
          const value = Number(event.target.value) * 100
          if (Number.isFinite(value)) {
            moveItem(
              item,
              Math.min(draft.roomWidth, Math.max(0, Math.round(value))),
              at.y,
            )
          }
        }}
      />
      <TextField
        label={t('layout.arrangement.inspector.y')}
        type="number"
        step={0.1}
        min={0}
        max={draft.roomDepth / 100}
        value={metres(at.y)}
        onChange={(event) => {
          const value = Number(event.target.value) * 100
          if (Number.isFinite(value)) {
            moveItem(
              item,
              at.x,
              Math.min(draft.roomDepth, Math.max(0, Math.round(value))),
            )
          }
        }}
      />
      <TextField
        label={t('layout.arrangement.inspector.rotation')}
        type="number"
        step={TURN}
        value={String(at.rotation)}
        onChange={(event) => {
          const value = Number(event.target.value)
          if (Number.isFinite(value)) {
            turnItem(item, normalizeRotation(value))
          }
        }}
      />
    </div>
  )

  const backToRoom = (
    <Button variant="ghost" size="sm" onClick={() => setActive(null)}>
      {t('layout.arrangement.inspector.room')}
    </Button>
  )

  let inspector: ReactNode
  if (activeTable && activePlacement && active) {
    inspector = (
      <Card title={tableName(activeTable)} actions={backToRoom}>
        <div className={styles.stack}>
          {positionFields(active, activePlacement)}
          <Button
            variant="secondary"
            icon={<Undo2 />}
            onClick={() => removeItem(active)}
          >
            {t('layout.arrangement.inspector.unplace')}
          </Button>
        </div>
      </Card>
    )
  } else if (activeObject && active) {
    inspector = (
      <Card
        title={t(`layout.objects.${activeObject.kind}`)}
        actions={backToRoom}
      >
        <div className={styles.stack}>
          <TextField
            label={t('layout.arrangement.inspector.label')}
            hint={t('layout.arrangement.inspector.labelHint')}
            maxLength={LAYOUT_LIMITS.label}
            value={activeObject.label ?? ''}
            onChange={(event) =>
              updateObject(activeObject.id, {
                label: event.target.value === '' ? null : event.target.value,
              })
            }
          />
          {positionFields(active, activeObject)}
          <div className={styles.fieldGrid}>
            {(['width', 'height'] as const).map((field) => (
              <TextField
                key={field}
                label={t(`layout.arrangement.inspector.${field}`)}
                type="number"
                step={0.1}
                min={LAYOUT_LIMITS.objectSize.min / 100}
                max={LAYOUT_LIMITS.objectSize.max / 100}
                value={metres(activeObject[field])}
                onChange={(event) => {
                  const value = Math.round(Number(event.target.value) * 100)
                  if (Number.isFinite(value)) {
                    updateObject(activeObject.id, {
                      [field]: Math.min(
                        LAYOUT_LIMITS.objectSize.max,
                        Math.max(LAYOUT_LIMITS.objectSize.min, value),
                      ),
                    })
                  }
                }}
              />
            ))}
          </div>
          <Button
            variant="danger"
            icon={<Trash2 />}
            onClick={() => removeItem(active)}
          >
            {t('layout.arrangement.inspector.delete')}
          </Button>
        </div>
      </Card>
    )
  } else {
    const changedPicture = FLOOR_IMAGE.some(
      ([field]) => draft[field] !== DEFAULT_FLOOR_IMAGE[field],
    )
    inspector = (
      <Card title={t('layout.arrangement.room.title')}>
        <div className={styles.stack}>
          <div className={styles.fieldGrid}>
            {(['roomWidth', 'roomDepth'] as const).map((field) => (
              <TextField
                key={field}
                label={t(`layout.arrangement.room.${field}`)}
                type="number"
                step={0.5}
                min={LAYOUT_LIMITS.room.min / 100}
                max={LAYOUT_LIMITS.room.max / 100}
                value={metres(draft[field])}
                onChange={(event) => {
                  const value = Number(event.target.value) * 100
                  if (Number.isFinite(value) && value > 0) {
                    setRoom(field, value)
                  }
                }}
              />
            ))}
          </div>
          <h3 className={styles.sectionTitle}>
            {t('layout.arrangement.picture.title')}
          </h3>
          <p className={styles.muted}>{t('layout.arrangement.picture.hint')}</p>
          <input
            ref={fileRef}
            type="file"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            accept={IMAGE_TYPES.join(',')}
            data-testid="floor-picture-file"
            onChange={(event) => void handlePicture(event)}
          />
          <div className={styles.buttons}>
            <Button
              variant="secondary"
              icon={<ImageUp />}
              onClick={() => fileRef.current?.click()}
            >
              {t(
                draft.floorImage
                  ? 'layout.arrangement.picture.replace'
                  : 'layout.arrangement.picture.upload',
              )}
            </Button>
            {draft.floorImage && (
              <Button
                variant="ghost"
                icon={<Trash2 />}
                onClick={() =>
                  change((current) => ({ ...current, floorImage: null }))
                }
              >
                {t('layout.arrangement.picture.remove')}
              </Button>
            )}
          </div>
          {pictureProblem && (
            <Notice
              tone="danger"
              title={t(`rsvpSettings.background.errors.${pictureProblem}`)}
              announce
            />
          )}
          {PICTURE_CONTROLS.map(([field, label, step, unit]) => {
            const range = FLOOR_IMAGE.find(([name]) => name === field)!
            return (
              <RangeField
                key={field}
                label={t(`layout.arrangement.picture.${label}`)}
                min={range[1]}
                max={range[2]}
                step={step}
                unit={unit}
                value={draft[field]}
                disabled={!draft.floorImage}
                onChange={(value) =>
                  change((current) => ({ ...current, [field]: value }))
                }
              />
            )
          })}
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw />}
            disabled={!draft.floorImage || !changedPicture}
            onClick={() =>
              change((current) => ({ ...current, ...DEFAULT_FLOOR_IMAGE }))
            }
          >
            {t('layout.arrangement.picture.reset')}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className={styles.stack}>
      <UnsavedChangesGuard active={dirty} onSave={saveChanges} />
      <div className={styles.editBar}>
        <Badge tone="warning">{t('layout.arrangement.editMode')}</Badge>
        <p className={styles.muted}>{t('layout.arrangement.editHint')}</p>
        <div className={styles.editActions}>
          <Switch
            label={t('layout.arrangement.snap')}
            checked={snapOn}
            onChange={(event) => setSnapOn(event.target.checked)}
          />
          <Button variant="ghost" onClick={stopEditing}>
            {t('common.cancel')}
          </Button>
          <Button
            loading={save.isPending}
            disabled={!dirty}
            onClick={() => void saveChanges()}
          >
            {t('layout.arrangement.save')}
          </Button>
        </div>
      </div>
      {failure && (
        <Notice
          tone="danger"
          title={failure.message}
          announce
          action={
            failure.changed && (
              <Button
                variant="secondary"
                size="sm"
                icon={<RotateCw />}
                onClick={() => void reload()}
              >
                {t('layout.arrangement.reload')}
              </Button>
            )
          }
        />
      )}
      <div className={styles.editor}>
        <div className={styles.palette}>
          <Card title={t('layout.arrangement.palette.tables')}>
            <div className={styles.stack}>
              {unplaced.length === 0 ? (
                <p className={styles.muted}>
                  {t('layout.arrangement.palette.allPlaced')}
                </p>
              ) : (
                <ul
                  className={styles.chips}
                  aria-label={t('layout.arrangement.palette.tables')}
                >
                  {unplaced.map((item) => (
                    <li key={item.table.id}>
                      <button
                        type="button"
                        className={styles.chip}
                        draggable
                        title={t('layout.arrangement.palette.placeHint')}
                        aria-label={t('layout.arrangement.palette.place', {
                          name: tableName(item),
                        })}
                        onDragStart={(event) =>
                          event.dataTransfer.setData(
                            DRAG_TYPE,
                            `table:${item.table.id}`,
                          )
                        }
                        onClick={() => placeTable(item.table.id)}
                      >
                        {tableName(item)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus />}
                onClick={onAddTable}
              >
                {t('layout.actions.add')}
              </Button>
            </div>
          </Card>
          <Card title={t('layout.arrangement.palette.objects')}>
            <ul
              className={styles.objectList}
              aria-label={t('layout.arrangement.palette.objects')}
            >
              {VENUE_OBJECT_KINDS.map((kind) => {
                const Icon = OBJECT_ICONS[kind]
                const name = t(`layout.objects.${kind}`)
                return (
                  <li key={kind}>
                    <button
                      type="button"
                      className={styles.objectButton}
                      draggable
                      title={t('layout.arrangement.palette.placeHint')}
                      aria-label={t('layout.arrangement.palette.add', { name })}
                      onDragStart={(event) =>
                        event.dataTransfer.setData(DRAG_TYPE, `object:${kind}`)
                      }
                      onClick={() => addObject(kind)}
                    >
                      <Icon aria-hidden="true" />
                      <span>{name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
        <div className={styles.canvas}>{floorPlan}</div>
        <div className={styles.inspector}>{inspector}</div>
      </div>
      {/* Below the plan, so it never moves the plan while something is dragged. */}
      {issueNotice}
    </div>
  )
}
