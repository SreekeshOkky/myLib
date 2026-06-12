import { db } from '../db.js'
import { getState, setState } from '../state.js'
import { $, $$, escapeHtml, getCoverColor, sortBooks, filterBooks, debounce } from '../utils.js'
import { showLabelManager, showStats } from '../modals.js'

/* ───── Home View ───── */

let _navigate = null

export function renderHome(books, labels) {
  const searchQuery = $('#search-input')?.value?.toLowerCase() || ''
  const activeLang = $('#lang-filter')?.value || ''
  const activeRating = Number($('#rating-filter')?.value) || 0
  const activeStatus = $('#status-filter')?.value || ''
  const activeSort = $('#sort-filter')?.value || 'date-new'
  const state = getState()

  const filtered = filterBooks(books, {
    search: searchQuery,
    language: activeLang,
    rating: activeRating,
    status: activeStatus,
    author: state.activeAuthor,
    loan: state.activeLoan,
  })
  const sorted = sortBooks(filtered, activeSort)

  const rawLangs = [...new Set(books.map((b) => b.language).filter(Boolean).map((l) => l.trim()))]
  const languages = rawLangs.sort((a, b) => a.localeCompare(b))

  return `
    <div class="page home-page">
      <header class="app-bar">
        <h1>My Library</h1>
        ${books.length > 0 ? '<button class="btn-icon" id="surprise-btn" title="Surprise Me">🎲</button>' : ''}
        <button class="btn-icon" id="stats-btn" title="Library Stats">📊</button>
        <button class="btn-icon" id="manage-labels-btn" aria-label="Manage labels" title="Manage Labels">🏷️</button>
      </header>

      ${state.activeAuthor ? `
        <div class="active-filter-bar">
          <span>Author: <strong>${escapeHtml(state.activeAuthor)}</strong></span>
          <button class="btn-icon" id="clear-author-btn" title="Clear filter">✕</button>
        </div>
      ` : ''}

      <div class="search-bar">
        <input type="text" id="search-input" placeholder="Search by title, author, or ISBN…" value="${searchQuery}">
      </div>

      <div class="filter-row">
        <div class="filter-selects">
          <div class="select-wrap">
            <select id="lang-filter">
              <option value="">All Languages</option>
              ${languages.map((l) => `<option value="${l}" ${activeLang === l ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="select-wrap">
            <select id="rating-filter">
              <option value="">All Ratings</option>
              <option value="5" ${activeRating === 5 ? 'selected' : ''}>5★ only</option>
              <option value="4" ${activeRating === 4 ? 'selected' : ''}>4★ & up</option>
              <option value="3" ${activeRating === 3 ? 'selected' : ''}>3★ & up</option>
              <option value="2" ${activeRating === 2 ? 'selected' : ''}>2★ & up</option>
              <option value="1" ${activeRating === 1 ? 'selected' : ''}>1★ & up</option>
            </select>
          </div>
          <div class="select-wrap">
            <select id="sort-filter">
              <option value="date-new" ${activeSort === 'date-new' ? 'selected' : ''}>Date ↓</option>
              <option value="date-old" ${activeSort === 'date-old' ? 'selected' : ''}>Date ↑</option>
              <option value="title" ${activeSort === 'title' ? 'selected' : ''}>Title</option>
              <option value="author" ${activeSort === 'author' ? 'selected' : ''}>Author</option>
              <option value="rating-high" ${activeSort === 'rating-high' ? 'selected' : ''}>Rating ↓</option>
              <option value="rating-low" ${activeSort === 'rating-low' ? 'selected' : ''}>Rating ↑</option>
            </select>
          </div>
          <div class="select-wrap filter-status">
            <select id="status-filter">
              <option value="">All Status</option>
              <option value="to-read" ${activeStatus === 'to-read' ? 'selected' : ''}>To Read</option>
              <option value="reading" ${activeStatus === 'reading' ? 'selected' : ''}>Reading</option>
              <option value="finished" ${activeStatus === 'finished' ? 'selected' : ''}>Finished</option>
            </select>
          </div>
        </div>
        <div class="loan-tabs">
          <button class="loan-tab ${!state.activeLoan ? 'active' : ''}" data-loan="">All</button>
          <button class="loan-tab ${state.activeLoan === 'loaned' ? 'active' : ''}" data-loan="loaned">Loaned</button>
          <button class="loan-tab ${state.activeLoan === 'available' ? 'active' : ''}" data-loan="available">Available</button>
        </div>
        <span class="book-count">${sorted.length} book${sorted.length !== 1 ? 's' : ''}</span>
      </div>

      <div class="book-grid" id="book-grid">
        ${sorted.length === 0 ? renderEmpty(searchQuery, activeLang, activeRating, state.activeAuthor, activeStatus, state.activeLoan) : sorted.map(renderBookCard).join('')}
      </div>

      <button class="fab" id="add-book-fab" title="Add Book">＋</button>
    </div>
  `
}

function renderEmpty(search, lang, rating, author, status, loan) {
  if (search || lang || rating || author || status || loan) return '<div class="empty-state">No books match your filters.</div>'
  return `
    <div class="empty-state">
      <div class="empty-icon">📚</div>
      <h2>Your library is empty</h2>
      <p>Tap the ＋ button to add your first book.</p>
    </div>
  `
}

function renderBookCard(book) {
  const stars = '★'.repeat(Math.round(book.rating || 0)) + '☆'.repeat(5 - Math.round(book.rating || 0))
  const status = book.status || 'to-read'
  const statusLabels = { 'to-read': 'To Read', reading: 'Reading', finished: 'Finished' }
  const isLoaned = book.loan && !book.loan.dateReturned
  return `
    <a class="book-card" href="#/book/${book.id}">
      <div class="card-cover" style="${book.coverUrl ? '' : `background: ${getCoverColor(book.title)}`}">
        ${book.coverUrl ? `<img src="${book.coverUrl}" alt="" loading="lazy">` : `<div class="cover-placeholder" style="opacity:0.7">${(book.title || '?')[0].toUpperCase()}</div>`}
        <button class="card-edit-btn" data-id="${book.id}" aria-label="Edit book" title="Edit">✎</button>
        <span class="status-badge status-${status}">${statusLabels[status] || 'To Read'}</span>
        ${isLoaned ? '<span class="loan-badge" title="Loaned out">📤</span>' : ''}
      </div>
      <div class="card-body">
        <div class="card-title">${book.title || 'Untitled'}</div>
        <div class="card-author">${book.author ? `<a class="author-link" href="#/author/${encodeURIComponent(book.author)}">${escapeHtml(book.author)}</a>` : ''}</div>
        <div class="card-rating">${stars}</div>
        ${(book.labels || []).length ? `<div class="card-labels">${book.labels.map((l) => `<span class="label-chip">${l}</span>`).join('')}</div>` : ''}
      </div>
    </a>
  `
}

/* ───── Events ───── */

export function attachHomeEvents(navigate) {
  _navigate = navigate
  const debouncedSearch = debounce(updateBookGrid, 250)

  $('#search-input')?.addEventListener('input', debouncedSearch)
  $('#lang-filter')?.addEventListener('change', updateBookGrid)
  $('#rating-filter')?.addEventListener('change', updateBookGrid)
  $('#status-filter')?.addEventListener('change', updateBookGrid)
  $('#sort-filter')?.addEventListener('change', updateBookGrid)
  $('#add-book-fab')?.addEventListener('click', () => navigate('/add'))
  $('#manage-labels-btn')?.addEventListener('click', () => showLabelManager(() => navigate('/')))
  $('#stats-btn')?.addEventListener('click', showStats)
  $('#surprise-btn')?.addEventListener('click', () => {
    const { books } = getState()
    if (books.length === 0) return
    const pick = books[Math.floor(Math.random() * books.length)]
    navigate(`/book/${pick.id}`)
  })
  $('#clear-author-btn')?.addEventListener('click', () => {
    setState({ activeAuthor: '' })
    navigate('/')
  })

  $$('.loan-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const loan = tab.dataset.loan
      setState({ activeLoan: loan })
      $$('.loan-tab').forEach((t) => t.classList.toggle('active', t.dataset.loan === loan))
      updateBookGrid()
    })
  })

  attachCardEditButtons()
}

function attachCardEditButtons() {
  $$('.card-edit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      _navigate(`/edit/${btn.dataset.id}`)
    })
  })
}

export async function updateBookGrid() {
  const [books, labels] = await Promise.all([db.getAllBooks(), db.getLabels()])
  setState({ books, labels })
  const state = getState()

  const searchQuery = $('#search-input')?.value?.toLowerCase() || ''
  const activeLang = $('#lang-filter')?.value || ''
  const activeRating = Number($('#rating-filter')?.value) || 0
  const activeStatus = $('#status-filter')?.value || ''
  const activeSort = $('#sort-filter')?.value || 'date-new'

  const filtered = filterBooks(books, {
    search: searchQuery,
    language: activeLang,
    rating: activeRating,
    status: activeStatus,
    author: state.activeAuthor,
    loan: state.activeLoan,
  })
  const sorted = sortBooks(filtered, activeSort)

  const grid = $('#book-grid')
  if (grid) {
    grid.innerHTML = sorted.length === 0
      ? renderEmpty(searchQuery, activeLang, activeRating, state.activeAuthor, activeStatus, state.activeLoan)
      : sorted.map(renderBookCard).join('')
  }

  const count = $('.book-count')
  if (count) {
    count.textContent = `${sorted.length} book${sorted.length !== 1 ? 's' : ''}`
  }

  attachCardEditButtons()
}
