import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { deleteQuestionnaireTemplate } from '@/features/questionnaire-templates/api'
import { useQuestionnaireTemplates } from '@/features/questionnaire-templates/use-questionnaire-templates'

import { QuestionnaireTemplateFormDialog } from './QuestionnaireTemplateFormDialog'

export function QuestionnaireTemplatesPage() {
  const { templates, isLoading } = useQuestionnaireTemplates()

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Delete template "${title}"? Marathons that already loaded from it are unaffected.`)) return
    try {
      await deleteQuestionnaireTemplate(id)
      toast.success('Template deleted.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wide">Questionnaire Templates</h1>
          <p className="text-muted-foreground mt-1">
            Author reusable sets of registration questions, then load one as a starting point when
            editing a marathon.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin">Back to Admin</Link>
          </Button>
          <QuestionnaireTemplateFormDialog />
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : templates.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed border-border p-6 text-center text-sm">
          No templates yet. Create one to reuse across marathons.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Questions</TableHead>
              <TableHead>Last updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">{template.title}</TableCell>
                <TableCell>{template.questions.length}</TableCell>
                <TableCell>
                  {template.updatedAt ? template.updatedAt.toDate().toLocaleDateString() : '—'}
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <QuestionnaireTemplateFormDialog template={template} />
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(template.id, template.title)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
