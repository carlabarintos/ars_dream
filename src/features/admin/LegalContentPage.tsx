import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { saveLegalContent } from '@/features/legal/api'
import { useLegalContent } from '@/features/legal/use-legal-content'
import type { LegalPageId } from '@/types'

const PAGES: { id: LegalPageId; title: string; path: string }[] = [
  { id: 'terms', title: 'Terms of Service', path: '/terms' },
  { id: 'privacy', title: 'Privacy Policy', path: '/privacy' },
]

function LegalContentEditor({ id, title, path }: { id: LegalPageId; title: string; path: string }) {
  const { content, isLoading } = useLegalContent(id)
  const [body, setBody] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Only re-syncs from the live snapshot before the admin starts typing —
  // once isDirty, the textarea stays as the source of truth until Save.
  useEffect(() => {
    if (!isLoading && !isDirty) {
      setBody(content?.body ?? '')
    }
  }, [isLoading, isDirty, content?.body])

  async function handleSave() {
    setIsSaving(true)
    try {
      await saveLegalContent(id, body)
      setIsDirty(false)
      toast.success(`${title} saved.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl tracking-wide">{title}</h2>
        <Button variant="outline" size="sm" asChild>
          <Link to={path} target="_blank" rel="noreferrer">
            View live page
          </Link>
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Separate paragraphs with a blank line. Leave blank and save to fall back to this page's built-in
        default copy instead.
      </p>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <>
          <Textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              setIsDirty(true)
            }}
            rows={10}
            placeholder="Currently showing this page's built-in default copy."
          />
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground text-xs">
              {content?.body
                ? `Custom content — last saved ${content.updatedAt?.toDate().toLocaleString() ?? 'just now'}.`
                : 'Using the built-in default copy.'}
            </span>
            <Button size="sm" onClick={handleSave} loading={isSaving} disabled={!isDirty}>
              Save
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

export function LegalContentPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wide">Legal Pages</h1>
          <p className="text-muted-foreground mt-1">
            Override the Terms of Service and Privacy Policy shown at /terms and /privacy.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/admin">Back to Admin</Link>
        </Button>
      </div>

      {PAGES.map((page) => (
        <LegalContentEditor key={page.id} id={page.id} title={page.title} path={page.path} />
      ))}
    </div>
  )
}
