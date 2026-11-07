// Run with Node 23.6+, which strips the types: node scripts/check-queue-numbers.mjs
// Queue numbers rank everyone by when they last joined the waitlist, so none repeat.
import assert from 'node:assert/strict'

const { getQueueNumbers } = await import('../src/features/admin/queue-numbers.ts')

const at = (millis) => ({ toMillis: () => millis })
const booking = (id, joined, extra = {}) => ({ id, createdAt: at(joined), ...extra })
const numbers = (...registrations) => Object.fromEntries(getQueueNumbers(registrations))

// Any order in, ranked by time, whatever their status.
assert.deepEqual(
  numbers(booking('cy', 30), booking('ana', 10, { status: 'accepted' }), booking('ben', 20, { status: 'cancelled' })),
  { ana: 1, ben: 2, cy: 3 },
)

// Rejoining resets createdAt, so they go to the back.
assert.deepEqual(numbers(booking('ana', 40), booking('ben', 20), booking('cy', 30)), { ben: 1, cy: 2, ana: 3 })

// The same time still gives each their own number.
assert.deepEqual(numbers(booking('b', 10), booking('a', 10)), { a: 1, b: 2 })

// Only people who joined the waitlist themselves are numbered.
assert.deepEqual(
  numbers(
    booking('own', 10, { partOf: { hadOwnPlace: true } }),
    booking('runner2', 5, { partOf: { hadOwnPlace: false } }),
    booking('transfer', 5, { transferredFrom: {} }),
  ),
  { own: 1 },
)

// A write still in flight has no time yet and lands last, not first.
assert.deepEqual(numbers({ id: 'new' }, booking('ana', 10)), { ana: 1, new: 2 })

console.log('queue numbers ok')
