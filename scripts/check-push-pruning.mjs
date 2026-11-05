// Run after `npm --prefix functions run build`: node scripts/check-push-pruning.mjs
// Only dead-device errors may remove a token, and push links must be absolute.
import assert from 'node:assert/strict'

process.env.GCLOUD_PROJECT ??= 'demo-ars-dream'
const { messaging } = await import('../functions/lib/admin.js')
const { sendAndPruneTokens } = await import('../functions/lib/notify.js')

let sent
messaging.sendEachForMulticast = async (message) => {
  sent = message
  return {
    responses: [
      { success: true },
      { success: false, error: { code: 'messaging/registration-token-not-registered' } },
      { success: false, error: { code: 'messaging/internal-error' } },
      { success: false, error: { code: 'messaging/invalid-registration-token' } },
    ],
  }
}

const updates = []
const owner = (name, tokens) => ({ ref: { update: async (data) => updates.push([name, data.fcmTokens]) }, tokens })
await sendAndPruneTokens([owner('a', ['ok', 'gone']), owner('b', ['outage', 'bad'])], { title: 't', body: 'b' }, '/messages')

assert.equal(sent.webpush.fcmOptions.link, 'https://arsdreamsports.com/messages')
assert.equal(updates.length, 2)
assert.deepEqual(updates.map(([name]) => name), ['a', 'b'])
assert.match(JSON.stringify(updates[0][1]), /gone/)
assert.doesNotMatch(JSON.stringify(updates[0][1]), /"ok"/)
assert.match(JSON.stringify(updates[1][1]), /bad/)
assert.doesNotMatch(JSON.stringify(updates[1][1]), /outage/)
console.log('push pruning ok')
process.exit(0)
