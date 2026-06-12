import { db } from './db.js'
import { getState, setState, refreshState } from './state.js'
import { $, $$, escapeHtml, getCoverColor } from './utils.js'

/* ───── Stats Modal ───── */

export function showStats() {
  const { books } = getState()
  const total = books.length
  if (total === 0) return

  const ratings = books.map((b) => b.rating || 0)
  const avgRating = (ratings.reduce((a, b) => a + b, 0) / total).toFixed(1)

  const genres = books.map((b) => b.genre).filter(Boolean)
  const genreCounts = {}
  genres.flatMap((g) => g.split(',').map((s) => s.trim())).forEach((g) => {
    if (g) genreCounts[g] = (genreCounts[g] || 0) + 1
  })
  const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]

  const languages = books.map((b) => b.language).filter(Boolean)
  const langCounts = {}
  languages.forEach((l) => { langCounts[l] = (langCounts[l] || 0) + 1 })
  const topLang = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0]

  const totalPages = books.reduce((sum, b) => sum + (b.pageCount || 0), 0)

  const labels = books.flatMap((b) => b.labels || [])
  const labelCounts = {}
  labels.forEach((l) => { labelCounts[l] = (labelCounts[l] || 0) + 1 })
  const topLabel = Object.entries(labelCounts).sort((a, b) => b[1] - a[1])[0]

  const finishedCount = books.filter((b) => (b.status || 'to-read') === 'finished').length
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

/* ───── Label Manager Modal ───── */

export function showLabelManager(onUpdate) {
  const { labels: allLabels } = getState()
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
      await refreshState()
      onUpdate?.()
    })
  })

  const input = $('#new-label-input', modal)
  $('#add-label-btn', modal).addEventListener('click', async () => {
    const name = input.value.trim()
    if (name && !allLabels.some((l) => l.name === name)) {
      await db.addLabel(name)
      modal.remove()
      await refreshState()
      onUpdate?.()
    }
  })
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#add-label-btn', modal).click()
  })
  setTimeout(() => input?.focus(), 100)
}

/* ───── Duplicate Dialog Modal ───── */

export function showDuplicateDialog(duplicate) {
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
