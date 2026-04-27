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
    res.set('WWW-Authenticate', 'Basic realm="Gestion reservations"');
    return res.status(401).json({ error: 'Authentification requise.' });
  }

  const encodedCredentials = authorization.split(' ')[1];
  const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf8');
  const separatorIndex = decodedCredentials.indexOf(':');

  if (separatorIndex === -1) {
    res.set('WWW-Authenticate', 'Basic realm="Gestion reservations"');
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }

  const username = decodedCredentials.slice(0, separatorIndex);
  const password = decodedCredentials.slice(separatorIndex + 1);

  if (username !== managerUsername || password !== managerPassword) {
    res.set('WWW-Authenticate', 'Basic realm="Gestion reservations"');
    return res.status(401).json({ error: 'Accès refusé.' });
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
    console.error('Echec de la connexion a la base de donnees', err.message);
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
    return res.status(400).json({ error: 'Veuillez renseigner tous les champs requis.' });
  }

  if (!parseReservationDate(date)) {
    return res.status(400).json({ error: 'La date de reservation est invalide.' });
  }

  if (isPastReservationDate(date)) {
    return res.status(400).json({ error: "La date de reservation ne peut pas etre anterieure a aujourd'hui." });
  }

  const createdAt = new Date().toISOString();
  const query = 'INSERT INTO reservations (name, email, phone, date, time, guests, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

  db.run(query, [name, email, phone || '', date, time, guests, message || '', createdAt], function onInsert(err) {
    if (err) {
      console.error("Erreur lors de l'insertion de la reservation", err.message);
      return res.status(500).json({ error: "Impossible d'enregistrer la reservation." });
    }

    return res.status(201).json({ id: this.lastID, message: 'Reservation enregistree avec succes.' });
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
    return res.status(400).json({ error: 'Email requis.' });
  }

  db.all(
    'SELECT * FROM reservations WHERE lower(email) = ? ORDER BY date DESC, time DESC',
    [email.toLowerCase()],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Impossible de recuperer les reservations.' });
      }

      return res.json(rows);
    }
  );
});

app.put('/api/user-reservations/:id', (req, res) => {
  const reservationId = Number.parseInt(req.params.id, 10);
  const { email, date, time, guests, message } = req.body;

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return res.status(400).json({ error: 'Identifiant de reservation invalide.' });
  }

  if (!email || !date || !time || !guests) {
    return res.status(400).json({ error: 'Veuillez renseigner tous les champs requis.' });
  }

  const newDateTime = parseReservationDateTime(date, time);
  if (!newDateTime || newDateTime.getTime() <= Date.now()) {
    return res.status(400).json({ error: 'Date et heure de reservation invalides ou passees.' });
  }

  db.get('SELECT * FROM reservations WHERE id = ?', [reservationId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Impossible de recuperer la reservation.' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Reservation introuvable.' });
    }

    if (row.email.toLowerCase() !== String(email).trim().toLowerCase()) {
      return res.status(403).json({ error: 'Email non conforme a la reservation.' });
    }

    if (!canModifyReservation(row.date, row.time)) {
      return res.status(403).json({ error: 'Cette reservation ne peut plus etre modifiee : moins de 48 heures restantes.' });
    }

    db.run(
      'UPDATE reservations SET date = ?, time = ?, guests = ?, message = ? WHERE id = ?',
      [date, time, guests, message || '', reservationId],
      function onUpdate(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: 'Impossible de mettre a jour la reservation.' });
        }

        return res.json({ message: 'Reservation modifiee avec succes.' });
      }
    );
  });
});

app.delete('/api/user-reservations/:id', (req, res) => {
  const reservationId = Number.parseInt(req.params.id, 10);
  const { email } = req.body;

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return res.status(400).json({ error: 'Identifiant de reservation invalide.' });
  }

  if (!email) {
    return res.status(400).json({ error: 'Email requis pour l\'annulation.' });
  }

  db.get('SELECT * FROM reservations WHERE id = ?', [reservationId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Impossible de recuperer la reservation.' });
    }

    if (!row) {
      return res.status(404).json({ error: 'Reservation introuvable.' });
    }

    if (row.email.toLowerCase() !== String(email).trim().toLowerCase()) {
      return res.status(403).json({ error: 'Email non conforme a la reservation.' });
    }

    if (!canModifyReservation(row.date, row.time)) {
      return res.status(403).json({ error: 'Cette reservation ne peut plus etre annulee : moins de 48 heures restantes.' });
    }

    db.run('DELETE FROM reservations WHERE id = ?', [reservationId], function onDelete(deleteErr) {
      if (deleteErr) {
        return res.status(500).json({ error: 'Impossible d\'annuler la reservation.' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Reservation introuvable.' });
      }

      return res.json({ message: 'Reservation annulee avec succes.' });
    });
  });
});

app.get('/api/reservations', (req, res) => {
  db.all('SELECT * FROM reservations ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Impossible de recuperer les reservations.' });
    }

    return res.json(rows);
  });
});

app.delete('/api/reservations/:id', (req, res) => {
  const reservationId = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return res.status(400).json({ error: 'Identifiant de reservation invalide.' });
  }

  db.run('DELETE FROM reservations WHERE id = ?', [reservationId], function onDelete(err) {
    if (err) {
      return res.status(500).json({ error: 'Impossible de supprimer la reservation.' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Reservation introuvable.' });
    }

    return res.json({ message: 'Reservation supprimee avec succes.' });
  });
});

app.get('/reservations', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reservations.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Serveur demarre sur http://localhost:${PORT}`);
});
