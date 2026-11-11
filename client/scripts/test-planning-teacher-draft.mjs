import assert from 'node:assert/strict'
import React from 'react'
import { createServer } from 'vite'

// Isolated component/handler harness. No DOM, listening server, browser or data source.
// Hook stores are scoped by the actual element key emitted by TeacherLoadFields.
const vite = await createServer({ configFile: false, envDir: false, root: new URL('..', import.meta.url).pathname,
  ssr: { external: true }, server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom' })
try {
  const { TeacherLoadFields } = await vite.ssrLoadModule(process.argv[2] ?? '/src/screens/PlanningTeacherLoad.tsx')
  const stores = new Map()
  let store, cursor
  const internals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
  const previous = internals.H
  internals.H = {
    useState(initial) {
      const index = cursor++
      if (!(index in store)) store[index] = typeof initial === 'function' ? initial() : initial
      return [store[index], (value) => { store[index] = value }]
    },
    useId: () => `synthetic-${cursor++}`,
    useMemo: (fn) => fn(),
  }
  const changed = []
  const base = { courseIds: [], availability: [], maxWeeklyMinutes: 600, regime: 'tiempo-parcial', appointment: 'faculty-ordinary' }
  const a = { ...base, id: 'SYN-A', name: 'Synthetic A', weeklyServiceHours: 10 }
  const b = { ...base, id: 'SYN-B', name: 'Synthetic B', weeklyServiceHours: 20 }
  const render = (teacher, period = '2027-I') => {
    store = stores.get('outer') ?? []; stores.set('outer', store); cursor = 0
    const element = TeacherLoadFields({ teacher, period, lectiveHourMinutes: 60, disabled: false, onChange: (next) => changed.push(next) })
    if (typeof element.type !== 'function') return element
    const key = element.key
    store = stores.get(key) ?? []; stores.set(key, store); cursor = 0
    return element.type(element.props)
  }
  const nodes = (node) => !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)]
  const input = (tree, id) => nodes(tree).find((n) => n.props?.id === id)
  let tree = render(a)
  input(tree, 'teacher-load-reference').props.onChange({ currentTarget: { value: 'SYN-A-DRAFT' } })
  tree = render({ ...a })
  assert.equal(input(tree, 'teacher-load-reference').props.value, 'SYN-A-DRAFT', 'same-teacher rerender preserves typing')
  tree = render(b)
  assert.equal(input(tree, 'teacher-load-reference').props.value, '', 'A authorization draft cannot appear on B')
  assert.ok(nodes(tree).some((n) => n.props?.value === '20'), 'B service field reflects B')
  nodes(tree).find((n) => n.props?.children === 'Registrar autorización').props.onClick()
  assert.equal(changed.length, 0, 'empty B draft cannot submit A authorization')
  input(tree, 'teacher-load-reference').props.onChange({ currentTarget: { value: 'SYN-B-DRAFT' } })
  tree = render(b, '2027-II')
  assert.equal(input(tree, 'teacher-load-reference').props.value, '', 'period switch resets authorization draft')
  internals.H = previous
  console.log('PASS: actual component handlers, A→B isolation, B service hours, same-teacher typing, period isolation')
} finally {
  await vite.close()
}
