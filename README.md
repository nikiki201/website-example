# Bistro du Quai

Site ergonomique pour un restaurant imaginaire avec système de réservation basé sur une base de données SQLite.

## Structure du projet

- `public/index.html` : page du site
- `public/styles.css` : styles et mise en page
- `public/script.js` : fonction de réservation côté client
- `server.js` : backend Express qui gère les réservations
- `package.json` : dépendances et script de démarrage

## Installation

1. Ouvrez un terminal dans `c:\Users\Ndute\Documents\PlatformIO\Projects\restaurant-website`
2. Exécutez :

```bash
npm install
```

3. Lancez le serveur :

```bash
npm start
```

4. Ouvrez `http://localhost:3000` dans votre navigateur.

## Fonctionnalités

- Page responsive pour un restaurant
- Section informations sur l’établissement, menu, FAQ et contact
- Formulaire de réservation connecté à une base de données SQLite
- API REST pour enregistrer les réservations (`POST /api/reservations`)
- Endpoint d’administration simple accessible via `GET /api/reservations`

## Notes

- La base de données `reservations.db` est créée automatiquement à la première réservation.
- Si vous souhaitez personnaliser le restaurant, modifiez `public/index.html` et `public/styles.css`.
