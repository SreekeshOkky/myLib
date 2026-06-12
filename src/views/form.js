import { db } from '../db.js'
import { getState, setState, refreshState } from '../state.js'
import { $, $$, escapeHtml, getCoverColor } from '../utils.js'
import { showDuplicateDialog } from '../modals.js'

/* ───── Form View (Add / Edit) ───── */

export function renderForm(existing, allLabelNames) {
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

export function attachFormEvents(existing, allLabelNames, navigate) {
  $('#back-btn')?.addEventListener('click', () => navigate('/'))

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

    const { books } = getState()
    const duplicate = books.find(
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
