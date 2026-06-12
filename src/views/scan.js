import { $ } from '../utils.js'
import { fetchBookByISBN, validateISBN } from '../api.js'

/* ───── Scan View ───── */

export function renderScan() {
  return `
    <div class="sheet-page scan-page">
      <header class="app-bar">
        <button class="btn-icon" id="back-btn" aria-label="Back" title="Back">←</button>
        <h1>Add Book</h1>
      </header>

      <div class="scan-content">
        <div class="manual-entry">
          <div class="scan-icon">📷</div>
          <h2>Enter ISBN</h2>
          <label for="isbn-input">ISBN number</label>
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

export function attachScanEvents(navigate) {
  $('#back-btn')?.addEventListener('click', () => navigate('/'))

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
}
