import { db } from './db.js'

/* ───── Central State ───── */

const state = {
  books: [],
  labels: [],
  route: '',
  activeAuthor: '',
  activeLoan: '',
}

const listeners = new Set()

export function getState() {
  return state
}

export function setState(partial) {
  Object.assign(state, partial)
  listeners.forEach((fn) => fn(state))
}

export function onStateChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/* ───── Data Loading ───── */

export async function refreshState() {
  const [books, labels] = await Promise.all([db.getAllBooks(), db.getLabels()])
  setState({ books, labels })
}
