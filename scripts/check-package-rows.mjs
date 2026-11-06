// Run with Node 23.6+, which strips the types: node scripts/check-package-rows.mjs
// Runners on one package sit together in the admin list, Runner 1 first.
import assert from 'node:assert/strict'

const { groupByPackage, samePackage } = await import('../src/features/admin/package-rows.ts')

const partOf = (registrationId, runner = 2) => ({ registrationId, runner })
const solo = { id: 'solo' }
const lead = { id: 'lead' }
const runner = { id: 'runner', partOf: partOf('lead') }
const ids = (groups) => groups.map((group) => group.map((row) => row.id))

// Pulled together wherever they were, at the first one's place, whichever came first.
assert.deepEqual(ids(groupByPackage([lead, solo, runner])), [['lead', 'runner'], ['solo']])
assert.deepEqual(ids(groupByPackage([runner, solo, lead])), [['lead', 'runner'], ['solo']])

// A runner alone (filtered, or their lead's row is hidden) still shows, as does a third runner in order.
assert.deepEqual(ids(groupByPackage([runner])), [['runner']])
const third = { id: 'third', partOf: partOf('lead', 3) }
assert.deepEqual(ids(groupByPackage([third, runner, lead])), [['lead', 'runner', 'third']])

assert.equal(samePackage(lead, runner), true)
assert.equal(samePackage(runner, third), true)
assert.equal(samePackage(lead, solo), false)
assert.equal(samePackage(lead, undefined), false)
// What removing a runner does, by how far they've got.
const { addOnsOnPackage, runnerRemovalOutcome } = await import('../src/features/admin/package-rows.ts')
assert.equal(runnerRemovalOutcome(null), 'invite')
assert.equal(runnerRemovalOutcome({ status: 'accepted', partOf: { hadOwnPlace: false } }), 'cancelled')
assert.equal(runnerRemovalOutcome({ status: 'terms_accepted', partOf: { hadOwnPlace: true } }), 'waitlist')
assert.equal(runnerRemovalOutcome({ status: 'payment_submitted', partOf: {} }), 'choose')
assert.equal(runnerRemovalOutcome({ status: 'deposit_paid', partOf: {} }), 'choose')
assert.equal(runnerRemovalOutcome({ status: 'confirmed', partOf: {} }), 'choose')
// Merged in from their own package: it comes back, unless a final invoice was issued on this one.
assert.equal(runnerRemovalOutcome({ status: 'deposit_paid', partOf: { previousPackage: {} } }), 'restored')
assert.equal(runnerRemovalOutcome({ status: 'terms_accepted', partOf: { previousPackage: {} } }), 'restored')
assert.equal(runnerRemovalOutcome({ status: 'final_invoiced', finalInvoice: {}, partOf: { previousPackage: {} } }), 'choose')

const addOns = [{ id: 'tee' }, { id: 'must', mandatory: true }, { id: 'other' }]
assert.deepEqual(addOnsOnPackage({ selectedAddOns: [{ addOnId: 'tee' }, { addOnId: 'gone' }] }, { addOns }).map((a) => a.id), ['tee', 'must'])
assert.deepEqual(addOnsOnPackage({}, {}), [])
console.log('package rows ok')
