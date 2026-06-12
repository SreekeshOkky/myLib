import { db } from './db.js'
import { getState, setState, refreshState } from './state.js'
import { $, escapeHtml, sleep, renderSkeleton } from './utils.js'
import { renderHome, attachHomeEvents } from './views/home.js'
import { renderScan, attachScanEvents } from './views/scan.js'
import { renderForm, attachFormEvents } from './views/form.js'
import { renderDetail, attachDetailEvents } from './views/detail.js'
import './styles.css'

/* ───── Router ───── */

let currentRoute = ''

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
  const state = getState()

  if (path !== 'author') setState({ activeAuthor: '' })

  if (!path || path === 'home' || path === 'author') {
    app.innerHTML = renderSkeleton()
    await sleep(50)
  }

  await refreshState()
  const { books, labels: allLabels } = getState()
  const labelNames = allLabels.map((l) => l.name)

  if (!path || path === 'home') {
    app.innerHTML = renderHome(books, labelNames)
    attachHomeEvents(navigate)
    return
  }

  if (path === 'author' && param) {
    setState({ activeAuthor: decodeURIComponent(param) })
    app.innerHTML = renderHome(books, labelNames)
    attachHomeEvents(navigate)
    return
  }

  app.innerHTML = renderHome(books, labelNames) + '<div class="sheet-overlay" id="sheet-overlay"></div>'
  const sheet = $('#sheet-overlay')

  if (path === 'add') {
    sheet.innerHTML = renderScan()
    attachScanEvents(navigate)
  } else if (path === 'book' && param) {
    const id = Number(param)
    const book = books.find((b) => b.id === id)
    if (book) {
      sheet.innerHTML = renderDetail(book)
      attachDetailEvents(book, navigate)
    } else {
      navigate('/')
    }
  } else if (path === 'edit' && param) {
    const id = Number(param)
    const book = books.find((b) => b.id === id)
    if (book) {
      sheet.innerHTML = renderForm(book, labelNames)
      attachFormEvents(book, labelNames, navigate)
    } else {
      navigate('/')
    }
  } else if (path === 'form') {
    sheet.innerHTML = renderForm(null, labelNames)
    attachFormEvents(null, labelNames, navigate)
  } else {
    navigate('/')
  }
}

window.addEventListener('popstate', handleRoute)

/* ───── Init ───── */

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
}

handleRoute()
