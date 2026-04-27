const form = document.getElementById('user-search-form');
const emailInput = document.getElementById('user-email');
const status = document.getElementById('user-status');
const reservationsContainer = document.getElementById('user-reservations');
let currentEmail = '';
let currentReservations = [];

const HOUR_MS = 60 * 60 * 1000;
const MODIFY_WINDOW_MS = 48 * HOUR_MS;

function getTodayIsoDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDateTime(dateString, timeString) {
  if (!dateString || !timeString) {
    return null;
  }

  const [year, month, day] = dateString.split('-').map(Number);
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(dateString, timeString) {
  const date = parseDateTime(dateString, timeString);
  if (!date) {
    return `${dateString} ${timeString}`;
  }

  return date.toLocaleString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function canModifyReservation(dateString, timeString) {
  const reservationDate = parseDateTime(dateString, timeString);
  if (!reservationDate) {
    return false;
  }

  return reservationDate.getTime() - Date.now() >= MODIFY_WINDOW_MS;
}

function isPastReservation(dateString, timeString) {
  const reservationDate = parseDateTime(dateString, timeString);
  if (!reservationDate) {
    return false;
  }

  return reservationDate.getTime() < Date.now();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showStatus(message, type = 'info') {
  status.textContent = message;
  status.style.color = type === 'error' ? '#b23a2d' : '#2f6a3a';
}

function clearStatus() {
  status.textContent = '';
}

function renderCard(reservation) {
  const reservationDate = formatDateTime(reservation.date, reservation.time);
  const canModify = canModifyReservation(reservation.date, reservation.time);
  const past = isPastReservation(reservation.date, reservation.time);

  const card = document.createElement('article');
  card.className = 'reservation-card reservation-card-user';
  card.dataset.reservationId = reservation.id;
  card.innerHTML = `
    <div class="reservation-card-header">
      <div>
        <h3>${escapeHtml(reservation.name)}</h3>
        <p class="mute">${escapeHtml(reservation.email)} · ${escapeHtml(reservation.phone || 'Pas de telephone')}</p>
      </div>
      <span class="pill">${escapeHtml(reservation.guests)} pers.</span>
    </div>
    <div class="reservation-card-body">
      <p><strong>Reservation :</strong> ${escapeHtml(reservationDate)}</p>
      <p><strong>Message :</strong> ${escapeHtml(reservation.message || 'Aucun message')}</p>
      <p class="reservation-note">${past ? 'Cette r�servation est pass�e.' : canModify ? 'Modification possible jusqu�� 48 heures avant.' : 'Modification non disponible : moins de 48 heures restantes.'}</p>
    </div>
    <div class="reservation-card-actions">
      ${!past && canModify ? `<button class="button" type="button" data-edit-id="${reservation.id}">Modifier</button> <button class="button button-danger" type="button" data-cancel-id="${reservation.id}">Annuler</button>` : ''}
    </div>
  `;

  return card;
}

function renderReservations(items) {
  currentReservations = Array.isArray(items) ? items : [];
  reservationsContainer.innerHTML = '';

  if (!currentReservations.length) {
    reservationsContainer.innerHTML = `
      <div class="info-card">
        Aucune reservation trouvee. Verifiez l'adresse email utilisee lors de la reservation.
      </div>
    `;
    return;
  }

  const now = Date.now();
  const upcoming = currentReservations.filter((item) => parseDateTime(item.date, item.time)?.getTime() >= now);
  const past = currentReservations.filter((item) => parseDateTime(item.date, item.time)?.getTime() < now);

  if (upcoming.length) {
    const section = document.createElement('section');
    section.innerHTML = '<h3>Reservations actuelles</h3>';
    const grid = document.createElement('div');
    grid.className = 'reservations-grid';
    upcoming.forEach((reservation) => grid.appendChild(renderCard(reservation)));
    section.appendChild(grid);
    reservationsContainer.appendChild(section);
  }

  if (past.length) {
    const section = document.createElement('section');
    section.innerHTML = '<h3>Reservations passees</h3>';
    const grid = document.createElement('div');
    grid.className = 'reservations-grid';
    past.forEach((reservation) => grid.appendChild(renderCard(reservation)));
    section.appendChild(grid);
    reservationsContainer.appendChild(section);
  }
}

async function fetchReservations(email) {
  try {
    showStatus('Recherche en cours...', 'info');
    const response = await fetch(`/api/user-reservations?email=${encodeURIComponent(email)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Impossible de recuperer les reservations.');
    }

    clearStatus();
    renderReservations(Array.isArray(data) ? data : []);
  } catch (error) {
    showStatus(error.message, 'error');
    reservationsContainer.innerHTML = '';
  }
}

function toggleEditForm(card, reservation) {
  card.innerHTML = `
    <form class="edit-reservation-form" data-reservation-id="${reservation.id}">
      <div class="form-grid">
        <label>
          Date
          <input type="date" name="date" value="${escapeHtml(reservation.date)}" min="${getTodayIsoDate()}" required />
        </label>
        <label>
          Heure
          <input type="time" name="time" value="${escapeHtml(reservation.time)}" required />
        </label>
        <label>
          Nombre de personnes
          <input type="number" name="guests" min="1" max="20" value="${escapeHtml(reservation.guests)}" required />
        </label>
        <label class="full-width">
          Message
          <textarea name="message" rows="3">${escapeHtml(reservation.message || '')}</textarea>
        </label>
      </div>
      <div class="reservation-card-actions">
        <button class="button" type="submit">Enregistrer</button>
        <button class="button button-danger" type="button" data-cancel-edit="${reservation.id}">Annuler</button>
      </div>
    </form>
  `;
}

async function cancelReservation(id) {
  const confirmed = window.confirm('Êtes-vous sûr de vouloir annuler cette réservation ? Cette action est irréversible.');
  if (!confirmed) {
    return;
  }

  try {
    showStatus('Annulation en cours...', 'info');
    const response = await fetch(`/api/user-reservations/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentEmail }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Impossible d\'annuler la réservation.');
    }

    showStatus('Réservation annulée avec succès.', 'info');
    await fetchReservations(currentEmail);
  } catch (error) {
    showStatus(error.message, 'error');
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  currentEmail = emailInput.value.trim();

  if (!currentEmail) {
    showStatus('Veuillez saisir une adresse email valide.', 'error');
    return;
  }

  fetchReservations(currentEmail);
});

reservationsContainer.addEventListener('click', (event) => {
  const editButton = event.target.closest('[data-edit-id]');
  const cancelButton = event.target.closest('[data-cancel-id]');
  const cancelEditButton = event.target.closest('[data-cancel-edit]');

  if (editButton) {
    const reservationId = Number(editButton.dataset.editId);
    const reservation = currentReservations.find((item) => item.id === reservationId);
    const card = event.target.closest('.reservation-card');

    if (reservation && card) {
      toggleEditForm(card, reservation);
    }
  }

  if (cancelButton) {
    const reservationId = Number(cancelButton.dataset.cancelId);
    cancelReservation(reservationId);
  }

  if (cancelEditButton) {
    renderReservations(currentReservations);
  }
});

reservationsContainer.addEventListener('submit', (event) => {
  const formElement = event.target.closest('.edit-reservation-form');
  if (!formElement) {
    return;
  }

  event.preventDefault();
  const reservationId = Number(formElement.dataset.reservationId);
  const data = new FormData(formElement);
  const payload = {
    email: currentEmail,
    date: data.get('date'),
    time: data.get('time'),
    guests: Number(data.get('guests')),
    message: data.get('message'),
  };

  updateReservation(reservationId, payload);
});

clearStatus();
