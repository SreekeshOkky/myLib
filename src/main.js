import { db } from './db.js'
import { fetchBookByISBN, validateISBN } from './api.js'
import { scanBarcode, isBarcodeSupported } from './barcode.js'
import './styles.css'

const $ = (s, p = document) => p.querySelector(s)
const $$ = (s, p = document) => [...p.querySelectorAll(s)]

let allBooks = []
let allLabels = []
let currentRoute = ''
let activeAuthor = ''

function navigate(path) {
  history.pushState(null, '', '#' + (path || '/'))
  handleRoute()
}

function handleRoute() {
  const hash = location.hash.slice(1) || '/'
  currentRoute = hash
  renderApp()
}

async function renderApp() {
  const app = $('#app')
  const [rawPath, ...rest] = currentRoute.split('/').filter(Boolean)
  const path = rawPath ? rawPath.split('?')[0] : rawPath
  const param = rest.join('/')

  if (path !== 'author') activeAuthor = ''

  if (!path || path === 'home' || path === 'author') {
    app.innerHTML = renderSkeleton()
    await sleep(50)
  }

  allBooks = await db.getAllBooks()
  allLabels = await db.getLabels()
  const labelNames = allLabels.map((l) => l.name)

  if (!path || path === 'home') {
    app.innerHTML = renderHome(allBooks, labelNames)
    attachHomeEvents()
    return
  }

  if (path === 'author' && param) {
    activeAuthor = decodeURIComponent(param)
    app.innerHTML = renderHome(allBooks, labelNames)
    attachHomeEvents()
    return
  }

  app.innerHTML = renderHome(allBooks, labelNames) + '<div class="sheet-overlay" id="sheet-overlay"></div>'
  const sheet = $('#sheet-overlay')

  if (path === 'add') {
    sheet.innerHTML = renderScan()
    attachScanEvents()
  } else if (path === 'book' && param) {
    const id = Number(param)
    const book = allBooks.find((b) => b.id === id)
    if (book) {
      sheet.innerHTML = renderDetail(book)
      attachDetailEvents(book)
    } else {
      navigate('/')
    }
  } else if (path === 'edit' && param) {
    const id = Number(param)
    const book = allBooks.find((b) => b.id === id)
    if (book) {
      sheet.innerHTML = renderForm(book, labelNames)
      attachFormEvents(book, labelNames)
    } else {
      navigate('/')
    }
  } else if (path === 'form') {
    sheet.innerHTML = renderForm(null, labelNames)
    attachFormEvents(null, labelNames)
  } else {
    navigate('/')
  }
}

function goBack() {
  navigate('/')
}

window.addEventListener('popstate', handleRoute)

/* ───── HOME VIEW ───── */

function renderHome(books, labels) {
  const searchQuery = $('#search-input')?.value?.toLowerCase() || ''
  const activeLabel = $('#label-filter')?.value || ''
  const activeLang = $('#lang-filter')?.value || ''
  const activeRating = Number($('#rating-filter')?.value) || 0
  const activeStatus = $('#status-filter')?.value || ''
  const activeLoan = $('#loan-filter')?.value || ''
  const activeSort = $('#sort-filter')?.value || 'date-new'

  let filtered = books
  if (searchQuery) {
    filtered = filtered.filter(
      (b) =>
        b.title?.toLowerCase().includes(searchQuery) ||
        b.author?.toLowerCase().includes(searchQuery) ||
        b.isbn?.includes(searchQuery)
    )
  }
  if (activeLabel) {
    filtered = filtered.filter((b) => (b.labels || []).includes(activeLabel))
  }
  if (activeLang) {
    filtered = filtered.filter((b) => (b.language || '') === activeLang)
  }
  if (activeRating) {
    filtered = filtered.filter((b) => (b.rating || 0) >= activeRating)
  }
  if (activeAuthor) {
    filtered = filtered.filter(
      (b) => b.author?.toLowerCase().includes(activeAuthor.toLowerCase())
    )
  }
  if (activeStatus) {
    filtered = filtered.filter((b) => (b.status || 'to-read') === activeStatus)
  }
  if (activeLoan === 'loaned') {
    filtered = filtered.filter((b) => b.loan && !b.loan.dateReturned)
  } else if (activeLoan === 'available') {
    filtered = filtered.filter((b) => !b.loan || b.loan.dateReturned)
  }

  const sorted = sortBooks(filtered, activeSort)
  const languages = [...new Set(books.map((b) => b.language).filter(Boolean))].sort()

  return `
    <div class="page home-page">
      <header class="app-bar">
        <h1>My Library</h1>
        ${books.length > 0 ? '<button class="btn-icon" id="surprise-btn" title="Surprise Me">🎲</button>' : ''}
        <button class="btn-icon" id="stats-btn" title="Library Stats">📊</button>
        <button class="btn-icon" id="manage-labels-btn" aria-label="Manage labels" title="Manage Labels">🏷️</button>
      </header>

      ${activeAuthor ? `
        <div class="active-filter-bar">
          <span>Author: <strong>${escapeHtml(activeAuthor)}</strong></span>
          <button class="btn-icon" id="clear-author-btn" title="Clear filter">✕</button>
        </div>
      ` : ''}

      <div class="search-bar">
        <input type="text" id="search-input" placeholder="Search by title, author, or ISBN…" value="${searchQuery}">
      </div>

      <div class="filter-row">
        <div class="filter-selects">
          <div class="select-wrap">
            <select id="label-filter">
              <option value="">All Labels</option>
              ${labels.map((l) => `<option value="${l}" ${activeLabel === l ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
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
          <div class="select-wrap filter-loan">
            <select id="loan-filter">
              <option value="">All Loans</option>
              <option value="loaned" ${activeLoan === 'loaned' ? 'selected' : ''}>Loaned Out</option>
              <option value="available" ${activeLoan === 'available' ? 'selected' : ''}>Available</option>
            </select>
          </div>
        </div>
        <span class="book-count">${sorted.length} book${sorted.length !== 1 ? 's' : ''}</span>
      </div>

      <div class="book-grid" id="book-grid">
        ${sorted.length === 0 ? renderEmpty(searchQuery, activeLabel, activeLang, activeRating, activeAuthor, activeStatus, activeLoan) : sorted.map(renderBookCard).join('')}
      </div>

      <button class="fab" id="add-book-fab" title="Add Book">＋</button>
    </div>
  `
}

function renderEmpty(search, label, lang, rating, author, status, loan) {
  if (search || label || lang || rating || author || status || loan) return '<div class="empty-state">No books match your filters.</div>'
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

function attachHomeEvents() {
  const debouncedSearch = debounce(updateBookGrid, 250)

  $('#search-input')?.addEventListener('input', debouncedSearch)
  $('#label-filter')?.addEventListener('change', updateBookGrid)
  $('#lang-filter')?.addEventListener('change', updateBookGrid)
  $('#rating-filter')?.addEventListener('change', updateBookGrid)
  $('#sort-filter')?.addEventListener('change', updateBookGrid)
  $('#add-book-fab')?.addEventListener('click', () => navigate('/add'))
  $('#manage-labels-btn')?.addEventListener('click', showLabelManager)
  $('#stats-btn')?.addEventListener('click', showStats)
  $('#surprise-btn')?.addEventListener('click', showSurpriseMe)
  $('#clear-author-btn')?.addEventListener('click', () => {
    activeAuthor = ''
    navigate('/')
  })

  attachCardEditButtons()
}

function attachCardEditButtons() {
  $$('.card-edit-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      navigate(`/edit/${btn.dataset.id}`)
    })
  })
}

async function updateBookGrid() {
  allBooks = await db.getAllBooks()
  allLabels = await db.getLabels()

  const searchQuery = $('#search-input')?.value?.toLowerCase() || ''
  const activeLabel = $('#label-filter')?.value || ''
  const activeLang = $('#lang-filter')?.value || ''
  const activeRating = Number($('#rating-filter')?.value) || 0
  const activeStatus = $('#status-filter')?.value || ''
  const activeLoan = $('#loan-filter')?.value || ''
  const activeSort = $('#sort-filter')?.value || 'date-new'

  let filtered = allBooks
  if (searchQuery) {
    filtered = filtered.filter(
      (b) =>
        b.title?.toLowerCase().includes(searchQuery) ||
        b.author?.toLowerCase().includes(searchQuery) ||
        b.isbn?.includes(searchQuery)
    )
  }
  if (activeLabel) {
    filtered = filtered.filter((b) => (b.labels || []).includes(activeLabel))
  }
  if (activeLang) {
    filtered = filtered.filter((b) => (b.language || '') === activeLang)
  }
  if (activeRating) {
    filtered = filtered.filter((b) => (b.rating || 0) >= activeRating)
  }
  if (activeAuthor) {
    filtered = filtered.filter(
      (b) => b.author?.toLowerCase().includes(activeAuthor.toLowerCase())
    )
  }
  if (activeStatus) {
    filtered = filtered.filter((b) => (b.status || 'to-read') === activeStatus)
  }
  if (activeLoan === 'loaned') {
    filtered = filtered.filter((b) => b.loan && !b.loan.dateReturned)
  } else if (activeLoan === 'available') {
    filtered = filtered.filter((b) => !b.loan || b.loan.dateReturned)
  }

  const sorted = sortBooks(filtered, activeSort)

  const grid = $('#book-grid')
  if (grid) {
    grid.innerHTML = sorted.length === 0
      ? renderEmpty(searchQuery, activeLabel, activeLang, activeRating, activeAuthor, activeStatus, activeLoan)
      : sorted.map(renderBookCard).join('')
  }

  const count = $('.book-count')
  if (count) {
    count.textContent = `${sorted.length} book${sorted.length !== 1 ? 's' : ''}`
  }

  attachCardEditButtons()
}

/* ───── SORT, SURPRISE & STATS ───── */

function sortBooks(books, sortKey) {
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

function showSurpriseMe() {
  if (allBooks.length === 0) return
  const pick = allBooks[Math.floor(Math.random() * allBooks.length)]
  navigate(`/book/${pick.id}`)
}

function showStats() {
  const total = allBooks.length
  if (total === 0) return

  const ratings = allBooks.map((b) => b.rating || 0)
  const avgRating = (ratings.reduce((a, b) => a + b, 0) / total).toFixed(1)

  const genres = allBooks.map((b) => b.genre).filter(Boolean)
  const genreCounts = {}
  genres.flatMap((g) => g.split(',').map((s) => s.trim())).forEach((g) => {
    if (g) genreCounts[g] = (genreCounts[g] || 0) + 1
  })
  const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]

  const languages = allBooks.map((b) => b.language).filter(Boolean)
  const langCounts = {}
  languages.forEach((l) => { langCounts[l] = (langCounts[l] || 0) + 1 })
  const topLang = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0]

  const totalPages = allBooks.reduce((sum, b) => sum + (b.pageCount || 0), 0)

  const labels = allBooks.flatMap((b) => b.labels || [])
  const labelCounts = {}
  labels.forEach((l) => { labelCounts[l] = (labelCounts[l] || 0) + 1 })
  const topLabel = Object.entries(labelCounts).sort((a, b) => b[1] - a[1])[0]

  const finishedCount = allBooks.filter((b) => (b.status || 'to-read') === 'finished').length
  const savedGoal = parseInt(localStorage.getItem('reading_goal') || '0', 10)
  const readingGoal = savedGoal || 0
  const goalPercent = readingGoal > 0 ? Math.min(100, Math.round((finishedCount / readingGoal) * 100)) : 0

  const modal = document.createElement('div')
  modal.className = 'modal-overlay'
  modal.innerHTML = `
    <div class="modal modal-wide">
      <h2>Library Stats</h2>
      <div class="stats-grid">
        <div class="stat-card"><span class="stat-value">${total}</span><span class="stat-label">Books</span></div>
        <div class="stat-card"><span class="stat-value">${avgRating}</span><span class="stat-label">Avg Rating</span></div>
        ${totalPages ? `<div class="stat-card"><span class="stat-value">${totalPages.toLocaleString()}</span><span class="stat-label">Total Pages</span></div>` : ''}
      </div>
      ${topGenre ? `<div class="stat-row"><span class="stat-label">Top Genre</span><span class="stat-value-sm">${topGenre[0]} (${topGenre[1]})</span></div>` : ''}
      ${topLang ? `<div class="stat-row"><span class="stat-label">Top Language</span><span class="stat-value-sm">${topLang[0]} (${topLang[1]})</span></div>` : ''}
      ${topLabel ? `<div class="stat-row"><span class="stat-label">Top Label</span><span class="stat-value-sm">${topLabel[0]} (${topLabel[1]})</span></div>` : ''}
      <hr>
      <div class="reading-goal-section">
        <h3>Yearly Reading Goal</h3>
        <div class="goal-setter">
          <input type="number" id="goal-input" placeholder="Goal" min="1" value="${readingGoal || ''}">
          <button class="btn btn-primary" id="save-goal">Set Goal</button>
        </div>
        ${readingGoal > 0 ? `
          <div class="goal-progress">
            <div class="goal-bar-track">
              <div class="goal-bar-fill" style="width:${goalPercent}%"></div>
            </div>
            <div class="goal-text">${finishedCount} / ${readingGoal} finished (${goalPercent}%)</div>
          </div>
        ` : ''}
      </div>
      <button class="btn btn-secondary" id="close-stats">Done</button>
    </div>
  `
  document.body.appendChild(modal)

  const goalInput = $('#goal-input', modal)
  $('#save-goal', modal).addEventListener('click', () => {
    const val = parseInt(goalInput.value, 10)
    if (val > 0) {
      localStorage.setItem('reading_goal', String(val))
      modal.remove()
      showStats()
    }
  })

  $('#close-stats', modal).addEventListener('click', () => modal.remove())
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove() })
}

/* ───── LABEL MANAGER ───── */

function showLabelManager() {
  const modal = document.createElement('div')
  modal.className = 'modal-overlay'
  modal.id = 'label-modal'
  modal.innerHTML = `
    <div class="modal">
      <h2>Manage Labels</h2>
      <div class="label-list">
        ${allLabels.map((l) => `
          <div class="label-row" data-id="${l.id}">
            <span>${l.name}</span>
            <button class="btn-icon delete-label-btn" data-id="${l.id}" aria-label="Delete label">✕</button>
          </div>
        `).join('')}
      </div>
      <div class="label-add-row">
        <input type="text" id="new-label-input" placeholder="New label name" maxlength="30">
        <button class="btn" id="add-label-btn">Add</button>
      </div>
      <button class="btn btn-secondary" id="close-label-modal">Done</button>
    </div>
  `
  document.body.appendChild(modal)

  $('#close-label-modal', modal).addEventListener('click', () => modal.remove())
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove() })

  $$('.delete-label-btn', modal).forEach((btn) => {
    btn.addEventListener('click', async () => {
      await db.deleteLabel(Number(btn.dataset.id))
      modal.remove()
      renderApp()
    })
  })

  const input = $('#new-label-input', modal)
  $('#add-label-btn', modal).addEventListener('click', async () => {
    const name = input.value.trim()
    if (name && !allLabels.some((l) => l.name === name)) {
      await db.addLabel(name)
      modal.remove()
      renderApp()
    }
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#add-label-btn', modal).click()
  })
  setTimeout(() => input?.focus(), 100)
}

/* ───── SCAN VIEW ───── */

function renderScan() {
  const supported = isBarcodeSupported()
  return `
    <div class="sheet-page scan-page">
      <header class="app-bar">
        <button class="btn-icon" id="back-btn" aria-label="Back" title="Back">←</button>
        <h1>Add Book</h1>
      </header>

      <div class="scan-content">
        <div class="scan-hero">
          <div class="scan-icon">📷</div>
          <h2>Scan a Barcode</h2>
          <p>Point your camera at the ISBN barcode on the back of your book.</p>
          ${supported ? '<button class="btn btn-primary btn-lg" id="scan-btn">Scan Barcode</button>' : '<p class="hint">Barcode scanning is not available in this browser. Enter the ISBN manually below.</p>'}
        </div>

        <div class="divider"><span>or</span></div>

        <div class="manual-entry">
          <label for="isbn-input">Enter ISBN manually</label>
          <div class="isbn-row">
            <input type="text" id="isbn-input" inputmode="numeric" placeholder="978-0-00-000000-0" maxlength="20">
            <button class="btn btn-primary" id="lookup-btn">Lookup</button>
          </div>
          <p class="hint" id="lookup-error"></p>
        </div>

        <div id="scan-preview"></div>

        <div class="divider"><span>or</span></div>

        <div class="manual-section">
          <button class="btn btn-secondary btn-lg" id="manual-entry-btn">Enter Book Manually</button>
        </div>
      </div>
    </div>
  `
}

function attachScanEvents() {
  $('#back-btn')?.addEventListener('click', goBack)

  const isbnInput = $('#isbn-input')
  const lookupBtn = $('#lookup-btn')
  const errorEl = $('#lookup-error')

  isbnInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') lookupBtn?.click()
  })

  lookupBtn?.addEventListener('click', async () => {
    const raw = isbnInput.value.trim()
    const isbn = validateISBN(raw)
    if (!isbn) {
      errorEl.textContent = 'Enter a valid ISBN (10 or 13 digits).'
      return
    }
    errorEl.textContent = 'Looking up book…'
    lookupBtn.disabled = true
    try {
      const bookData = await fetchBookByISBN(isbn)
      navigate(`/form?isbn=${isbn}&data=${encodeURIComponent(JSON.stringify(bookData))}`)
    } catch (err) {
      if (err.message === 'Book not found') {
        navigate(`/form?isbn=${isbn}`)
      } else {
        errorEl.textContent = 'Network error. Check your connection and try again.'
      }
    }
    lookupBtn.disabled = false
  })

  $('#manual-entry-btn')?.addEventListener('click', () => navigate('/form'))

  const scanBtn = $('#scan-btn')
  scanBtn?.addEventListener('click', async () => {
    scanBtn.disabled = true
    scanBtn.textContent = 'Scanning…'
    try {
      const code = await scanBarcode()
      const preview = $('#scan-preview')
      if (preview) preview.innerHTML = `<p class="scan-success">Scanned: ${code}</p>`
      isbnInput.value = code
      lookupBtn.click()
    } catch (err) {
      if (err.message === 'NOT_SUPPORTED') {
        $('#scan-preview').innerHTML = '<p class="hint error">Barcode scanner not supported on this device.</p>'
      } else if (err.message === 'TIMEOUT') {
        $('#scan-preview').innerHTML = '<p class="hint error">Scan timed out. Try entering the ISBN manually.</p>'
      } else {
        $('#scan-preview').innerHTML = '<p class="hint error">Camera access denied or unavailable.</p>'
      }
    }
    scanBtn.disabled = false
    scanBtn.textContent = 'Scan Barcode'
  })
}

/* ───── FORM VIEW (Add / Edit) ───── */

function renderForm(existing, allLabelNames) {
  const urlParams = new URLSearchParams(location.hash.split('?')[1] || '')
  const isbnFromUrl = urlParams.get('isbn') || ''
  let bookFromUrl = null
  try {
    const raw = urlParams.get('data')
    if (raw) bookFromUrl = JSON.parse(decodeURIComponent(raw))
  } catch {}

  const book = existing || bookFromUrl || {}
  const isEdit = !!existing

  const rating = book.rating || 0
  const labels = book.labels || []

  return `
    <div class="sheet-page form-page">
      <header class="app-bar">
        <button class="btn-icon" id="back-btn" aria-label="Back" title="Back">←</button>
        <h1>${isEdit ? 'Edit Book' : 'Add Book'}</h1>
      </header>

      <form id="book-form" class="book-form">
        <div class="form-cover" id="form-cover">
          ${book.coverUrl ? `<img src="${book.coverUrl}" alt="">` : '<div class="cover-placeholder-lg">📖</div>'}
        </div>

        <div class="form-group">
          <label for="form-isbn">ISBN</label>
          <input type="text" id="form-isbn" value="${book.isbn || isbnFromUrl || ''}" ${isEdit ? 'readonly' : ''}>
        </div>

        <div class="form-group">
          <label for="form-title">Title</label>
          <input type="text" id="form-title" value="${escapeHtml(book.title || '')}" placeholder="Book title" required>
        </div>

        <div class="form-group">
          <label for="form-author">Author</label>
          <input type="text" id="form-author" value="${escapeHtml(book.author || '')}" placeholder="Author name">
        </div>

        <div class="form-group">
          <label for="form-language">Language</label>
          <input type="text" id="form-language" value="${escapeHtml(book.language || '')}" placeholder="e.g. English">
        </div>

        <div class="form-group">
          <label for="form-genre">Genre</label>
          <input type="text" id="form-genre" value="${escapeHtml(book.genre || '')}" placeholder="e.g. Fiction, Science">
        </div>

        <div class="form-group">
          <label for="form-status">Reading Status</label>
          <div class="select-wrap">
            <select id="form-status">
              <option value="to-read" ${(book.status || 'to-read') === 'to-read' ? 'selected' : ''}>To Read</option>
              <option value="reading" ${book.status === 'reading' ? 'selected' : ''}>Reading</option>
              <option value="finished" ${book.status === 'finished' ? 'selected' : ''}>Finished</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Rating</label>
          <div class="star-rating" id="star-rating">
            ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star ${n <= rating ? 'active' : ''}" data-value="${n}">★</button>`).join('')}
          </div>
          <input type="hidden" id="form-rating" value="${rating}">
        </div>

        <div class="form-group">
          <label for="form-labels">Labels</label>
          <div class="labels-select">
            ${allLabelNames.map((l) => `
              <label class="label-checkbox ${labels.includes(l) ? 'checked' : ''}">
                <input type="checkbox" value="${l}" ${labels.includes(l) ? 'checked' : ''}>
                <span>${l}</span>
              </label>
            `).join('')}
            ${allLabelNames.length === 0 ? '<p class="hint">Create labels from the home screen to categorize your books.</p>' : ''}
          </div>
        </div>

        <div class="form-group">
          <label for="form-notes">Notes</label>
          <textarea id="form-notes" rows="4" placeholder="Your notes about this book…">${escapeHtml(book.notes || '')}</textarea>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-lg" id="save-btn">${isEdit ? 'Update Book' : 'Add to Library'}</button>
          ${isEdit ? '<button type="button" class="btn btn-danger" id="delete-btn">Delete Book</button>' : ''}
        </div>
      </form>
    </div>
  `
}

function attachFormEvents(existing, allLabelNames) {
  $('#back-btn')?.addEventListener('click', goBack)

  const form = $('#book-form')
  const ratingInput = $('#form-rating')
  const stars = $$('.star')

  stars.forEach((star) => {
    star.addEventListener('click', () => {
      const val = Number(star.dataset.value)
      ratingInput.value = val
      stars.forEach((s, i) => s.classList.toggle('active', i < val))
    })
  })

  $$('.label-checkbox input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      cb.closest('.label-checkbox').classList.toggle('checked', cb.checked)
    })
  })

  form?.addEventListener('submit', async (e) => {
    e.preventDefault()

    const isbn = $('#form-isbn').value.trim()
    const title = $('#form-title').value.trim()
    const author = $('#form-author').value.trim()
    const language = $('#form-language').value.trim()
    const genre = $('#form-genre').value.trim()
    const rating = Number($('#form-rating').value) || 0
    const notes = $('#form-notes').value.trim()
    const selectedLabels = $$('.label-checkbox input[type="checkbox"]:checked').map((cb) => cb.value)

    if (!title) {
      $('#form-title').focus()
      return
    }

    const book = {
      ...(existing || {}),
      isbn: isbn || existing?.isbn || '',
      title,
      author: author || 'Unknown Author',
      language,
      genre,
      rating,
      labels: selectedLabels,
      notes,
      status: $('#form-status').value,
    }

    if (existing) {
      await db.updateBook(book)
      navigate('/')
      return
    }

    const urlParams = new URLSearchParams(location.hash.split('?')[1] || '')
    let apiData = null
    try {
      const raw = urlParams.get('data')
      if (raw) apiData = JSON.parse(decodeURIComponent(raw))
    } catch {}

    if (apiData) {
      if (apiData.coverUrl) book.coverUrl = apiData.coverUrl
      if (apiData.description) book.description = apiData.description
      if (apiData.pageCount) book.pageCount = apiData.pageCount
      if (apiData.publisher) book.publisher = apiData.publisher
      if (apiData.publishDate) book.publishDate = apiData.publishDate
    }

    const duplicate = allBooks.find(
      (b) => b.title?.toLowerCase() === title.toLowerCase()
    )
    if (duplicate) {
      const action = await showDuplicateDialog(duplicate)
      if (action === 'cancel') return
      if (action === 'merge') {
        const merged = { ...duplicate, ...book, id: duplicate.id, dateAdded: duplicate.dateAdded }
        await db.updateBook(merged)
        navigate('/')
        return
      }
    }

    book.dateAdded = Date.now()
    await db.addBook(book)
    navigate('/')
  })

  const deleteBtn = $('#delete-btn')
  deleteBtn?.addEventListener('click', async () => {
    if (confirm('Delete this book from your library?')) {
      await db.deleteBook(existing.id)
      navigate('/')
    }
  })
}

/* ───── DETAIL VIEW ───── */

function renderDetail(book) {
  const stars = '★'.repeat(Math.round(book.rating || 0)) + '☆'.repeat(5 - Math.round(book.rating || 0))
  const status = book.status || 'to-read'
  const statusLabels = { 'to-read': 'To Read', reading: 'Reading', finished: 'Finished' }
  const statuses = ['to-read', 'reading', 'finished']
  const loan = book.loan
  const isLoaned = loan && !loan.dateReturned
  return `
    <div class="sheet-page detail-page">
      <header class="app-bar">
        <button class="btn-icon" id="back-btn" aria-label="Back" title="Back">←</button>
        <h1>Book Details</h1>
        <button class="btn-icon" id="edit-btn" aria-label="Edit" title="Edit">✎</button>
      </header>

      <div class="detail-content">
        <div class="detail-cover" style="${book.coverUrl ? '' : `background: ${getCoverColor(book.title)}`}">
          ${book.coverUrl ? `<img src="${book.coverUrl}" alt="">` : `<div class="cover-placeholder-lg">${(book.title || '?')[0].toUpperCase()}</div>`}
          ${isLoaned ? '<span class="loan-badge-lg" title="Loaned out">📤</span>' : ''}
        </div>

        <h2 class="detail-title">${escapeHtml(book.title)}</h2>
        <p class="detail-author">${book.author ? `<a class="author-link" href="#/author/${encodeURIComponent(book.author)}">${escapeHtml(book.author)}</a>` : 'Unknown Author'}</p>

        <div class="detail-rating">${stars}</div>

        <div class="detail-section">
          <h3>Reading Status</h3>
          <div class="status-switcher">
            ${statuses.map((s) => `
              <button class="status-btn status-btn-${s} ${s === status ? 'active' : ''}" data-status="${s}">${statusLabels[s]}</button>
            `).join('')}
          </div>
        </div>

        <div class="detail-section">
          <h3>Loan</h3>
          ${isLoaned ? `
            <div class="loan-info">
              <div class="loan-row"><span class="detail-label">Borrower</span><span class="loan-borrower">${escapeHtml(loan.borrower)}</span></div>
              <div class="loan-row"><span class="detail-label">Borrowed</span><span>${new Date(loan.dateBorrowed).toLocaleDateString()}</span></div>
              ${loan.notes ? `<div class="loan-row"><span class="detail-label">Notes</span><span>${escapeHtml(loan.notes)}</span></div>` : ''}
              <button class="btn btn-secondary" id="return-book-btn">Mark as Returned</button>
            </div>
          ` : `
            <p class="hint" id="loan-hint">Not currently loaned out.</p>
            <div id="loan-form" class="loan-form" style="display:none">
              <input type="text" id="loan-borrower" placeholder="Borrower name" required>
              <input type="text" id="loan-notes" placeholder="Notes (optional)">
              <div class="loan-form-actions">
                <button class="btn btn-primary" id="confirm-loan-btn">Loan Out</button>
                <button class="btn btn-secondary" id="cancel-loan-btn">Cancel</button>
              </div>
            </div>
            <button class="btn btn-primary" id="loan-out-btn">Loan Out</button>
          `}
        </div>

        ${book.isbn ? `<div class="detail-row"><span class="detail-label">ISBN</span><span>${book.isbn}</span></div>` : ''}
        ${book.language ? `<div class="detail-row"><span class="detail-label">Language</span><span>${escapeHtml(book.language)}</span></div>` : ''}
        ${book.genre ? `<div class="detail-row"><span class="detail-label">Genre</span><span>${escapeHtml(book.genre)}</span></div>` : ''}
        ${book.publisher ? `<div class="detail-row"><span class="detail-label">Publisher</span><span>${escapeHtml(book.publisher)}</span></div>` : ''}
        ${book.publishDate ? `<div class="detail-row"><span class="detail-label">Published</span><span>${escapeHtml(book.publishDate)}</span></div>` : ''}
        ${book.pageCount ? `<div class="detail-row"><span class="detail-label">Pages</span><span>${book.pageCount}</span></div>` : ''}

        ${(book.labels || []).length ? `<div class="detail-section"><h3>Labels</h3><div class="card-labels">${book.labels.map((l) => `<span class="label-chip">${l}</span>`).join('')}</div></div>` : ''}

        ${book.notes ? `<div class="detail-section"><h3>Notes</h3><p class="detail-notes">${escapeHtml(book.notes)}</p></div>` : ''}

        <div class="detail-date">Added ${new Date(book.dateAdded).toLocaleDateString()}</div>
      </div>
    </div>
  `
}

function attachDetailEvents(book) {
  $('#back-btn')?.addEventListener('click', goBack)
  $('#edit-btn')?.addEventListener('click', () => navigate(`/edit/${book.id}`))

  $$('.status-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const newStatus = btn.dataset.status
      book.status = newStatus
      await db.updateBook(book)
      $$('.status-btn').forEach((b) => b.classList.toggle('active', b.dataset.status === newStatus))
    })
  })

  const loanOutBtn = $('#loan-out-btn')
  const loanForm = $('#loan-form')
  const loanHint = $('#loan-hint')
  const cancelLoanBtn = $('#cancel-loan-btn')

  loanOutBtn?.addEventListener('click', () => {
    loanOutBtn.style.display = 'none'
    loanForm.style.display = 'flex'
    if (loanHint) loanHint.style.display = 'none'
    setTimeout(() => $('#loan-borrower')?.focus(), 100)
  })

  cancelLoanBtn?.addEventListener('click', () => {
    loanForm.style.display = 'none'
    loanOutBtn.style.display = ''
    if (loanHint) loanHint.style.display = ''
  })

  $('#confirm-loan-btn')?.addEventListener('click', async () => {
    const borrower = $('#loan-borrower').value.trim()
    if (!borrower) { $('#loan-borrower').focus(); return }
    book.loan = {
      borrower,
      dateBorrowed: new Date().toISOString(),
      dateReturned: null,
      notes: $('#loan-notes').value.trim(),
    }
    await db.updateBook(book)
    navigate('/')
  })

  $('#return-book-btn')?.addEventListener('click', async () => {
    book.loan.dateReturned = new Date().toISOString()
    await db.updateBook(book)
    navigate('/')
  })
}

/* ───── DUPLICATE DIALOG ───── */

function showDuplicateDialog(duplicate) {
  return new Promise((resolve) => {
    const modal = document.createElement('div')
    modal.className = 'modal-overlay'
    modal.innerHTML = `
      <div class="modal">
        <h2>Duplicate Found</h2>
        <p>A book titled "<strong>${escapeHtml(duplicate.title)}</strong>" already exists in your library.</p>
        <div class="duplicate-item">
          ${duplicate.coverUrl ? `<img src="${duplicate.coverUrl}" alt="" class="dup-cover">` : `<div class="dup-cover-placeholder" style="background:${getCoverColor(duplicate.title)}">${(duplicate.title || '?')[0].toUpperCase()}</div>`}
          <div>
            <div class="dup-title">${escapeHtml(duplicate.title)}</div>
            ${duplicate.author ? `<div class="dup-author">${escapeHtml(duplicate.author)}</div>` : ''}
            ${duplicate.isbn ? `<div class="dup-isbn">ISBN: ${duplicate.isbn}</div>` : ''}
          </div>
        </div>
        <p class="dialog-question">What would you like to do?</p>
        <div class="dialog-actions">
          <button class="btn btn-primary" id="dup-merge">Update Existing</button>
          <button class="btn btn-secondary" id="dup-add">Add as New</button>
          <button class="btn btn-secondary" id="dup-cancel">Cancel</button>
        </div>
      </div>
    `
    document.body.appendChild(modal)

    $('#dup-merge', modal).onclick = () => { modal.remove(); resolve('merge') }
    $('#dup-add', modal).onclick = () => { modal.remove(); resolve('add') }
    $('#dup-cancel', modal).onclick = () => { modal.remove(); resolve('cancel') }
    modal.addEventListener('click', (e) => {
      if (e.target === modal) { modal.remove(); resolve('cancel') }
    })
  })
}

/* ───── UTILITIES ───── */

function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function getCoverColor(title) {
  let hash = 0
  const s = (title || '')
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 45%, 30%)`
}

function renderSkeleton() {
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

/* ───── INIT ───── */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
}

handleRoute()
