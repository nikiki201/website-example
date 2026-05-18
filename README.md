# Mee Noodle Amsterdam

Website for Mee Noodle at Damstraat 1, 1012 JL Amsterdam, with online reservations backed by PostgreSQL.

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
- Online reservation form connected to PostgreSQL
- Past reservation dates blocked on client and server
- REST API for reservations
- Basic-auth protected manager area
- Mobile PWA admin interface

## Run Locally

```bash
set DATABASE_URL=postgresql://user:password@localhost:5432/restaurant_website
set MANAGER_USERNAME=admin
set MANAGER_PASSWORD=your_password
npm start
```

The site runs at `http://localhost:3000`.

On PowerShell, use:

```powershell
$env:DATABASE_URL="postgresql://user:password@localhost:5432/restaurant_website"
$env:MANAGER_USERNAME="admin"
$env:MANAGER_PASSWORD="your_password"
npm start
```

## Manager Access

Set these environment variables before using the manager pages:

- `MANAGER_USERNAME`
- `MANAGER_PASSWORD`
- `DATABASE_URL`

On Render, create a PostgreSQL database and copy its internal connection string into the web service environment variable `DATABASE_URL`.

## Notes

- The `reservations` table is created automatically in PostgreSQL when the server starts.
- Menu items in `public/script.js` are easy to replace with the exact Mee Noodle menu when available.
