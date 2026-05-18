const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const managerUsername = process.env.MANAGER_USERNAME;
const managerPassword = process.env.MANAGER_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required. Configure a PostgreSQL database before starting the server.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

function parseReservationDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function isPastReservationDate(value) {
  const reservationDate = parseReservationDate(value);
  if (!reservationDate) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return reservationDate < today;
}

function requireManagerAuth(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Reservation management"');
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const encodedCredentials = authorization.split(' ')[1];
  const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf8');
  const separatorIndex = decodedCredentials.indexOf(':');

  if (separatorIndex === -1) {
    res.set('WWW-Authenticate', 'Basic realm="Reservation management"');
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const username = decodedCredentials.slice(0, separatorIndex);
  const password = decodedCredentials.slice(separatorIndex + 1);

  if (username !== managerUsername || password !== managerPassword) {
    res.set('WWW-Authenticate', 'Basic realm="Reservation management"');
    return res.status(401).json({ error: 'Access denied.' });
  }

  return next();
}

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result;
}

function normalizeReservation(row) {
  if (!row) {
    return row;
  }

  return {
    ...row,
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

function normalizeReservations(rows) {
  return rows.map(normalizeReservation);
}

async function initializeDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      date DATE NOT NULL,
      time TIME NOT NULL,
      guests INTEGER NOT NULL,
      message TEXT,
      created_at TIMESTAMPTZ NOT NULL
    )
  `);
}

function parseReservationDateTime(dateValue, timeValue) {
  if (typeof dateValue !== 'string' || typeof timeValue !== 'string') {
    return null;
  }

  const date = parseReservationDate(dateValue);
  if (!date) {
    return null;
  }

  const timeParts = timeValue.split(':').map(Number);
  if (timeParts.length !== 2 || timeParts.some((part) => Number.isNaN(part))) {
    return null;
  }

  date.setHours(timeParts[0], timeParts[1], 0, 0);
  return date;
}

function canModifyReservation(dateValue, timeValue) {
  const reservationDate = parseReservationDateTime(dateValue, timeValue);
  if (!reservationDate) {
    return false;
  }

  return reservationDate.getTime() - Date.now() >= 48 * 60 * 60 * 1000;
}

app.use(cors());
app.use(express.json());
app.use(['/reservations', '/reservations.html', '/api/reservations'], (req, res, next) => {
  if (req.method === 'POST') {
    return next();
  }

  return requireManagerAuth(req, res, next);
});
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/reservations', async (req, res) => {
  const { name, email, phone, date, time, guests, message } = req.body;

  if (!name || !email || !date || !time || !guests) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }

  if (!parseReservationDate(date)) {
    return res.status(400).json({ error: 'The reservation date is invalid.' });
  }

  if (isPastReservationDate(date)) {
    return res.status(400).json({ error: 'The reservation date cannot be earlier than today.' });
  }

  try {
    const createdAt = new Date().toISOString();
    const result = await query(
      `INSERT INTO reservations (name, email, phone, date, time, guests, message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [name, email, phone || '', date, time, guests, message || '', createdAt]
    );

    return res.status(201).json({ id: result.rows[0].id, message: 'Reservation saved successfully.' });
  } catch (err) {
    console.error('Reservation insert failed', err.message);
    return res.status(500).json({ error: 'Unable to save the reservation.' });
  }
});

app.get('/api/user-reservations', async (req, res) => {
  const email = String(req.query.email || '').trim();
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  try {
    const result = await query(
      `SELECT id, name, email, phone, date::text, to_char(time, 'HH24:MI') AS time, guests, message, created_at
       FROM reservations
       WHERE lower(email) = $1
       ORDER BY date DESC, time DESC`,
      [email.toLowerCase()]
    );

    return res.json(normalizeReservations(result.rows));
  } catch (err) {
    console.error('User reservations query failed', err.message);
    return res.status(500).json({ error: 'Unable to retrieve reservations.' });
  }
});

app.put('/api/user-reservations/:id', async (req, res) => {
  const reservationId = Number.parseInt(req.params.id, 10);
  const { email, date, time, guests, message } = req.body;

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return res.status(400).json({ error: 'Invalid reservation ID.' });
  }

  if (!email || !date || !time || !guests) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }

  const newDateTime = parseReservationDateTime(date, time);
  if (!newDateTime || newDateTime.getTime() <= Date.now()) {
    return res.status(400).json({ error: 'Reservation date and time are invalid or in the past.' });
  }

  try {
    const current = await query(
      `SELECT id, email, date::text, to_char(time, 'HH24:MI') AS time
       FROM reservations
       WHERE id = $1`,
      [reservationId]
    );
    const row = current.rows[0];

    if (!row) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    if (row.email.toLowerCase() !== String(email).trim().toLowerCase()) {
      return res.status(403).json({ error: 'Email does not match the reservation.' });
    }

    if (!canModifyReservation(row.date, row.time)) {
      return res.status(403).json({ error: 'This reservation can no longer be edited because less than 48 hours remain.' });
    }

    await query(
      'UPDATE reservations SET date = $1, time = $2, guests = $3, message = $4 WHERE id = $5',
      [date, time, guests, message || '', reservationId]
    );

    return res.json({ message: 'Reservation updated successfully.' });
  } catch (err) {
    console.error('User reservation update failed', err.message);
    return res.status(500).json({ error: 'Unable to update the reservation.' });
  }
});

app.delete('/api/user-reservations/:id', async (req, res) => {
  const reservationId = Number.parseInt(req.params.id, 10);
  const { email } = req.body;

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return res.status(400).json({ error: 'Invalid reservation ID.' });
  }

  if (!email) {
    return res.status(400).json({ error: 'Email is required to cancel.' });
  }

  try {
    const current = await query(
      `SELECT id, email, date::text, to_char(time, 'HH24:MI') AS time
       FROM reservations
       WHERE id = $1`,
      [reservationId]
    );
    const row = current.rows[0];

    if (!row) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    if (row.email.toLowerCase() !== String(email).trim().toLowerCase()) {
      return res.status(403).json({ error: 'Email does not match the reservation.' });
    }

    if (!canModifyReservation(row.date, row.time)) {
      return res.status(403).json({ error: 'This reservation can no longer be cancelled because less than 48 hours remain.' });
    }

    const deleted = await query('DELETE FROM reservations WHERE id = $1', [reservationId]);
    if (deleted.rowCount === 0) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    return res.json({ message: 'Reservation cancelled successfully.' });
  } catch (err) {
    console.error('User reservation delete failed', err.message);
    return res.status(500).json({ error: 'Unable to cancel the reservation.' });
  }
});

app.get('/api/reservations', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, email, phone, date::text, to_char(time, 'HH24:MI') AS time, guests, message, created_at
       FROM reservations
       ORDER BY created_at DESC`
    );

    return res.json(normalizeReservations(result.rows));
  } catch (err) {
    console.error('Reservations query failed', err.message);
    return res.status(500).json({ error: 'Unable to retrieve reservations.' });
  }
});

app.put('/api/reservations/:id', async (req, res) => {
  const reservationId = Number.parseInt(req.params.id, 10);
  const { name, email, phone, date, time, guests, message } = req.body;

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return res.status(400).json({ error: 'Invalid reservation ID.' });
  }

  if (!name || !email || !date || !time || !guests) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }

  const newDateTime = parseReservationDateTime(date, time);
  if (!newDateTime) {
    return res.status(400).json({ error: 'Reservation date and time are invalid.' });
  }

  try {
    const updated = await query(
      `UPDATE reservations
       SET name = $1, email = $2, phone = $3, date = $4, time = $5, guests = $6, message = $7
       WHERE id = $8`,
      [name, email, phone || '', date, time, guests, message || '', reservationId]
    );

    if (updated.rowCount === 0) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    return res.json({ message: 'Reservation updated successfully.' });
  } catch (err) {
    console.error('Reservation update failed', err.message);
    return res.status(500).json({ error: 'Unable to update the reservation.' });
  }
});

app.delete('/api/reservations/:id', async (req, res) => {
  const reservationId = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return res.status(400).json({ error: 'Invalid reservation ID.' });
  }

  try {
    const deleted = await query('DELETE FROM reservations WHERE id = $1', [reservationId]);
    if (deleted.rowCount === 0) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    return res.json({ message: 'Reservation deleted successfully.' });
  } catch (err) {
    console.error('Reservation delete failed', err.message);
    return res.status(500).json({ error: 'Unable to delete the reservation.' });
  }
});

app.get('/reservations', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reservations.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Database initialization failed', err.message);
    process.exit(1);
  }
}

startServer();

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
