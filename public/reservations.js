const reservationList = document.getElementById('reservation-list');
const reservationCount = document.getElementById('reservation-count');
const reservationEmpty = document.getElementById('reservation-empty');
const searchInput = document.getElementById('reservation-search');
let reservations = [];

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function renderReservations(items) {
  reservationList.innerHTML = '';

  if (!items.length) {
    reservationEmpty.hidden = false;
    reservationCount.textContent = '0 réservation trouvée';
    return;
  }

  reservationEmpty.hidden = true;
  reservationCount.textContent = `${items.length} réservation${items.length > 1 ? 's' : ''}`;

  items.forEach((reservation) => {
    const card = document.createElement('article');
    card.className = 'reservation-card';
    card.innerHTML = `
      <div class="reservation-card-header">
        <div>
          <h3>${reservation.name}</h3>
          <p class="mute">${reservation.email} · ${reservation.phone || 'Pas de téléphone'}</p>
        </div>
        <span class="pill">${reservation.guests} pers.</span>
      </div>
      <div class="reservation-card-body">
        <p><strong>Date :</strong> ${reservation.date} à ${reservation.time}</p>
        <p><strong>Créée le :</strong> ${formatDate(reservation.created_at)}</p>
        <p><strong>Message :</strong> ${reservation.message || 'Aucun message'} </p>
      </div>
    `;
    reservationList.appendChild(card);
  });
}

function filterReservations(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    renderReservations(reservations);
    return;
  }

  const filtered = reservations.filter((item) => {
    return [
      item.name,
      item.email,
      item.phone,
      item.date,
      item.time,
      item.message
    ].some((value) => value && value.toString().toLowerCase().includes(normalized));
  });

  renderReservations(filtered);
}

async function loadReservations() {
  try {
    const response = await fetch('/api/reservations');
    const data = await response.json();
    reservations = Array.isArray(data) ? data : [];
    renderReservations(reservations);
  } catch (error) {
    reservationCount.textContent = 'Erreur de chargement';
    reservationEmpty.hidden = false;
    reservationEmpty.textContent = 'Impossible de charger les réservations. Veuillez réessayer plus tard.';
    console.error(error);
  }
}

searchInput.addEventListener('input', (event) => {
  filterReservations(event.target.value);
});

loadReservations();
