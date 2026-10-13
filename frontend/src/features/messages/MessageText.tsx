import type { ReactNode } from 'react'
import { parseMessage, type MessageNode } from '../../domain/messages.ts'
import styles from './Messages.module.css'

function render(nodes: MessageNode[]): ReactNode {
  return nodes.map((node, index) => {
    if (node.type === 'text') {
      return node.text
    }
    if (node.type === 'link') {
      // Shown as WhatsApp shows it; not a working link inside the preview.
      return (
        <span key={index} className={styles.link}>
          {node.text}
        </span>
      )
    }
    const children = render(node.children)
    if (node.type === 'bold') {
      return <strong key={index}>{children}</strong>
    }
    return node.type === 'italic' ? (
      <em key={index}>{children}</em>
    ) : (
      <s key={index}>{children}</s>
    )
  })
}

/** A message as WhatsApp displays it: formatting applied, addresses as links. */
export function MessageText({ message }: { message: string }) {
  return (
    <p className={styles.messageText} dir="auto">
      {render(parseMessage(message))}
    </p>
  )
}
