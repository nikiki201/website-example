const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, 'reservations.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Échec de la connexion à la base de données', err.message);
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

  const createdAt = new Date().toISOString();
  const query = `INSERT INTO reservations (name, email, phone, date, time, guests, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  db.run(query, [name, email, phone || '', date, time, guests, message || '', createdAt], function (err) {
    if (err) {
      console.error('Erreur lors de l’insertion de la réservation', err.message);
      return res.status(500).json({ error: 'Impossible d’enregistrer la réservation.' });
    }

    res.status(201).json({ id: this.lastID, message: 'Réservation enregistrée avec succès.' });
  });
});

app.get('/api/reservations', (req, res) => {
  db.all('SELECT * FROM reservations ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Impossible de récupérer les réservations.' });
    }
    res.json(rows);
  });
});

app.get('/reservations', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reservations.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
