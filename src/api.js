const OPEN_LIBRARY_URL = 'https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data'

export async function fetchBookByISBN(isbn) {
  const clean = isbn.replace(/[-\s]/g, '')
  const url = OPEN_LIBRARY_URL.replace('{isbn}', clean)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error: ${res.status}`)

  const data = await res.json()
  const key = `ISBN:${clean}`
  const info = data[key]

  if (!info) throw new Error('Book not found')

  const cover = info.cover
  return {
    isbn: clean,
    title: info.title || 'Unknown Title',
    author: info.authors ? info.authors.map((a) => a.name).join(', ') : 'Unknown Author',
    coverUrl: cover ? (cover.large || cover.medium || cover.small || null) : null,
    description: info.subtitle || '',
    pageCount: info.number_of_pages || null,
    publisher: info.publishers ? info.publishers.map((p) => p.name).join(', ') : '',
    publishDate: info.publish_date || '',
    language: info.languages && info.languages[0] ? (info.languages[0].name || '') : '',
    genre: info.subjects ? info.subjects.slice(0, 4).map((s) => s.name).join(', ') : '',
  }
}

export function validateISBN(value) {
  const cleaned = value.replace(/[-\s]/g, '')
  return /^\d{10}(\d{3})?$/.test(cleaned) ? cleaned : null
}
