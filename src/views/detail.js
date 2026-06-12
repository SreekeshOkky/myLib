import { db } from '../db.js'
import { $, $$, escapeHtml, getCoverColor } from '../utils.js'

/* ───── Detail View ───── */

export function renderDetail(book) {
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

export function attachDetailEvents(book, navigate) {
  $('#back-btn')?.addEventListener('click', () => navigate('/'))
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
