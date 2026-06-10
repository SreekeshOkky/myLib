# My Library

A personal book catalog PWA. Scan barcodes, look up books via ISBN, track what you're reading, manage loans, and organize with labels — all stored locally on your device.

## Features

### Cataloging
- **Barcode scanning** — point your camera at an ISBN barcode to auto-fill book details
- **ISBN lookup** — manual entry fetches title, author, cover, publisher, language, and genre from the [Open Library](https://openlibrary.org/) free API
- **Manual entry** — add books by entering details directly
- **Duplicate detection** — warns when adding a book with the same title, offers merge or add-as-new
- **Rating** — 1–5 star rating per book
- **Labels** — create custom labels to organize your library, filter by label
- **Notes** — free-text notes on each book

### Reading Workflow
- **Reading status** — mark books as *To Read*, *Reading*, or *Finished* with color-coded badges on cards and an inline switcher on the detail page
- **Yearly reading goal** — set a goal in the stats modal and track progress with a progress bar

### Loan Tracking
- **Loan out** — lend books to friends with borrower name, date, and optional notes
- **Return** — mark books as returned with one click
- **Filter** — show only currently-loaned or available books

### Search & Organization
- **Search** — by title, author, or ISBN
- **Filters** — by label, language, rating, reading status, loan status
- **Sort** — by date, title, author, or rating (ascending/descending)
- **Author view** — click an author name to see all their books
- **Surprise Me** — pick a random book from your library
- **Stats** — total books, average rating, total pages, top genre/language/label, reading goal

### Visual
- **Colored cover placeholders** — books without a cover image show the first letter of the title on a unique hue derived from the title text
- **Skeleton loading** — pulsing placeholder cards while the library loads
- **Dark theme** — mobile-first responsive design with sheet overlays for scan, form, and detail views
- **PWA** — installable on phones (manifest + service worker), works offline for cached assets
- **All data on-device** — stored in IndexedDB, no accounts or servers

## Commands

```bash
npm run dev      # Start dev server with hot reload
npm run build    # Build for production → dist/
npm run preview  # Preview the production build
```

## Usage

1. Run `npm run dev` and open the URL in your browser
2. Tap **＋** to add your first book
3. Scan a barcode, enter an ISBN, or fill in the details manually
4. Rate, label, add notes, set reading status
5. Loan books to friends from the detail page
6. Install the app on your phone via the browser's "Add to Home Screen"
