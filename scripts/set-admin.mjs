import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

function parseArgs(argv) {
  const args = { emulator: true }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--email') args.email = argv[++i]
    else if (argv[i] === '--prod') args.emulator = false
    else if (argv[i] === '--project') args.project = argv[++i]
  }
  return args
}

const { email, emulator, project } = parseArgs(process.argv.slice(2))

if (!email) {
  console.error('Usage: npm run set-admin -- --email you@example.com [--prod] [--project <id>]')
  process.exit(1)
}

const projectId = project ?? process.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-ars-dream'

if (emulator) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
  initializeApp({ projectId })
} else {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error(
      'Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON path before running with --prod.',
    )
    process.exit(1)
  }
  initializeApp({ credential: applicationDefault(), projectId })
}

const auth = getAuth()
const db = getFirestore()

const user = await auth.getUserByEmail(email).catch(() => null)
if (!user) {
  console.error(
    `No ${emulator ? 'emulator' : 'production'} auth user found for ${email}. Sign up in the app first, then re-run this script.`,
  )
  process.exit(1)
}

const userRef = db.collection('users').doc(user.uid)
const snapshot = await userRef.get()

if (snapshot.exists) {
  await userRef.update({ role: 'admin' })
} else {
  await userRef.set({
    uid: user.uid,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    photoURL: user.photoURL ?? null,
    role: 'admin',
    fcmTokens: [],
    createdAt: FieldValue.serverTimestamp(),
  })
}

console.log(`${email} (${user.uid}) is now an admin on ${projectId}${emulator ? ' [emulator]' : ''}.`)
process.exit(0)
