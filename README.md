# Bistro du Quai

Site ergonomique pour un restaurant imaginaire avec système de réservation basé sur une base de données SQLite.

## Structure du projet

- `public/index.html` : page du site
- `public/styles.css` : styles et mise en page
- `public/script.js` : logique du formulaire de réservation côté client
- `public/reservations.html` : espace de gestion des réservations
- `public/reservations.js` : affichage, recherche et suppression des réservations
- `server.js` : backend Express qui gère les réservations et la protection de l'espace gérant
- `package.json` : dépendances et script de démarrage

## Déploiement sur Render

1. Connectez votre repository GitHub à Render
2. Configurez les variables d'environnement dans Render :
   - `MANAGER_USERNAME` : nom d'utilisateur pour accéder à la gestion
   - `MANAGER_PASSWORD` : mot de passe pour accéder à la gestion
3. Render déploiera automatiquement votre application

## Fonctionnalités

- Page responsive pour un restaurant
- Formulaire de réservation connecté à une base de données SQLite
- Blocage des dates de réservation antérieures à la date actuelle
- API REST pour enregistrer les réservations (`POST /api/reservations`)
- Espace gérant protégé par authentification HTTP Basic pour consulter et supprimer les réservations
- Suppression d'une réservation via `DELETE /api/reservations/:id`

## Notes

- La base de données `reservations.db` est créée automatiquement à la première réservation.
- Les identifiants gérant doivent être configurés dans les variables d'environnement de Render.
- Si vous souhaitez personnaliser le restaurant, modifiez `public/index.html` et `public/styles.css`.
