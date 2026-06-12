/* ───── DOM Helpers ───── */

export const $ = (s, p = document) => p.querySelector(s)
export const $$ = (s, p = document) => [...p.querySelectorAll(s)]

/* ───── Utilities ───── */

export function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

export function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export function getCoverColor(title) {
  let hash = 0
  const s = (title || '')
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 45%, 30%)`
}

/* ───── Sort ───── */

export function sortBooks(books, sortKey) {
  const sorted = [...books]
  switch (sortKey) {
    case 'date-new': return sorted.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
    case 'date-old': return sorted.sort((a, b) => (a.dateAdded || 0) - (b.dateAdded || 0))
    case 'title': return sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    case 'author': return sorted.sort((a, b) => (a.author || '').localeCompare(b.author || ''))
    case 'rating-high': return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    case 'rating-low': return sorted.sort((a, b) => (a.rating || 0) - (b.rating || 0))
    default: return sorted
  }
}

/* ───── Filter (single source of truth) ───── */

export function filterBooks(books, { search, language, rating, status, author, loan } = {}) {
  let filtered = books

  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(
      (b) =>
        b.title?.toLowerCase().includes(q) ||
        b.author?.toLowerCase().includes(q) ||
        b.isbn?.includes(q)
    )
  }
  if (language) {
    filtered = filtered.filter((b) => (b.language || '').trim().toLowerCase() === language.toLowerCase())
  }
  if (rating) {
    filtered = filtered.filter((b) => (b.rating || 0) >= rating)
  }
  if (author) {
    filtered = filtered.filter(
      (b) => b.author?.toLowerCase().includes(author.toLowerCase())
    )
  }
  if (status) {
    filtered = filtered.filter((b) => (b.status || 'to-read') === status)
  }
  if (loan === 'loaned') {
    filtered = filtered.filter((b) => b.loan && !b.loan.dateReturned)
  } else if (loan === 'available') {
    filtered = filtered.filter((b) => !b.loan || b.loan.dateReturned)
  }

  return filtered
}

/* ───── Skeleton Loading ───── */

export function renderSkeleton() {
  return `
    <div class="page home-page">
      <header class="app-bar"><h1>My Library</h1></header>
      <div class="search-bar"><div class="skeleton search-skeleton"></div></div>
      <div class="book-grid skeleton-grid">
        ${Array.from({ length: 6 }, () => `
          <div class="book-card">
            <div class="card-cover skeleton-pulse"></div>
            <div class="card-body">
              <div class="skeleton skeleton-text"></div>
              <div class="skeleton skeleton-text skeleton-text-short"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `
}
