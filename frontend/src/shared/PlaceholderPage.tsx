import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card } from './ui/Card.tsx'
import { PageHeader } from './ui/PageHeader.tsx'
import { EmptyState } from './ui/States.tsx'

export function PlaceholderPage({ title }: { title: string }) {
  const { t } = useTranslation()

  return (
    <>
      <PageHeader title={title} />
      <Card>
        <EmptyState
          icon={<Clock />}
          title={t('placeholder.title')}
          description={t('placeholder.body')}
        />
      </Card>
    </>
  )
}
