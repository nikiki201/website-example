const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, 'reservations.db');
const managerUsername = process.env.MANAGER_USERNAME;
const managerPassword = process.env.MANAGER_PASSWORD;

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

app.use(cors());
app.use(express.json());
app.use(['/reservations', '/reservations.html', '/mobile-admin.html', '/api/reservations'], (req, res, next) => {
  if (req.method === 'POST') {
    return next();
  }

  return requireManagerAuth(req, res, next);
});
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection failed', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      guests INTEGER NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL
    )`
  );
});

app.post('/api/reservations', (req, res) => {
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

  const createdAt = new Date().toISOString();
  const query = 'INSERT INTO reservations (name, email, phone, date, time, guests, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

  db.run(query, [name, email, phone || '', date, time, guests, message || '', createdAt], function onInsert(err) {
    if (err) {
      console.error('Reservation insert failed', err.message);
      return res.status(500).json({ error: 'Unable to save the reservation.' });
    }

    return res.status(201).json({ id: this.lastID, message: 'Reservation saved successfully.' });
  });
});

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

app.get('/api/user-reservations', (req, res) => {
  const email = String(req.query.email || '').trim();
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  db.all(
    'SELECT * FROM reservations WHERE lower(email) = ? ORDER BY date DESC, time DESC',
    [email.toLowerCase()],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Unable to retrieve reservations.' });
      }

      return res.json(rows);
    }
  );
});

app.put('/api/user-reservations/:id', (req, res) => {
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

  db.get('SELECT * FROM reservations WHERE id = ?', [reservationId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to retrieve the reservation.' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    if (row.email.toLowerCase() !== String(email).trim().toLowerCase()) {
      return res.status(403).json({ error: 'Email does not match the reservation.' });
    }

    if (!canModifyReservation(row.date, row.time)) {
      return res.status(403).json({ error: 'This reservation can no longer be edited because less than 48 hours remain.' });
    }

    db.run(
      'UPDATE reservations SET date = ?, time = ?, guests = ?, message = ? WHERE id = ?',
      [date, time, guests, message || '', reservationId],
      function onUpdate(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: 'Unable to update the reservation.' });
        }

        return res.json({ message: 'Reservation updated successfully.' });
      }
    );
  });
});

app.delete('/api/user-reservations/:id', (req, res) => {
  const reservationId = Number.parseInt(req.params.id, 10);
  const { email } = req.body;

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return res.status(400).json({ error: 'Invalid reservation ID.' });
  }

  if (!email) {
    return res.status(400).json({ error: 'Email is required to cancel.' });
  }

  db.get('SELECT * FROM reservations WHERE id = ?', [reservationId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to retrieve the reservation.' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    if (row.email.toLowerCase() !== String(email).trim().toLowerCase()) {
      return res.status(403).json({ error: 'Email does not match the reservation.' });
    }

    if (!canModifyReservation(row.date, row.time)) {
      return res.status(403).json({ error: 'This reservation can no longer be cancelled because less than 48 hours remain.' });
    }

    db.run('DELETE FROM reservations WHERE id = ?', [reservationId], function onDelete(deleteErr) {
      if (deleteErr) {
        return res.status(500).json({ error: 'Unable to cancel the reservation.' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Reservation not found.' });
      }

      return res.json({ message: 'Reservation cancelled successfully.' });
    });
  });
});

app.get('/api/reservations', (req, res) => {
  db.all('SELECT * FROM reservations ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to retrieve reservations.' });
    }

    return res.json(rows);
  });
});

app.put('/api/reservations/:id', (req, res) => {
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

  db.get('SELECT * FROM reservations WHERE id = ?', [reservationId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to retrieve the reservation.' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    db.run(
      'UPDATE reservations SET name = ?, email = ?, phone = ?, date = ?, time = ?, guests = ?, message = ? WHERE id = ?',
      [name, email, phone || '', date, time, guests, message || '', reservationId],
      function onUpdate(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: 'Unable to update the reservation.' });
        }

        return res.json({ message: 'Reservation updated successfully.' });
      }
    );
  });
});

app.delete('/api/reservations/:id', (req, res) => {
  const reservationId = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return res.status(400).json({ error: 'Invalid reservation ID.' });
  }

  db.run('DELETE FROM reservations WHERE id = ?', [reservationId], function onDelete(err) {
    if (err) {
      return res.status(500).json({ error: 'Unable to delete the reservation.' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    return res.json({ message: 'Reservation deleted successfully.' });
  });
});

app.get('/reservations', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reservations.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
