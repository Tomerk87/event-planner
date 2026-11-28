import { tableFootprint } from '../../domain/layout.ts'
import type { LayoutTemplate } from '../../domain/venues.ts'
import styles from './LayoutPreview.module.css'

/**
 * A small, read-only drawing of a layout template (mockup #5): the room, its
 * objects and its tables. Its name is given by the caller for screen readers.
 */
export function LayoutPreview({
  template,
  label,
}: {
  template: LayoutTemplate
  label: string
}) {
  const { roomWidth, roomDepth } = template
  return (
    <svg
      className={styles.preview}
      viewBox={`0 0 ${roomWidth} ${roomDepth}`}
      role="img"
      aria-label={label}
    >
      <rect
        className={styles.room}
        x={0}
        y={0}
        width={roomWidth}
        height={roomDepth}
      />
      {template.objects.map((object) => (
        <rect
          key={object.id}
          className={styles.object}
          x={object.x - object.width / 2}
          y={object.y - object.height / 2}
          width={object.width}
          height={object.height}
          transform={`rotate(${object.rotation} ${object.x} ${object.y})`}
        />
      ))}
      {template.tables.map((table) => {
        if (table.x === null || table.y === null) {
          return null
        }
        const footprint = tableFootprint(table, {
          x: table.x,
          y: table.y,
          rotation: table.rotation,
        })
        return footprint.kind === 'circle' ? (
          <circle
            key={table.number}
            className={styles.table}
            cx={footprint.x}
            cy={footprint.y}
            r={footprint.radius}
          />
        ) : (
          <rect
            key={table.number}
            className={styles.table}
            x={footprint.x - footprint.width / 2}
            y={footprint.y - footprint.height / 2}
            width={footprint.width}
            height={footprint.height}
            transform={`rotate(${footprint.rotation} ${footprint.x} ${footprint.y})`}
          />
        )
      })}
    </svg>
  )
}
