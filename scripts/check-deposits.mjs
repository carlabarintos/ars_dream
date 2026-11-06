// Run after `npm --prefix functions run build`: node scripts/check-deposits.mjs
// Each runner has their own deposit, and later documents use what was actually approved.
import assert from 'node:assert/strict'

const { bookingDeposit, getStepDueDate, packageDepositLabel, runnerShare } = await import('../functions/lib/email-template.js')

const solo = { depositAmount: 1000, priceAmount: 5000, priceCurrency: 'USD' }
const duo = { ...solo, runnerCount: 2, priceAmount: 9000 }
const booked = (packagePriceAmount, extra = {}) => ({ packageName: 'P', packagePriceAmount, ...extra })

assert.equal(runnerShare(solo), 5000)
assert.equal(runnerShare(duo), 4500)
assert.equal(runnerShare({ priceAmount: 9001, runnerCount: 2 }), 4500.5)
assert.equal(runnerShare({ priceAmount: 1000, runnerCount: 3 }), 333.33)

assert.equal(packageDepositLabel(solo), 'Deposit USD 1,000')
assert.equal(packageDepositLabel(duo), 'Deposit USD 1,000 per runner')

// Not yet paid: this runner's deposit, never more than their share, or the full share if there's no deposit.
assert.equal(bookingDeposit(booked(4500), duo), 1000)
assert.equal(bookingDeposit(booked(500), duo), 500)
assert.equal(bookingDeposit(booked(4500), { runnerCount: 2 }), 4500)
assert.equal(bookingDeposit(booked(4500, { selectedAddOns: [{ name: 'A', priceAmount: 100 }] }), { runnerCount: 2 }), 4600)

// The amount approved wins, whatever the package says now.
assert.equal(bookingDeposit(booked(4500, { depositPaidAmount: 700 }), duo), 700)
// Runner 2's offer has no deadline, even with a stray extension, so it's never auto-cancelled. Their deposit still does.
const at = { toDate: () => new Date('2026-11-01') }
assert.ok(getStepDueDate({ offeredAt: at }, {}, 'accepted'))
assert.equal(getStepDueDate({ offeredAt: at, partOf: {} }, {}, 'accepted'), undefined)
assert.equal(getStepDueDate({ offeredAt: at, partOf: {}, dueExtension: { status: 'accepted', dueDate: at } }, {}, 'accepted'), undefined)
assert.ok(getStepDueDate({ termsAcceptedAt: at, partOf: {} }, {}, 'terms_accepted'))
console.log('deposits ok')
