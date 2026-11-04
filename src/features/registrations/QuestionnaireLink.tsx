import { useState } from 'react'
import { ClipboardListIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Marathon, Registration } from '@/types'

import { getQuestionnaires, getRunners, runnerPrefix } from './registration-flow'

/**
 * One link per named questionnaire. An answered one opens its answers in a popup; an unanswered one
 * calls onAnswer when given (the registrant's own booking), otherwise shows "not answered yet".
 * Renders nothing if the event has no questionnaire.
 */
export function QuestionnaireLink({
  registration,
  marathon,
  onAnswer,
}: {
  registration: Registration
  marathon: Marathon | undefined
  onAnswer?: (questionnaireName: string) => void
}) {
  const [open, setOpen] = useState<{ name: string; runner: number } | null>(null)
  const questionnaires = getQuestionnaires(marathon)
  if (!marathon || questionnaires.length === 0) return null
  const runners = getRunners(registration, marathon)
  const knownIds = new Set(questionnaires.flatMap((q) => q.questions.map((item) => item.id)))
  // Answers to since-deleted questions stay visible under the first questionnaire.
  const answersFor = (name: string, runner: number) =>
    (runners[runner]?.answers ?? []).filter((answer) =>
      knownIds.has(answer.questionId)
        ? questionnaires.find((q) => q.name === name)?.questions.some((item) => item.id === answer.questionId)
        : name === questionnaires[0].name,
    )
  const openAnswers = open ? answersFor(open.name, open.runner) : []

  return (
    <>
      {runners.flatMap((_, runner) =>
        questionnaires.map(({ name }) => {
          const isAnswered = answersFor(name, runner).length > 0
          const label = `${runnerPrefix(runner, runners.length, runners[runner]?.name)}${name}`
          return (
            <Button
              key={`${runner}-${name}`}
              variant="link"
              size="sm"
              className="h-auto self-start p-0"
              onClick={() => (!isAnswered && onAnswer ? onAnswer(name) : setOpen({ name, runner }))}
            >
              <ClipboardListIcon />
              {isAnswered ? `View ${label} answers` : onAnswer ? `Answer ${label}` : `${label} — not answered yet`}
            </Button>
          )
        }),
      )}
      <Dialog open={open != null} onOpenChange={(isOpen) => !isOpen && setOpen(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{open && `${runnerPrefix(open.runner, runners.length, runners[open.runner]?.name)}${open.name}`}</DialogTitle>
            <DialogDescription>{marathon.title}</DialogDescription>
          </DialogHeader>
          {openAnswers.length === 0 ? (
            <p className="text-muted-foreground text-sm">Not answered yet.</p>
          ) : (
            <dl className="flex flex-col gap-3 text-sm">
              {openAnswers.map((answer) => (
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
