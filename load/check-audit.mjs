let input = ''
for await (const chunk of process.stdin) input += chunk
const expected = Number(process.argv[2])
const expectedRequests = Number(process.argv[3] ?? expected)
if (!Number.isSafeInteger(expected) || expected < 0 || !Number.isSafeInteger(expectedRequests) || expectedRequests < 0) throw new Error('Expected enrollment and request counts are required')
const start = input.indexOf('{')
const end = input.lastIndexOf('}')
if (start < 0 || end < start) throw new Error('Audit output did not contain the backend audit JSON')
const result = JSON.parse(input.slice(start, end + 1))
const actual = Number(result?.totals?.enrollments)
const actualRequests = Number(result?.totals?.requests)
if (result?.passed !== true || actual !== expected || actualRequests !== expectedRequests) {
  process.stderr.write(`Audit failed: passed=${String(result?.passed)} enrollments=${String(actual)}/${expected} requests=${String(actualRequests)}/${expectedRequests}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`Synthetic database audit passed; enrollments=${actual} requests=${actualRequests}\n`)
}
