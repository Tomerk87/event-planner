import {
  ArrowLeft,
  ArrowRight,
  Bold,
  Eye,
  Info,
  Italic,
  Link2,
  MessageSquare,
  MoreHorizontal,
  RotateCcw,
  Save,
  Send,
  Smile,
  Strikethrough,
} from 'lucide-react'
import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { canEditEvent } from '../../domain/access.ts'
import { guestFullName } from '../../domain/guestList.ts'
import {
  buildWhatsAppUrl,
  findUnknownVariables,
  hasVariable,
  insertText,
  MESSAGE_MAX_LENGTH,
  MESSAGE_VARIABLES,
  renderMessage,
  toggleMark,
  type MessageMark,
  type TextEdit,
} from '../../domain/messages.ts'
import { paginate } from '../../domain/paging.ts'
import { useFormatters } from '../../i18n/format.ts'
import type { SentMessage } from '../../services/contracts/index.ts'
import { ReadOnlyNotice } from '../../shared/access/EventAccess.tsx'
import { useEventAccess } from '../../shared/access/eventAccessContext.ts'
import { describeError } from '../../shared/errorMessage.ts'
import { openExternal } from '../../shared/openExternal.ts'
import { FailureNotice } from '../../shared/FailureNotice.tsx'
import { UnsavedChangesGuard } from '../../shared/UnsavedChangesGuard.tsx'
import { Avatar } from '../../shared/ui/Avatar.tsx'
import { Badge } from '../../shared/ui/Badge.tsx'
import { Button } from '../../shared/ui/Button.tsx'
import { ButtonLink } from '../../shared/ui/ButtonLink.tsx'
import { Card } from '../../shared/ui/Card.tsx'
import { DataTable, type Column } from '../../shared/ui/DataTable.tsx'
import { Dialog } from '../../shared/ui/Dialog.tsx'
import { SelectField, TextArea } from '../../shared/ui/Field.tsx'
import { LtrText } from '../../shared/ui/LtrText.tsx'
import { Menu } from '../../shared/ui/Menu.tsx'
import { Notice } from '../../shared/ui/Notice.tsx'
import { PageHeader } from '../../shared/ui/PageHeader.tsx'
import { Pagination } from '../../shared/ui/Pagination.tsx'
import { Popover } from '../../shared/ui/Popover.tsx'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../shared/ui/States.tsx'
import { Tabs } from '../../shared/ui/Tabs.tsx'
import { useToast } from '../../shared/ui/toastContext.ts'
import { DESKTOP_QUERY, useMediaQuery } from '../../shared/useMediaQuery.ts'
import { useGuests } from '../guests/guestQueries.ts'
import {
  useDefaultTemplate,
  useMessageTemplate,
  useMessageValues,
  useSaveTemplate,
  useSentMessages,
} from './messageQueries.ts'
import styles from './Messages.module.css'
import { MessageText } from './MessageText.tsx'
import { SendMessageDialog } from './SendMessageDialog.tsx'

const SENT_PAGE_SIZE = 10
const EMOJIS = [
  '🎉',
  '💜',
  '❤️',
  '🥂',
  '💍',
  '🎂',
  '🙏',
  '😊',
  '📅',
  '🕒',
  '📍',
  '🔗',
]
const MARKS: { mark: MessageMark; icon: typeof Bold }[] = [
  { mark: 'bold', icon: Bold },
  { mark: 'italic', icon: Italic },
  { mark: 'strike', icon: Strikethrough },
]

type View = 'editor' | 'preview'

function SentMessages({
  eventId,
  canSend,
}: {
  eventId: string
  canSend: boolean
}) {
  const { t } = useTranslation()
  const format = useFormatters()
  const sends = useSentMessages(eventId)
  const [pageNumber, setPageNumber] = useState(1)
  const [viewed, setViewed] = useState<SentMessage | null>(null)
  const [resend, setResend] = useState<SentMessage | null>(null)

  if (sends.isError) {
    return (
      <ErrorState
        description={describeError(t, sends.error)}
        onRetry={() => void sends.refetch()}
      />
    )
  }
  if (!sends.data) {
    return <LoadingState />
  }
  if (sends.data.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare />}
        title={t('messages.sent.emptyTitle')}
        description={t('messages.sent.emptyBody')}
        action={
          <ButtonLink to={`/events/${eventId}/guests`} variant="secondary">
            {t('messages.sent.goToGuests')}
          </ButtonLink>
        }
      />
    )
  }

  const page = paginate(sends.data, pageNumber, SENT_PAGE_SIZE)
  const nameOf = (send: SentMessage) =>
    send.guestName || t('messages.sent.deletedGuest')
  // Sent times are shown on the viewer's own clock.
  const when = (send: SentMessage) => {
    const at = new Date(send.sentAt)
    return t('messages.sent.sentAt', {
      date: format.date(at),
      time: format.time(at),
    })
  }
  const status = (
    <Badge tone="success" icon={<Link2 />}>
      {t('messages.sent.opened')}
    </Badge>
  )
  const excerpt = (send: SentMessage) => (
    <span className={styles.excerpt} dir="auto">
      {send.message.replace(/\s+/g, ' ')}
    </span>
  )
  const actions = (send: SentMessage) => (
    <Menu
      label={t('messages.sent.more', { name: nameOf(send) })}
      triggerClassName={styles.iconControl}
      items={[
        {
          id: 'view',
          label: t('messages.sent.view'),
          icon: <Eye />,
          onSelect: () => setViewed(send),
        },
        ...(canSend && send.guestActive
          ? [
              {
                id: 'again',
                label: t('messages.sent.sendAgain'),
                icon: <Send />,
                onSelect: () => setResend(send),
              },
            ]
          : []),
      ]}
    >
      <MoreHorizontal aria-hidden="true" />
    </Menu>
  )

  const columns: Column<SentMessage>[] = [
    {
      id: 'when',
      header: t('messages.sent.columns.when'),
      cell: (send) => <time dateTime={send.sentAt}>{when(send)}</time>,
    },
    { id: 'guest', header: t('messages.sent.columns.guest'), cell: nameOf },
    {
      id: 'phone',
      header: t('messages.sent.columns.phone'),
      cell: (send) => <LtrText>{send.phone || '—'}</LtrText>,
    },
    {
      id: 'status',
      header: t('messages.sent.columns.status'),
      cell: () => status,
    },
    {
      id: 'message',
      header: t('messages.sent.columns.message'),
      cell: excerpt,
    },
    {
      id: 'actions',
      header: t('messages.sent.columns.actions'),
      hideHeader: true,
      align: 'end',
      pinned: true,
      cell: actions,
    },
  ]

  return (
    <>
      <DataTable
        caption={t('messages.sent.title')}
        columns={columns}
        rows={page.items}
        getRowKey={(send) => send.id}
        renderCard={(send) => (
          <div className={styles.sentCard}>
            <Avatar name={nameOf(send)} />
            <div className={styles.sentCardText}>
              <span className={styles.sentCardName}>{nameOf(send)}</span>
              <time className={styles.sentCardMeta} dateTime={send.sentAt}>
                {when(send)}
              </time>
              {send.phone && (
                <span className={styles.sentCardMeta}>
                  <LtrText>{send.phone}</LtrText>
                </span>
              )}
              <span>{status}</span>
              {excerpt(send)}
            </div>
            {actions(send)}
          </div>
        )}
      />
      {page.pageCount > 1 && (
        <div className={styles.footer}>
          <Pagination
            label={t('messages.sent.pages')}
            page={page.page}
            pageCount={page.pageCount}
            previousLabel={t('guests.pagination.previous')}
            nextLabel={t('guests.pagination.next')}
            pageLabel={(number) =>
              t('guests.pagination.page', { page: format.number(number) })
            }
            formatNumber={format.number}
            onPage={setPageNumber}
          />
        </div>
      )}
      <Dialog
        open={viewed !== null}
        onClose={() => setViewed(null)}
        title={t('messages.sent.viewTitle', {
          name: viewed ? nameOf(viewed) : '',
        })}
        scrollableContent
      >
        {viewed && (
          <div className={styles.sendDialog}>
            <p className={styles.note}>{when(viewed)}</p>
            <div className={styles.bubble}>
              <MessageText message={viewed.message} />
            </div>
          </div>
        )}
      </Dialog>
      <SendMessageDialog
        eventId={eventId}
        guest={resend ? { id: resend.guestId, name: nameOf(resend) } : null}
        onClose={() => setResend(null)}
      />
    </>
  )
}

function Messages({ eventId, saved }: { eventId: string; saved: string }) {
  const { t, i18n } = useTranslation()
  const format = useFormatters()
  const { showToast } = useToast()
  const access = useEventAccess()
  const canEdit = access !== null && canEditEvent(access)
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const guests = useGuests(eventId)
  const save = useSaveTemplate(eventId)
  const defaultTemplate = useDefaultTemplate(eventId)
  const [draft, setDraft] = useState(saved)
  const [error, setError] = useState<'empty' | 'tooLong' | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [view, setView] = useState<View>('editor')
  const [chosenGuestId, setChosenGuestId] = useState<string | null>(null)
  const [previewTime] = useState(() => new Date())
  const editorRef = useRef<HTMLDivElement>(null)
  const pendingSelection = useRef<[number, number] | null>(null)
  const isDirty = canEdit && draft !== saved

  const sortedGuests = [...(guests.data ?? [])].sort((a, b) =>
    guestFullName(a).localeCompare(guestFullName(b)),
  )
  const previewGuest =
    sortedGuests.find((guest) => guest.id === chosenGuestId) ??
    sortedGuests[0] ??
    null
  const values = useMessageValues(
    eventId,
    previewGuest?.id ?? null,
    guests.data !== undefined,
  )
  const preview = values.data ? renderMessage(draft, values.data) : null
  const unknownVariables = findUnknownVariables(draft)

  // After a toolbar edit, put the cursor back where the edit left it.
  useLayoutEffect(() => {
    const selection = pendingSelection.current
    const textarea = editorRef.current?.querySelector('textarea')
    if (selection && textarea) {
      textarea.focus()
      textarea.setSelectionRange(...selection)
      pendingSelection.current = null
    }
  }, [draft])

  function edit(
    change: (text: string, start: number, end: number) => TextEdit,
  ) {
    const textarea = editorRef.current?.querySelector('textarea')
    const result = change(
      draft,
      textarea?.selectionStart ?? draft.length,
      textarea?.selectionEnd ?? draft.length,
    )
    pendingSelection.current = [result.selectionStart, result.selectionEnd]
    setDraft(result.text)
  }

  function insert(text: string) {
    edit((current, start, end) => insertText(current, start, end, text))
  }

  function handleSubmit(submission: FormEvent) {
    submission.preventDefault()
    void saveChanges()
  }

  /** Saves the message; resolves to whether it was saved. */
  function saveChanges(): Promise<boolean> {
    const found =
      draft.trim() === ''
        ? 'empty'
        : draft.length > MESSAGE_MAX_LENGTH
          ? 'tooLong'
          : null
    setError(found)
    setFailure(null)
    if (found) {
      editorRef.current?.querySelector('textarea')?.focus()
      return Promise.resolve(false)
    }
    return new Promise((resolve) =>
      save.mutate(draft, {
        onSuccess: (template) => {
          setDraft(template.body)
          showToast({ tone: 'success', message: t('messages.saved') })
          resolve(true)
        },
        onError: (problem) => {
          setFailure(describeError(t, problem))
          resolve(false)
        },
      }),
    )
  }

  function reset() {
    defaultTemplate.mutate(undefined, {
      onSuccess: (body) => {
        setError(null)
        setDraft(body)
      },
      onError: (problem) => setFailure(describeError(t, problem)),
    })
  }

  function sendTest() {
    if (preview === null) {
      return
    }
    // No recipient: the sender picks one in WhatsApp. Nothing is recorded.
    openExternal(buildWhatsAppUrl(null, preview))
    showToast({ tone: 'info', message: t('messages.testOpened') })
  }

  const formId = 'message-template'
  const saveButton = (
    <Button
      key="save"
      type="submit"
      form={formId}
      icon={<Save />}
      loading={save.isPending}
      disabled={!isDirty}
    >
      {t('messages.save')}
    </Button>
  )
  const testButton = (variant: 'primary' | 'secondary') => (
    <Button
      key="test"
      variant={variant}
      icon={<Send />}
      disabled={preview === null || preview.trim() === ''}
      onClick={sendTest}
    >
      {t('messages.test')}
    </Button>
  )
  const headerActions = !canEdit ? undefined : isDesktop ||
    view === 'editor' ? (
    <>
      {testButton('secondary')}
      {saveButton}
    </>
  ) : (
    <>
      <Button
        variant="secondary"
        icon={i18n.dir() === 'rtl' ? <ArrowRight /> : <ArrowLeft />}
        onClick={() => setView('editor')}
      >
        {t('messages.backToEditor')}
      </Button>
      {testButton('primary')}
    </>
  )

  const templateCard = (
    <Card
      title={t('messages.template.title')}
      subtitle={t('messages.template.subtitle')}
    >
      <form
        id={formId}
        className={styles.stack}
        noValidate
        onSubmit={handleSubmit}
      >
        <div>
          {canEdit && (
            <div
              className={styles.toolbar}
              role="toolbar"
              aria-label={t('messages.template.toolbar')}
            >
              {MARKS.map(({ mark, icon: Icon }) => (
                <button
                  key={mark}
                  type="button"
                  className={styles.tool}
                  aria-label={t(`messages.template.${mark}`)}
                  title={t(`messages.template.${mark}`)}
                  onClick={() =>
                    edit((text, start, end) =>
                      toggleMark(text, start, end, mark),
                    )
                  }
                >
                  <Icon aria-hidden="true" />
                </button>
              ))}
              <Popover
                label={t('messages.template.emoji')}
                trigger={<Smile aria-hidden="true" />}
                triggerClassName={styles.tool}
              >
                <div className={styles.emojis}>
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={styles.emoji}
                      aria-label={t('messages.template.emojiChoice', { emoji })}
                      onClick={() => insert(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </Popover>
              <span className={styles.reset}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<RotateCcw />}
                  loading={defaultTemplate.isPending}
                  onClick={reset}
                >
                  {t('messages.template.reset')}
                </Button>
              </span>
            </div>
          )}
          <div ref={editorRef} className={styles.editorField}>
            <TextArea
              label={t('messages.template.label')}
              hideLabel
              dir="auto"
              required
              readOnly={!canEdit}
              maxLength={MESSAGE_MAX_LENGTH}
              value={draft}
              error={
                error
                  ? t(`messages.template.errors.${error}`, {
                      max: format.number(MESSAGE_MAX_LENGTH),
                    })
                  : undefined
              }
              onChange={(change) => setDraft(change.target.value)}
            />
          </div>
        </div>
        {!hasVariable(draft, 'rsvp_url') && draft.trim() !== '' && (
          <Notice tone="warning" title={t('messages.template.noLinkTitle')}>
            {t('messages.template.noLinkBody', { variable: '{{rsvp_url}}' })}
          </Notice>
        )}
        {unknownVariables.length > 0 && (
          <Notice tone="warning" title={t('messages.template.unknownTitle')}>
            {t('messages.template.unknownBody', {
              names: unknownVariables.map((name) => `{{${name}}}`).join(', '),
            })}
          </Notice>
        )}
        <div className={styles.variables}>
          {canEdit && (
            <div className={styles.stack}>
              <h3 className={styles.subheading}>
                {t('messages.template.insertVariable')}
              </h3>
              <div className={styles.chips}>
                {MESSAGE_VARIABLES.map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    className={styles.chip}
                    dir="ltr"
                    aria-label={t('messages.template.insert', {
                      variable: `{{${variable}}}`,
                    })}
                    onClick={() => insert(`{{${variable}}}`)}
                  >
                    {`{{${variable}}}`}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={styles.available}>
            <h3 className={styles.availableTitle}>
              {t('messages.template.available')}
            </h3>
            <dl className={styles.availableList}>
              {MESSAGE_VARIABLES.map((variable) => (
                <div key={variable} style={{ display: 'contents' }}>
                  <dt dir="ltr">{`{{${variable}}}`}</dt>
                  <dd>{t(`messages.variables.${variable}`)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </form>
    </Card>
  )

  const previewCard = (
    <Card
      title={t('messages.preview.title')}
      subtitle={t('messages.preview.subtitle')}
    >
      <div className={styles.stack}>
        {sortedGuests.length > 0 ? (
          <>
            <SelectField
              label={t('messages.preview.for')}
              searchable
              emptyLabel={t('messages.preview.noMatch')}
              value={previewGuest?.id ?? ''}
              onChange={(change) => setChosenGuestId(change.target.value)}
            >
              {sortedGuests.map((guest) => (
                <option key={guest.id} value={guest.id}>
                  {guestFullName(guest)}
                </option>
              ))}
            </SelectField>
            <p className={styles.hint}>{t('messages.preview.resolved')}</p>
          </>
        ) : (
          guests.data && (
            <p className={styles.hint}>{t('messages.preview.sampleNote')}</p>
          )
        )}
        {values.isError ? (
          <ErrorState
            description={describeError(t, values.error)}
            onRetry={() => void values.refetch()}
          />
        ) : preview === null || !values.data ? (
          <LoadingState />
        ) : (
          <div
            className={styles.phoneArea}
            role="group"
            aria-label={t('messages.preview.phoneLabel')}
          >
            <div className={styles.phone}>
              <div className={styles.chatHeader}>
                <Avatar
                  name={`${values.data.first_name} ${values.data.last_name}`}
                />
                <div>
                  <p className={styles.chatName}>
                    {`${values.data.first_name} ${values.data.last_name}`.trim()}
                  </p>
                  <p className={styles.chatStatus}>
                    {t('messages.preview.online')}
                  </p>
                </div>
              </div>
              <div className={styles.chat}>
                {preview.trim() === '' ? (
                  <p className={styles.hint}>{t('messages.preview.empty')}</p>
                ) : (
                  <div className={styles.bubble}>
                    <MessageText message={preview} />
                    <p className={styles.bubbleTime}>
                      {format.time(previewTime)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div>
          <h3 className={styles.subheading}>
            {t('messages.preview.detailsTitle')}
          </h3>
          <ul className={styles.details}>
            <li>
              <Info aria-hidden="true" size={16} />{' '}
              {t('messages.preview.detailGuest')}
            </li>
            <li>
              <Info aria-hidden="true" size={16} />{' '}
              {t('messages.preview.detailLink')}
            </li>
          </ul>
        </div>
      </div>
    </Card>
  )

  const sentCard = (
    <Card
      title={t('messages.sent.title')}
      subtitle={t('messages.sent.subtitle')}
    >
      <SentMessages eventId={eventId} canSend={canEdit} />
    </Card>
  )

  return (
    <>
      <PageHeader
        title={t('pages.messages')}
        subtitle={t(
          !isDesktop && view === 'preview'
            ? 'messages.previewSubtitle'
            : 'messages.subtitle',
        )}
        compactActions="bar"
        actions={headerActions}
      />
      <div className={styles.page}>
        <ReadOnlyNotice />
        {failure && <FailureNotice message={failure} />}
        {isDesktop ? (
          <>
            <div className={styles.columns}>
              {templateCard}
              {previewCard}
            </div>
            {sentCard}
          </>
        ) : (
          <Tabs
            label={t('messages.tabs.label')}
            variant="segmented"
            value={view}
            onChange={(id) => setView(id === 'preview' ? 'preview' : 'editor')}
            tabs={[
              {
                id: 'editor',
                label: t('messages.tabs.editor'),
                panel: (
                  <div className={styles.page}>
                    {templateCard}
                    {sentCard}
                  </div>
                ),
              },
              {
                id: 'preview',
                label: t('messages.tabs.preview'),
                panel: previewCard,
              },
            ]}
          />
        )}
      </div>
      <UnsavedChangesGuard active={isDirty} onSave={saveChanges} />
    </>
  )
}

export function MessagesPage() {
  const { t } = useTranslation()
  const { eventId = '' } = useParams()
  const template = useMessageTemplate(eventId)

  if (!template.data) {
    return (
      <>
        <PageHeader
          title={t('pages.messages')}
          subtitle={t('messages.subtitle')}
        />
        <Card>
          {template.isError ? (
            <ErrorState
              description={describeError(t, template.error)}
              onRetry={() => void template.refetch()}
            />
          ) : (
            <LoadingState />
          )}
        </Card>
      </>
    )
  }
  // Another event gets a fresh editor rather than the previous one's draft.
  return <Messages key={eventId} eventId={eventId} saved={template.data.body} />
}
