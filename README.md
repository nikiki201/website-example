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

## Manager Access

Set these environment variables before using the manager pages:

- `MANAGER_USERNAME`
- `MANAGER_PASSWORD`
- `DATABASE_URL`

On Render, create a PostgreSQL database and copy its internal connection string into the web service environment variable `DATABASE_URL`.

## Render Deployment

1. Create a Render PostgreSQL database.
2. Copy the database internal connection string.
3. Add it to the Render Web Service as `DATABASE_URL`.
4. Add `MANAGER_USERNAME` and `MANAGER_PASSWORD`.
5. Deploy the latest GitHub commit.
6. Open the public site and admin page from the same Render domain.

## Notes

- The `reservations` table is created automatically in PostgreSQL when the server starts.
- Menu items in `public/script.js` are easy to replace with the exact Mee Noodle menu when available.
