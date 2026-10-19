// Converts a public Google Form into a questionnaireTemplates doc (bypasses rules via firebase-admin, like set-admin.mjs).
//   node scripts/import-google-form.mjs --url https://forms.gle/... [--title "..."] [--prod] [--project <id>]
import { randomUUID } from 'node:crypto'
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

function parseArgs(argv) {
  const args = { emulator: true }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') args.url = argv[++i]
    else if (argv[i] === '--title') args.title = argv[++i]
    else if (argv[i] === '--prod') args.emulator = false
    else if (argv[i] === '--project') args.project = argv[++i]
  }
  return args
}

const { url, title, emulator, project } = parseArgs(process.argv.slice(2))

if (!url) {
  console.error('Usage: node scripts/import-google-form.mjs --url <google form url> [--title "..."] [--prod] [--project <id>]')
  process.exit(1)
}

const html = await (await fetch(url)).text()
const match = html.match(/FB_PUBLIC_LOAD_DATA_ = (.*?);<\/script>/s)
if (!match) {
  console.error('Could not read form data — is the form public?')
  process.exit(1)
}
const data = JSON.parse(match[1])

// Google Forms item types: 0 short answer, 1 paragraph, 2 multiple choice, 3 dropdown, 4 checkboxes.
// Others (section headers, images, ...) carry no answer and are skipped.
// Choice items become required dropdowns rather than 'bool': a required bool passes unchecked,
// whereas a required dropdown forces an explicit pick of e.g. "I Agree".
const questions = []
for (const item of data[1][1]) {
  const [, label, , type, fields] = item
  const field = fields?.[0]
  if (![0, 1, 2, 3, 4].includes(type) || !field) continue
  const question = { id: randomUUID(), label: String(label).trim(), type: type <= 1 ? 'text' : 'dropdown', required: field[2] === 1 }
  if (question.type === 'dropdown') question.options = field[1].map((option) => option[0])
  questions.push(question)
}

const projectId = project ?? process.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-ars-dream'
if (emulator) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
  initializeApp({ projectId })
} else {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON path before running with --prod.')
    process.exit(1)
  }
  initializeApp({ credential: applicationDefault(), projectId })
}

const ref = await getFirestore()
  .collection('questionnaireTemplates')
  .add({
    title: title ?? data[1][8] ?? data[3],
    questions,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

console.log(`Imported ${questions.length} questions as template ${ref.id} on ${projectId}${emulator ? ' [emulator]' : ''}.`)
process.exit(0)
