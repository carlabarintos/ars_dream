// Run after `npm --prefix functions run build`: node scripts/check-runner-bookings.mjs
// Runners 2+ get their own booking at their share: registered emails now, others once the invite link's token is claimed.
import assert from 'node:assert/strict'

process.env.GCLOUD_PROJECT ??= 'demo-ars-dream'
process.env.RESEND_API_KEY = 're_test'
const { auth, db } = await import('../functions/lib/admin.js')
const { claimInvite, syncRunnerBookings } = await import('../functions/lib/on-registration-runners-change.js')
const { describeCompanionChanges } = await import('../functions/lib/runners.js')

const store = new Map()
// Booking history entries and internal notes.
const added = []
const docRef = (path) => ({
  id: path.split('/')[1],
  get: async () => ({ id: path.split('/')[1], data: () => store.get(path), exists: store.has(path) }),
  set: async (data) => void store.set(path, data),
  update: async (data) => {
    assert.ok(Object.keys(data).length > 0, 'Firestore rejects an empty update')
    const merged = { ...store.get(path), ...data }
    for (const key of Object.keys(data)) if (data[key]?.methodName === 'FieldValue.delete') delete merged[key]
    store.set(path, merged)
  },
  delete: async () => void store.delete(path),
  collection: (name) => ({ doc: () => docRef(`${name}/x`), add: async (data) => void added.push({ path, name, ...data }) }),
})
db.runTransaction = (run) => run({ get: (ref) => ref.get(), update: (ref, data) => ref.update(data) })
db.batch = () => {
  const writes = []
  return { update: (ref, data) => writes.push(() => ref.update(data)), commit: () => Promise.all(writes.map((write) => write())) }
}
db.collection = (name) => ({
  doc: (id) => docRef(`${name}/${id}`),
  where: (field, _op, value) => ({
    get: async () => ({
      docs: [...store]
        .filter(([path, data]) => path.startsWith(`${name}/`) && data[field] === value)
        .map(([path, data]) => ({ id: path.split('/')[1], ref: docRef(path), data: () => data })),
    }),
  }),
})

const accounts = new Map([['lead@x.com', 'lead'], ['known@x.com', 'known']])
auth.getUserByEmail = async (email) => {
  if (accounts.has(email)) return { uid: accounts.get(email) }
  throw Object.assign(new Error('none'), { code: 'auth/user-not-found' })
}

// Captures what Resend would have sent.
const emails = []
globalThis.fetch = async (_url, init) => {
  emails.push(JSON.parse(init.body))
  return new Response('{"id":"x"}', { status: 200, headers: { 'content-type': 'application/json' } })
}

store.set('marathons/m', {
  title: 'Berlin',
  packages: [{ id: 'duo', runnerCount: 2, priceAmount: 9000, priceCurrency: 'USD', depositAmount: 1000 }, { id: 'solo', priceAmount: 5000, priceCurrency: 'USD' }],
})
store.set('users/lead', { firstName: 'Lea<b>', email: 'lead@x.com' })
store.set('users/known', { email: 'known@x.com', fcmTokens: [] })
const booking = (companions, extra = {}) => ({
  userId: 'lead', marathonId: 'm', cycle: 1, packageId: 'duo', packageName: 'Runner + Runner', packagePriceAmount: 4500, status: 'terms_accepted', companions, ...extra,
})
const bookingDoc = () => store.get('runnerBookings/r_2')

// An unregistered runner gets one sign-up invite and a doc waiting for them, with none of the lead's private data.
await syncRunnerBookings('r', booking([{ name: 'New', email: 'New@x.com' }], { passportPhotoUrl: 'secret', answers: [] }))
assert.equal(emails.length, 1)
assert.equal(String(emails[0].to), 'new@x.com')
assert.match(emails[0].subject, /offered a place as Runner 2 — Berlin/)
assert.match(emails[0].html, /Create My Account/)
assert.match(emails[0].html, /mode=sign-up&amp;email=new%40x\.com|mode=sign-up&email=new%40x\.com/)
const { inviteToken } = bookingDoc()
assert.match(inviteToken, /^[0-9a-f]{64}$/)
assert.ok(emails[0].html.includes(`runnerInvite=${inviteToken}`))
assert.match(emails[0].html, /Lea&lt;b&gt;/)
assert.doesNotMatch(emails[0].html, /Lea<b>/)
assert.equal(bookingDoc().userId, null)
assert.equal(bookingDoc().runner, 2)
assert.doesNotMatch(JSON.stringify(bookingDoc()), /secret|answers/)

// A later status change mirrors onto the same doc, with no second invite.
await syncRunnerBookings('r', booking([{ name: 'New', email: 'new@x.com' }], { status: 'deposit_paid' }))
assert.equal(bookingDoc().status, 'deposit_paid')
assert.equal(emails.length, 1)

// Someone signing up with the invited email doesn't get the booking, even after a later sync finds their account.
accounts.set('new@x.com', 'squatter')
await syncRunnerBookings('r', booking([{ name: 'New', email: 'new@x.com' }], { status: 'final_invoiced' }))
assert.equal(bookingDoc().userId, null)
assert.equal(bookingDoc().inviteToken, inviteToken)
assert.equal(emails.length, 1)

// A bad token, or the right token on another email, claims nothing.
await assert.rejects(claimInvite('wrong', 'new-uid', 'new@x.com'), /no longer valid/)
await assert.rejects(claimInvite(inviteToken, 'other', 'other@x.com'), /This invite is for new@x\.com/)
assert.equal(bookingDoc().userId, null)

// The link's token, signed in as the invited email, does. Opening it twice is fine, and syncs keep the link.
assert.equal(store.get('registrations/new-uid_m_1'), undefined)
assert.equal((await claimInvite(inviteToken, 'new-uid', 'NEW@x.com')).runner, 2)
assert.equal(store.get('registrations/new-uid_m_1').status, 'accepted')
store.delete('registrations/new-uid_m_1')
store.set('runnerBookings/r_2', { ...bookingDoc(), userId: null })
assert.equal((await claimInvite(inviteToken, 'new-uid', 'NEW@x.com')).runner, 2)
await claimInvite(inviteToken, 'new-uid', 'new@x.com')
assert.equal(bookingDoc().userId, 'new-uid')
await syncRunnerBookings('r', booking([{ name: 'New', email: 'new@x.com' }], { status: 'confirmed' }))
assert.equal(bookingDoc().userId, 'new-uid')
assert.equal(emails.length, 1)

// Swapping in a registered runner links them at once and just tells them.
await syncRunnerBookings('r', booking([{ name: 'Known', email: 'known@x.com' }]))
assert.equal(bookingDoc().userId, 'known')
assert.equal(bookingDoc().inviteToken, undefined)
await assert.rejects(claimInvite(inviteToken, 'new-uid', 'new@x.com'), /no longer valid/)
assert.equal(emails.length, 2)
assert.match(emails[1].html, /View My Booking/)
assert.doesNotMatch(emails[1].html, /Create My Account/)

// An ended booking stays visible as ended, and invites nobody new.
await syncRunnerBookings('r', booking([{ name: 'Late', email: 'late@x.com' }], { status: 'cancelled' }))
assert.equal(bookingDoc().status, 'cancelled')
assert.equal(bookingDoc().userId, 'known')
assert.equal(store.get('registrations/known_m_1').status, 'cancelled')
assert.equal(emails.length, 3)
assert.match(emails[2].subject, /place was cancelled/)

// Dropping to a solo package removes the runner's record.
await syncRunnerBookings('r', booking([{ name: 'Known', email: 'known@x.com' }], { packageId: 'solo' }))
assert.equal(bookingDoc(), undefined)

// The lead entering their own email links nobody.
await syncRunnerBookings('r', booking([{ name: 'Me', email: 'lead@x.com' }]))
assert.equal(bookingDoc(), undefined)
assert.equal(emails.length, 3)

// An admin's first entry is logged as a change; the lead's own first entry isn't.
const admin = { companionsEditedBy: 'admin', companions: [{ name: 'New', email: 'new@x.com' }] }
assert.match(describeCompanionChanges({}, admin), /Runner 2: added → New \(new@x\.com\)/)
assert.equal(describeCompanionChanges({}, { ...admin, companionsEditedBy: 'user' }), '')
// Removing a runner is logged too.
assert.match(describeCompanionChanges(admin, { companionsEditedBy: 'admin', companions: [] }), /Runner 2 removed: New \(new@x\.com\)/)

// A registered runner with nothing on this tour gets their own open offer at their share, which is a full booking.
store.delete('registrations/known_m_1')
store.delete('runnerBookings/r_2')
await syncRunnerBookings('r', booking([{ name: 'Known', email: 'known@x.com' }]))
const own = 'registrations/known_m_1'
const offer = store.get(own)
assert.equal(offer.userId, 'known')
assert.equal(offer.status, 'accepted')
assert.equal(offer.packagePriceAmount, 4500)
assert.equal(offer.packagePriceCurrency, 'USD')
assert.deepEqual(offer.offeredPackageIds, ['duo'])
assert.deepEqual(offer.partOf, { registrationId: 'r', runner: 2, leadName: 'Lea<b>', packageName: 'Runner + Runner', hadOwnPlace: false })

// Default final invoice per runner: (9,000 total - 2,000 deposits) / 2.
const { bookingDeposit, packageLineItems } = await import('../functions/lib/email-template.js')
const duo = store.get('marathons/m').packages[0]
const finalBalance = (r) => packageLineItems(r).reduce((sum, item) => sum + item.amount, 0) - bookingDeposit(r, duo)
assert.equal(finalBalance(offer), (9000 - 2 * 1000) / 2)
assert.equal(finalBalance(booking([])), (9000 - 2 * 1000) / 2)

// Taken off with no place of their own: the booking is cancelled.
await syncRunnerBookings('r', booking([{ name: 'Known', email: 'known@x.com' }], { packageId: 'solo' }))
assert.equal(store.get(own).status, 'cancelled')
assert.equal(store.get(own).partOf, undefined)
assert.match(emails.at(-1).subject, /place was cancelled/)

// Already waitlisted: that entry becomes their booking, keeps its place in line, and their timeline and email say so.
const queued = { userId: 'known', marathonId: 'm', cycle: 1, status: 'queued', packageId: '', queuePosition: 3, createdAt: 'original' }
store.set(own, queued)
await syncRunnerBookings('r', booking([{ name: 'Known', email: 'known@x.com' }]))
assert.equal(store.get(own).status, 'accepted')
assert.equal(store.get(own).createdAt, 'original')
assert.equal(store.get(own).queuePosition, null)
assert.equal(store.get(own).partOf.hadOwnPlace, true)
assert.match(added.at(-1).text, /waitlist place was changed to Runner \+ Runner: you're now Runner 2 on Lea<b>'s booking/)
assert.match(emails.at(-1).html, /replaces your own entry/)

// Swapped out before paying: straight back to their original place, escaped in the email.
await syncRunnerBookings('r', booking([{ name: 'New', email: 'new@x.com' }]))
assert.equal(store.get(own).status, 'queued')
assert.equal(store.get(own).createdAt, 'original')
assert.equal(store.get(own).packageId, '')
assert.equal(store.get(own).partOf, undefined)
assert.equal(store.get(own).cancelledBy, undefined)
assert.match(emails.at(-1).subject, /back on the waitlist/)
assert.doesNotMatch(emails.at(-1).html, /Lea<b>/)

// The lead's booking being cancelled cancels theirs too, with no return to the waitlist.
await syncRunnerBookings('r', booking([{ name: 'Known', email: 'known@x.com' }]))
assert.equal(store.get(own).status, 'accepted')
await syncRunnerBookings('r', booking([{ name: 'Known', email: 'known@x.com' }], { status: 'cancelled' }))
assert.equal(store.get(own).status, 'cancelled')
assert.equal(store.get(own).cancelledBy, 'admin')
assert.equal(store.get(own).partOf, undefined)
assert.match(emails.at(-1).html, /booking was cancelled, so your place as Runner 2/)
assert.doesNotMatch(emails.at(-1).html, /Lea<b>/)

// A slot transferred away isn't over, so a runner who hadn't paid goes back to their place instead.
store.delete('runnerBookings/r_2')
store.set(own, queued)
await syncRunnerBookings('r', booking([{ name: 'Known', email: 'known@x.com' }]))
await syncRunnerBookings('r', booking([{ name: 'Known', email: 'known@x.com' }], { status: 'cancelled', transferredTo: {} }))
assert.equal(store.get(own).status, 'queued')
store.delete('runnerBookings/r_2')
store.set(own, queued)

// An open offer becomes their booking too, and comes back as a waitlist place rather than a revived offer.
store.delete('runnerBookings/r_2')
store.set(own, { ...queued, status: 'accepted', offeredAt: 'then', offeredPackageIds: ['solo'] })
await syncRunnerBookings('r', booking([{ name: 'Known', email: 'known@x.com' }]))
assert.deepEqual(store.get(own).offeredPackageIds, ['duo'])
assert.match(added.at(-1).text, /Your offer was changed/)
await syncRunnerBookings('r', booking([{ name: 'Known', email: 'known@x.com' }], { packageId: 'solo' }))
assert.equal(store.get(own).status, 'queued')
assert.equal(store.get(own).offeredAt, undefined)

// Already paying when taken off: left alone, with a note for staff on their booking.
await syncRunnerBookings('r', booking([{ name: 'Known', email: 'known@x.com' }]))
store.set(own, { ...store.get(own), status: 'deposit_paid', depositPaidAt: 'then', seatCount: 1 })
await syncRunnerBookings('r', booking([{ name: 'Known', email: 'known@x.com' }], { packageId: 'solo' }))
assert.equal(store.get(own).status, 'deposit_paid')
assert.equal(added.at(-1).name, 'internalNotes')
assert.equal(added.at(-1).path, own)

// Already paying when the lead's booking is cancelled: cancelled anyway, seat back, staff told, runner told.
store.set('runnerBookings/r_2', { userId: 'known', email: 'known@x.com', registrationId: 'r', marathonId: 'm', cycle: 1, runner: 2, leadName: 'Lea<b>', status: 'deposit_paid' })
await syncRunnerBookings('r', booking([{ name: 'Known', email: 'known@x.com' }], { status: 'cancelled' }))
assert.equal(store.get(own).status, 'cancelled')
assert.equal(store.get('marathons/m').confirmedCount?.operand, -1)
assert.ok(added.some((entry) => entry.name === 'internalNotes' && entry.path === own && /after this runner had paid/.test(entry.text)))
assert.match(emails.at(-1).html, /in touch about the payment/)
store.set('marathons/m', { ...store.get('marathons/m'), confirmedCount: 5 })

// An invite can't be claimed once the lead's booking has been cancelled.
store.delete(own)
store.set('runnerBookings/r_2', { userId: null, email: 'gone@x.com', inviteToken: 'dead', registrationId: 'r', marathonId: 'm', cycle: 1, runner: 2, status: 'terms_accepted' })
await syncRunnerBookings('r', booking([{ name: 'Gone', email: 'gone@x.com' }], { status: 'cancelled' }))
await assert.rejects(claimInvite('dead', 'gone-uid', 'gone@x.com'), /has been cancelled/)
assert.equal(store.get('registrations/gone-uid_m_1'), undefined)

// A booking of their own already under way: left alone, with a note on the lead's booking.
store.delete('runnerBookings/r_2')
store.set(own, { ...queued, status: 'deposit_paid' })
await syncRunnerBookings('r', booking([{ name: 'Known', email: 'known@x.com' }]))
assert.equal(store.get(own).status, 'deposit_paid')
assert.equal(store.get(own).partOf, undefined)
assert.equal(added.at(-1).path, 'registrations/r')
assert.match(added.at(-1).text, /deposit_paid/)
store.delete(own)
store.delete('runnerBookings/r_2')

// A cancelled entry of theirs is kept in their history when they join.
store.set(own, { ...queued, status: 'cancelled', createdAt: null })
await syncRunnerBookings('r', booking([{ name: 'Known', email: 'known@x.com' }]))
assert.equal(store.get(own).status, 'accepted')
assert.equal(store.get(own).previousRounds.length, 1)
assert.equal(store.get(own).partOf.hadOwnPlace, false)
store.delete(own)
store.delete('runnerBookings/r_2')

// A booking made when the lead held the whole package moves to their share, its seats still held for its runners.
store.set('registrations/old', booking([], { packagePriceAmount: 9000, seatCount: 2 }))
store.set('marathons/m', { ...store.get('marathons/m'), confirmedCount: 5 })
await syncRunnerBookings('old', booking([{ name: 'Known', email: 'known@x.com' }], { packagePriceAmount: 9000, seatCount: 2 }))
assert.equal(store.get('registrations/old').packagePriceAmount, 4500)
assert.equal(store.get('registrations/old').seatCount, 2)
assert.equal(store.get('marathons/m').confirmedCount, 5)

// One payment for both, whichever runner made it: the other's deposit is settled from it.
const { applyDepositToPackage } = await import('../functions/lib/apply-shared-deposit.js')
const paid = {
  depositPaidAt: 'then', depositPaidAmount: 1000, seatCount: 1, status: 'deposit_paid', proofOfPaymentUrls: ['proof'],
  depositProofUrls: ['proof'], depositProofSubmittedAt: 'when', approvedPaymentReferences: ['BDO-1'],
}
const partOf = { registrationId: 'p', runner: 2, leadName: 'Lea', packageName: 'Runner + Runner', hadOwnPlace: false }
const pkg = { marathonId: 'm', cycle: 1, packageId: 'duo', packageName: 'Runner + Runner', packagePriceAmount: 4500, proofOfPaymentUrls: [] }
const setup = (lead, runner) => {
  store.set('registrations/p', { userId: 'lead', ...pkg, ...lead })
  store.set('registrations/r2_m_1', { userId: 'r2', ...pkg, partOf, ...runner })
  store.set('runnerBookings/p_2', { userId: 'r2', email: 'r2@x.com', registrationId: 'p', marathonId: 'm', cycle: 1, runner: 2 })
  store.set('marathons/m', { ...store.get('marathons/m'), capacity: 10, confirmedCount: 1 })
}

setup(paid, { status: 'terms_accepted' })
assert.deepEqual((await applyDepositToPackage('p')).covered, ['r2_m_1'])
const covered = store.get('registrations/r2_m_1')
assert.equal(covered.status, 'deposit_paid')
assert.equal(covered.depositPaidAmount, 1000)
assert.equal(covered.depositCoveredBy, 'p')
assert.equal(covered.seatCount, 1)
assert.deepEqual(covered.depositProofUrls, ['proof'])
assert.deepEqual(covered.approvedPaymentReferences, ['BDO-1'])
assert.equal(store.get('marathons/m').confirmedCount?.operand, 1)
assert.match(added.at(-1).text, /Deposit covered by Runner 1's payment/)
// Each still owes (9,000 - 2,000) / 2 at the final invoice.
assert.equal(finalBalance(covered), 3500)

// The other way round, called from either booking.
setup({ status: 'terms_accepted' }, paid)
assert.deepEqual((await applyDepositToPackage('p')).covered, ['p'])
assert.equal(store.get('registrations/p').depositCoveredBy, 'r2_m_1')
assert.match(added.at(-1).text, /Deposit covered by Runner 2's payment/)
setup({ status: 'terms_accepted' }, paid)
assert.deepEqual((await applyDepositToPackage('r2_m_1')).covered, ['p'])

// Repeating it changes nothing, so no seat is counted twice.
store.set('marathons/m', { ...store.get('marathons/m'), confirmedCount: 7 })
assert.deepEqual((await applyDepositToPackage('p')).covered, [])
assert.equal(store.get('marathons/m').confirmedCount, 7)

// T&C are their own step: an open offer is left, reported as waiting, and covered once they've accepted.
setup(paid, { status: 'accepted' })
let result = await applyDepositToPackage('p')
assert.deepEqual([result.covered, result.waiting], [[], 1])
assert.equal(store.get('registrations/r2_m_1').status, 'accepted')
assert.equal(store.get('registrations/p').depositCoversPackage, true)
store.set('registrations/r2_m_1', { ...store.get('registrations/r2_m_1'), status: 'terms_accepted' })
assert.deepEqual((await applyDepositToPackage('r2_m_1', { automatic: true })).covered, ['r2_m_1'])
assert.equal(store.get('registrations/r2_m_1').status, 'deposit_paid')
assert.equal(store.get('registrations/r2_m_1').depositCoveredBy, 'p')

// Without an admin saying the payment covers everyone, accepting T&C leaves them to pay, with no refusal to stop the invoice.
setup(paid, { status: 'terms_accepted' })
assert.deepEqual((await applyDepositToPackage('r2_m_1', { automatic: true })).covered, [])
assert.equal(store.get('registrations/r2_m_1').status, 'terms_accepted')
setup({ status: 'terms_accepted' }, { status: 'terms_accepted' })
assert.deepEqual((await applyDepositToPackage('p', { automatic: true })).covered, [])

// No seat left: the runner is invoiced as normal rather than held up.
setup({ ...paid, depositCoversPackage: true }, { status: 'terms_accepted' })
store.set('marathons/m', { ...store.get('marathons/m'), capacity: 1, confirmedCount: 1 })
assert.deepEqual((await applyDepositToPackage('r2_m_1', { automatic: true })).covered, [])
assert.equal(store.get('registrations/r2_m_1').status, 'terms_accepted')

// Their own proof under review stays with the admin, as does an invite nobody has taken up.
setup(paid, { status: 'payment_submitted' })
result = await applyDepositToPackage('p')
assert.deepEqual([result.covered, result.waiting], [[], 1])
setup(paid, { status: 'terms_accepted' })
store.set('runnerBookings/p_2', { userId: null, email: 'r2@x.com', registrationId: 'p', marathonId: 'm', cycle: 1, runner: 2 })
result = await applyDepositToPackage('p')
assert.deepEqual([result.covered, result.waiting], [[], 1])

// Nothing approved yet, or no seat left: refused.
setup({ status: 'terms_accepted' }, { status: 'terms_accepted' })
await assert.rejects(applyDepositToPackage('p'), /Approve one runner's deposit first/)
setup(paid, { status: 'terms_accepted' })
store.set('marathons/m', { ...store.get('marathons/m'), capacity: 1, confirmedCount: 1 })
await assert.rejects(applyDepositToPackage('p'), /no remaining capacity/)
assert.equal(store.get('registrations/r2_m_1').status, 'terms_accepted')

// Two single runners combine: an admin moves Runner 2's booking onto the package, as it stands.
const soloPackage = { packageId: 'solo', packageName: 'Solo', packagePriceAmount: 5000, packagePriceCurrency: 'USD', selectedAddOns: [{ name: 'Tee', priceAmount: 50 }] }
const solo = (extra) => ({ userId: 'known', marathonId: 'm', cycle: 1, ...soloPackage, createdAt: 'original', ...extra })
const leadDuo = booking([{ name: 'Known', email: 'known@x.com' }])
const reset = (extra) => {
  store.delete('runnerBookings/r_2')
  store.set(own, solo(extra))
  store.set('marathons/m', { ...store.get('marathons/m'), confirmedCount: 5 })
}

// Deposit paid: status, deposit and seat stay; the price drops to their share; the credit stays what they paid.
reset({ status: 'deposit_paid', depositPaidAt: 'then', depositPaidAmount: 700, seatCount: 1 })
let sent = emails.length
await syncRunnerBookings('r', leadDuo, { byAdmin: true })
let merged = store.get(own)
assert.equal(merged.status, 'deposit_paid')
assert.equal(merged.packageId, 'duo')
assert.equal(merged.packagePriceAmount, 4500)
assert.equal(merged.depositPaidAmount, 700)
assert.equal(merged.seatCount, 1)
assert.equal(merged.createdAt, 'original')
assert.deepEqual(merged.selectedAddOns, soloPackage.selectedAddOns)
assert.equal(merged.partOf.previousPackage.packageId, 'solo')
assert.equal(store.get('marathons/m').confirmedCount, 5)
assert.equal(emails.length, sent + 1)
assert.match(emails.at(-1).html, /moved your booking onto Lea&lt;b&gt;'s Runner \+ Runner package/)

// Under review: the proof stays where it is for the admin to approve.
reset({ status: 'payment_submitted', proofOfPaymentUrls: ['proof'] })
await syncRunnerBookings('r', leadDuo, { byAdmin: true })
assert.equal(store.get(own).status, 'payment_submitted')
assert.deepEqual(store.get(own).proofOfPaymentUrls, ['proof'])
assert.equal(store.get(own).packagePriceAmount, 4500)

// A deposit approved before depositPaidAmount existed is pinned to what the old package asked for.
store.set('marathons/m', { ...store.get('marathons/m'), packages: [store.get('marathons/m').packages[0], { ...store.get('marathons/m').packages[1], depositAmount: 500 }] })
reset({ status: 'deposit_paid', depositPaidAt: 'then' })
await syncRunnerBookings('r', leadDuo, { byAdmin: true })
assert.equal(store.get(own).depositPaidAmount, 500)

// Taken off again: back on their own package, with everything else intact.
await syncRunnerBookings('r', booking([{ name: 'New', email: 'new@x.com' }]))
assert.equal(store.get(own).packageId, 'solo')
assert.equal(store.get(own).packagePriceAmount, 5000)
assert.deepEqual(store.get(own).selectedAddOns, soloPackage.selectedAddOns)
assert.equal(store.get(own).status, 'deposit_paid')
assert.equal(store.get(own).partOf, undefined)

// A lead's entry can't touch it. Staff are told, and an admin saving afterwards does the move.
reset({ status: 'deposit_paid', depositPaidAt: 'then', depositPaidAmount: 700 })
await syncRunnerBookings('r', leadDuo)
assert.equal(store.get(own).packageId, 'solo')
assert.match(added.at(-1).text, /save the runner details here as an admin/)
sent = emails.length
await syncRunnerBookings('r', leadDuo, { byAdmin: true })
assert.equal(store.get(own).packageId, 'duo')
assert.equal(emails.length, sent + 1)
await syncRunnerBookings('r', leadDuo, { byAdmin: true })
assert.equal(emails.length, sent + 1)

// A final invoice already out, or a package of their own with runners on it, stays a conversation.
for (const extra of [{ finalInvoice: { items: [] } }, { companions: [{ email: 'x@x.com' }] }]) {
  reset({ status: 'deposit_paid', ...extra })
  await syncRunnerBookings('r', leadDuo, { byAdmin: true })
  assert.equal(store.get(own).packageId, 'solo')
  assert.match(added.at(-1).text, /Sort this out with them/)
}

// Seats: whichever runner pays first takes spots for the whole package.
const { planSeats } = await import('../functions/lib/runners.js')
const marathon = store.get('marathons/m')
const tx = { get: (ref) => ref.get(), update: (ref, data) => ref.update(data) }
const plan = (id) => planSeats(tx, db.collection('registrations').doc(id), store.get(`registrations/${id}`), marathon)
const seatsOf = async (id) => { const { take, seatCount, holder } = await plan(id); return [take, seatCount, holder?.ref.id] }

setup({ status: 'payment_submitted' }, { status: 'terms_accepted' })
assert.deepEqual(await seatsOf('p'), [2, 2, undefined])
setup({ status: 'terms_accepted' }, { status: 'payment_submitted' })
assert.deepEqual(await seatsOf('r2_m_1'), [2, 2, undefined])

// The second deposit takes over a held seat, in either order, so the spots don't move again.
setup({ ...paid, seatCount: 2 }, { status: 'payment_submitted' })
assert.deepEqual(await seatsOf('r2_m_1'), [0, 1, 'p'])
setup({ status: 'payment_submitted' }, { ...paid, seatCount: 2 })
assert.deepEqual(await seatsOf('p'), [0, 1, 'r2_m_1'])

// No hold left (given up when a runner left, or a merge): a fresh single seat. A solo booking is just one.
setup({ ...paid, seatCount: 1 }, { status: 'payment_submitted' })
assert.deepEqual(await seatsOf('r2_m_1'), [1, 1, undefined])
store.set('registrations/solo', { userId: 'solo', marathonId: 'm', cycle: 1, packageId: 'solo', status: 'payment_submitted' })
assert.deepEqual(await seatsOf('solo'), [1, 1, undefined])

// A lead paying with no runner named yet still holds the whole package.
store.delete('runnerBookings/p_2')
store.delete('registrations/r2_m_1')
store.set('registrations/p', { userId: 'lead', ...pkg, status: 'payment_submitted' })
assert.deepEqual(await seatsOf('p'), [2, 2, undefined])

// A shared deposit takes the seat from the payer's hold, with no new spot counted.
setup({ ...paid, seatCount: 2 }, { status: 'terms_accepted' })
store.set('marathons/m', { ...store.get('marathons/m'), capacity: 2, confirmedCount: 2 })
assert.deepEqual((await applyDepositToPackage('p')).covered, ['r2_m_1'])
assert.equal(store.get('registrations/p').seatCount, 1)
assert.equal(store.get('registrations/r2_m_1').seatCount, 1)
assert.equal(store.get('marathons/m').confirmedCount, 2)

// A merge bringing its own seat gives up the one the lead held for them, so the package still counts 2.
store.set('registrations/r', booking([{ name: 'Known', email: 'known@x.com' }], { depositPaidAt: 'then', seatCount: 2 }))
reset({ status: 'deposit_paid', depositPaidAt: 'then', depositPaidAmount: 700, seatCount: 1 })
store.delete('registrations/old')
await syncRunnerBookings('r', { ...store.get('registrations/r') }, { byAdmin: true })
assert.equal(store.get('registrations/r').seatCount, 1)
assert.equal(store.get('marathons/m').confirmedCount?.operand, -1)

// Three runners: the same rules, with spare seats that needn't sit on Runner 1.
const trio = { id: 'trio', runnerCount: 3, priceAmount: 9000, priceCurrency: 'USD', depositAmount: 1000 }
const m3 = { ...store.get('marathons/m'), capacity: 20, confirmedCount: 5, packages: [...store.get('marathons/m').packages, trio] }
store.set('marathons/m', m3)
for (const [email, uid] of [['b@x.com', 'b'], ['c@x.com', 'c']]) {
  accounts.set(email, uid)
  store.set(`users/${uid}`, { email, fcmTokens: [] })
}
const three = (companions, extra = {}) => booking(companions, { packageId: 'trio', packageName: 'Trio', packagePriceAmount: 3000, ...extra })
const b = { name: 'B', email: 'b@x.com' }
const c = { name: 'C', email: 'c@x.com' }
const docB = 'registrations/b_m_1'
const docC = 'registrations/c_m_1'
const startTrio = async () => {
  for (const key of ['runnerBookings/t_2', 'runnerBookings/t_3', docB, docC]) store.delete(key)
  store.set('registrations/t', three([b, c]))
  await syncRunnerBookings('t', three([b, c]))
}

await startTrio()
assert.equal(store.get(docB).partOf.runner, 2)
assert.equal(store.get(docC).partOf.runner, 3)
assert.equal(store.get(docB).packagePriceAmount, 3000)
assert.equal(store.get(docC).packagePriceAmount, 3000)
assert.equal(finalBalance(store.get(docC)), (9000 - 3 * 1000) / 3)

// Removing Runner 2 leaves Runner 3 on the package, moved up, with no fresh offer email; Runner 2 is released.
let before = emails.length
await syncRunnerBookings('t', three([c]))
assert.equal(store.get(docC).status, 'accepted')
assert.equal(store.get(docC).partOf.runner, 2)
assert.equal(store.get('runnerBookings/t_2').email, 'c@x.com')
assert.equal(store.get('runnerBookings/t_3'), undefined)
assert.equal(store.get(docB).status, 'cancelled')
assert.equal(emails.length, before + 1)
assert.match(emails.at(-1).subject, /place was cancelled/)

// Removing the last runner leaves the one ahead alone. Swapping a runner releases only them.
await startTrio()
await syncRunnerBookings('t', three([b]))
assert.equal(store.get(docB).status, 'accepted')
assert.equal(store.get(docC).status, 'cancelled')
await startTrio()
await syncRunnerBookings('t', three([{ name: 'Known', email: 'known@x.com' }, c]))
assert.equal(store.get(docB).status, 'cancelled')
assert.equal(store.get(docC).partOf.runner, 3)
assert.equal(store.get(docC).status, 'accepted')

// Seats: first payer takes all 3, then each deposit takes one over.
await startTrio()
const seats3 = (id) => planSeats(tx, db.collection('registrations').doc(id), store.get(`registrations/${id}`), store.get('marathons/m'))
store.set(docB, { ...store.get(docB), status: 'payment_submitted' })
assert.equal((await seats3('b_m_1')).take, 3)
store.set(docB, { ...store.get(docB), status: 'deposit_paid', depositPaidAt: 'then', seatCount: 3 })
store.set('registrations/t', { ...store.get('registrations/t'), status: 'payment_submitted' })
let next = await seats3('t')
assert.deepEqual([next.take, next.seatCount, next.holder?.ref.id], [0, 1, 'b_m_1'])
store.set('registrations/t', { ...store.get('registrations/t'), status: 'deposit_paid', depositPaidAt: 'then', depositPaidAmount: 1000, seatCount: 1, depositProofUrls: ['p'], approvedPaymentReferences: ['r'] })
store.set(docB, { ...store.get(docB), seatCount: 2 })
next = await seats3('c_m_1')
assert.deepEqual([next.take, next.seatCount, next.holder?.ref.id], [0, 1, 'b_m_1'])

// A shared deposit finds the spare seat on Runner 2 even though Runner 1 is the payer found first: no extra spot counted.
store.set(docC, { ...store.get(docC), status: 'terms_accepted' })
store.set('marathons/m', { ...store.get('marathons/m'), confirmedCount: 8 })
assert.deepEqual((await applyDepositToPackage('t')).covered, ['c_m_1'])
assert.equal(store.get('marathons/m').confirmedCount, 8)
assert.equal(store.get(docB).seatCount, 1)
assert.equal(store.get(docC).seatCount, 1)

// One deposit covering all three moves both spare seats.
await startTrio()
store.set('registrations/t', { ...store.get('registrations/t'), status: 'deposit_paid', depositPaidAt: 'then', depositPaidAmount: 1000, seatCount: 3, depositProofUrls: ['p'], approvedPaymentReferences: ['r'] })
store.set(docB, { ...store.get(docB), status: 'terms_accepted' })
store.set(docC, { ...store.get(docC), status: 'terms_accepted' })
store.set('marathons/m', { ...store.get('marathons/m'), confirmedCount: 8 })
assert.equal((await applyDepositToPackage('c_m_1')).covered.length, 2)
assert.equal(store.get('registrations/t').seatCount, 1)
assert.equal(store.get('marathons/m').confirmedCount, 8)

// The lead's booking being cancelled takes every runner with it.
await startTrio()
await syncRunnerBookings('t', three([b, c], { status: 'cancelled' }))
assert.equal(store.get(docB).status, 'cancelled')
assert.equal(store.get(docC).status, 'cancelled')

// A runner with a booking that can't be moved isn't told they're on the package.
await startTrio()
store.delete('runnerBookings/t_3')
store.set(docC, { userId: 'c', marathonId: 'm', cycle: 1, status: 'confirmed', packageId: 'solo' })
before = emails.length
await syncRunnerBookings('t', three([b, c]))
assert.equal(emails.length, before)
assert.match(added.at(-1).text, /already has a booking of their own/)

// History: a removal reads as one, not as Runner 2 being renamed.
const history = describeCompanionChanges({ companions: [b, c] }, { companionsEditedBy: 'admin', companions: [c] })
assert.equal(history, 'Runner 2 removed: B (b@x.com)')

console.log('runner bookings ok')
process.exit(0)
