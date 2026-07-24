import { useState, type FormEvent, type ReactNode } from 'react'
import { PlusIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { MarathonQuestion, QuestionnaireTemplate, QuestionType } from '@/types'

import { createQuestionnaireTemplate, updateQuestionnaireTemplate } from '@/features/questionnaire-templates/api'

let nextRowId = 0

interface QuestionRow {
  rowId: number
  /** The question's persisted id — kept stable across edits. */
  id: string
  label: string
  type: QuestionType
  required: boolean
  /** Comma-separated choices, only used for 'dropdown' items. */
  options: string
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  bool: 'Yes/No',
  text: 'Short text',
  int: 'Number',
  dropdown: 'Multiple choice',
}

function toQuestionRows(questions: MarathonQuestion[] | undefined): QuestionRow[] {
  return (questions ?? []).map((question) => ({
    rowId: nextRowId++,
    id: question.id,
    label: question.label,
    type: question.type,
    required: question.required,
    options: (question.options ?? []).join(', '),
  }))
}

export function QuestionnaireTemplateFormDialog({
  template,
  trigger,
}: {
  /** When provided, the dialog edits this template instead of creating a new one. */
  template?: QuestionnaireTemplate
  /** Custom trigger element; defaults to a "New Template" or "Edit" button. */
  trigger?: ReactNode
}) {
  const isEditing = template != null
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [questionRows, setQuestionRows] = useState<QuestionRow[]>(() => toQuestionRows(template?.questions))

  function addQuestion() {
    setQuestionRows((rows) => [
      ...rows,
      { rowId: nextRowId++, id: crypto.randomUUID(), label: '', type: 'bool', required: false, options: '' },
    ])
  }

  function removeQuestion(rowId: number) {
    setQuestionRows((rows) => rows.filter((row) => row.rowId !== rowId))
  }

  function updateQuestionRow(rowId: number, patch: Partial<Omit<QuestionRow, 'rowId' | 'id'>>) {
    setQuestionRows((rows) => rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const questions: MarathonQuestion[] = questionRows
      .filter((row) => row.label.trim())
      .map((row) => ({
        id: row.id,
        label: row.label.trim(),
        type: row.type,
        required: row.required,
        ...(row.type === 'dropdown'
          ? { options: row.options.split(',').map((option) => option.trim()).filter(Boolean) }
          : {}),
      }))

    if (questions.length === 0) {
      toast.error('Add at least one question.')
      return
    }

    const form = new FormData(event.currentTarget)
    const input = { title: String(form.get('title')), questions }

    setIsSubmitting(true)
    try {
      if (isEditing) {
        await updateQuestionnaireTemplate(template.id, input)
        toast.success('Template updated.')
      } else {
        await createQuestionnaireTemplate(input)
        toast.success('Template created.')
        setQuestionRows([])
      }
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant={isEditing ? 'outline' : 'default'} size={isEditing ? 'sm' : 'default'}>
            {isEditing ? 'Edit' : 'New Template'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Questionnaire Template' : 'New Questionnaire Template'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="e.g. Standard International Tour Questionnaire"
              required
              defaultValue={template?.title}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>Questions</Label>
              <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                <PlusIcon className="size-3.5" />
                Add item
              </Button>
            </div>

            {questionRows.length === 0 && (
              <p className="text-muted-foreground rounded-md border border-dashed border-border p-3 text-center text-xs">
                No items yet. Add at least one.
              </p>
            )}

            {questionRows.map((question) => (
              <div key={question.rowId} className="flex flex-col gap-2 rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Item label (e.g. Emergency contact number)"
                    value={question.label}
                    onChange={(e) => updateQuestionRow(question.rowId, { label: e.target.value })}
                    className="flex-1"
                  />
                  <Select
                    value={question.type}
                    onValueChange={(value) => updateQuestionRow(question.rowId, { type: value as QuestionType })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeQuestion(question.rowId)}
                    aria-label="Remove item"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-4 pl-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={question.required}
                      onChange={(e) => updateQuestionRow(question.rowId, { required: e.target.checked })}
                    />
                    Required
                  </label>
                  {question.type === 'dropdown' && (
                    <Input
                      placeholder="Choices, comma-separated (e.g. Vegetarian, Vegan, None)"
                      value={question.options}
                      onChange={(e) => updateQuestionRow(question.rowId, { options: e.target.value })}
                      className="flex-1"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="submit" loading={isSubmitting}>
              {isEditing ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
