const form = document.getElementById('reservation-form');
const status = document.getElementById('form-status');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  status.textContent = 'Envoi en cours...';

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la réservation.');
    }

    status.textContent = 'Votre réservation a bien été enregistrée. Merci !';
    form.reset();
  } catch (error) {
    console.error('Erreur fetch:', error);
    status.textContent = `Échec : ${error.message}`;
    status.style.color = '#b23a2d';
  }
});
