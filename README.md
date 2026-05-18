# Mee Noodle Amsterdam

Website for Mee Noodle at Damstraat 1, 1012 JL Amsterdam, with online reservations backed by SQLite.

## Project Structure

- `public/index.html`: public website
- `public/styles.css`: layout and visual styles
- `public/script.js`: reservation form and EN/NL language switcher
- `public/reservations.html`: manager reservation area
- `public/reservations.js`: reservation display, search and deletion
- `public/mobile-admin.html`: mobile PWA admin app
- `public/mobile-admin.js`: mobile app logic
- `public/mobile-admin.css`: mobile app styles
- `server.js`: Express backend for reservations and manager protection
- `package.json`: dependencies and start script

## Features

- Responsive restaurant website
- English and Dutch content switcher on the main interface
- Online reservation form connected to SQLite
- Past reservation dates blocked on client and server
- REST API for reservations
- Basic-auth protected manager area
- Mobile PWA admin interface

## Run Locally

```bash
npm start
```

The site runs at `http://localhost:3000`.

## Manager Access

Set these environment variables before using the manager pages:

- `MANAGER_USERNAME`
- `MANAGER_PASSWORD`

## Notes

- `reservations.db` is created automatically when reservations are saved.
- Menu items in `public/script.js` are easy to replace with the exact Mee Noodle menu when available.
