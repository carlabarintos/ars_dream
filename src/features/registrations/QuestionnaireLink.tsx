import { useState } from 'react'
import { ClipboardListIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Marathon, Registration } from '@/types'

/** "View questionnaire" link that opens the booking's answers in a popup; renders nothing if the event has no questionnaire. */
export function QuestionnaireLink({
  registration,
  marathon,
}: {
  registration: Registration
  marathon: Marathon | undefined
}) {
  const [open, setOpen] = useState(false)
  if (!marathon?.questions?.length) return null
  const answers = registration.answers ?? []

  return (
    <>
      <Button variant="link" size="sm" className="h-auto self-start p-0" onClick={() => setOpen(true)}>
        <ClipboardListIcon />
        {answers.length ? 'View questionnaire answers' : 'Questionnaire — not answered yet'}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Questionnaire</DialogTitle>
            <DialogDescription>{marathon.title}</DialogDescription>
          </DialogHeader>
          {answers.length === 0 ? (
            <p className="text-muted-foreground text-sm">Not answered yet.</p>
          ) : (
            <dl className="flex flex-col gap-3 text-sm">
              {answers.map((answer) => (
                <div key={answer.questionId}>
                  <dt className="text-muted-foreground text-xs">{answer.label}</dt>
                  <dd className="whitespace-pre-line">{answer.value || '—'}</dd>
                </div>
              ))}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
