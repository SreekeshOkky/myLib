const DB_NAME = 'MyLibraryDB'
const DB_VERSION = 1
const STORES = { books: 'books', labels: 'labels' }

let dbInstance = null

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORES.books)) {
        const store = db.createObjectStore(STORES.books, {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('isbn', 'isbn', { unique: false })
        store.createIndex('title', 'title', { unique: false })
        store.createIndex('dateAdded', 'dateAdded', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORES.labels)) {
        db.createObjectStore(STORES.labels, {
          keyPath: 'id',
          autoIncrement: true,
        })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getDB() {
  if (dbInstance) return dbInstance
  dbInstance = await openDB()
  return dbInstance
}

async function withStore(storeName, mode, callback) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    let req
    try {
      req = callback(store)
    } catch (err) {
      reject(err)
      tx.abort()
      return
    }
    tx.oncomplete = () => resolve(req.result)
    tx.onerror = () => reject(tx.error)
  })
}

export const db = {
  async getAll(storeName) {
    return withStore(storeName, 'readonly', (store) => {
      const req = store.getAll()
      return req
    })
  },

  async getById(storeName, id) {
    return withStore(storeName, 'readonly', (store) => {
      const req = store.get(id)
      return req
    })
  },

  async add(storeName, item) {
    return withStore(storeName, 'readwrite', (store) => {
      const req = store.add(item)
      return req
    })
  },

  async put(storeName, item) {
    return withStore(storeName, 'readwrite', (store) => {
      const req = store.put(item)
      return req
    })
  },

  async delete(storeName, id) {
    return withStore(storeName, 'readwrite', (store) => {
      const req = store.delete(id)
      return req
    })
  },

  async getAllBooks() {
    return this.getAll(STORES.books)
  },

  async getBook(id) {
    return this.getById(STORES.books, id)
  },

  async addBook(book) {
    return this.add(STORES.books, {
      ...book,
      dateAdded: Date.now(),
    })
  },

  async updateBook(book) {
    return this.put(STORES.books, book)
  },

  async deleteBook(id) {
    return this.delete(STORES.books, id)
  },

  async getLabels() {
    return this.getAll(STORES.labels)
  },

  async addLabel(label) {
    return this.add(STORES.labels, { name: label })
  },

  async deleteLabel(id) {
    return this.delete(STORES.labels, id)
  },
}
