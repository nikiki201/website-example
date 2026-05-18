// Mobile Admin App
class MobileAdmin {
  constructor() {
    this.reservations = [];
    this.currentFilter = 'all';
    this.currentTab = 'reservations';
    this.authToken = null;
    this.refreshTimer = null;

    this.init();
  }

  init() {
    this.bindEvents();
    this.checkAuth();
  }

  bindEvents() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Search
    const searchInput = document.getElementById('mobile-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    // Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleFilter(e.target.dataset.filter));
    });

    // Modal
    const modal = document.getElementById('reservation-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal') || e.target.classList.contains('modal-close')) {
          this.closeModal();
        }
      });
    }

    // Edit reservation
    const editBtn = document.getElementById('edit-reservation-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => this.toggleEditMode());
    }

    const deleteBtn = document.getElementById('delete-reservation-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.deleteCurrentReservation());
    }
  }

  async handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
      const response = await fetch('/api/reservations', {
        headers: {
          'Authorization': 'Basic ' + btoa(username + ':' + password)
        }
      });

      if (response.ok) {
        this.authToken = btoa(username + ':' + password);
        localStorage.setItem('adminAuth', this.authToken);
        this.showApp();
        await this.loadReservations();
        this.loadStats();
      } else {
        this.showLoginError('Incorrect credentials');
      }
    } catch (error) {
      this.showLoginError('Connection error');
      console.error(error);
    }
  }

  handleLogout() {
    this.authToken = null;
    localStorage.removeItem('adminAuth');
    this.stopAutoRefresh();
    this.showLogin();
  }

  checkAuth() {
    const savedAuth = localStorage.getItem('adminAuth');
    if (savedAuth) {
      this.authToken = savedAuth;
      this.showApp();
      this.loadReservations().then(() => this.loadStats());
    } else {
      this.showLogin();
    }
  }

  showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display = 'none';
  }

  showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
    this.startAutoRefresh();
  }

  startAutoRefresh() {
    this.stopAutoRefresh();
    this.refreshTimer = window.setInterval(() => {
      if (this.authToken) {
        this.loadReservations({ silent: true }).then(() => this.loadStats());
      }
    }, 5000);
  }

  stopAutoRefresh() {
    if (this.refreshTimer) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  showLoginError(message) {
    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }

  switchTab(tabName) {
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');

    this.currentTab = tabName;

    if (tabName === 'stats') {
      this.loadStats();
    }
  }

  async loadReservations(options = {}) {
    const previousIds = new Set(this.reservations.map((reservation) => reservation.id));

    try {
      const response = await fetch('/api/reservations', {
        headers: {
          'Authorization': 'Basic ' + this.authToken
        }
      });

      if (response.ok) {
        const nextReservations = await response.json();
        const hasNewReservation = nextReservations.some((reservation) => !previousIds.has(reservation.id));

        this.reservations = nextReservations;
        this.renderReservations();

        if (options.silent && hasNewReservation && previousIds.size > 0) {
          this.showToast('New reservation received');
        }
      } else if (response.status === 401) {
        this.handleLogout();
      } else {
        throw new Error('Loading error');
      }
    } catch (error) {
      console.error('Reservation loading error:', error);
      this.showToast('Reservation loading error', 'error');
    }
  }

  async loadStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const totalReservations = this.reservations.length;
    const todayReservations = this.reservations.filter(r => {
      const reservationDate = new Date(r.date);
      return reservationDate.toDateString() === today.toDateString();
    }).length;

    const totalGuests = this.reservations.reduce((sum, r) => sum + r.guests, 0);
    const avgGuests = totalReservations > 0 ? Math.round(totalGuests / totalReservations) : 0;

    document.getElementById('total-reservations').textContent = totalReservations;
    document.getElementById('today-reservations').textContent = todayReservations;
    document.getElementById('total-guests').textContent = totalGuests;
    document.getElementById('avg-guests').textContent = avgGuests;
  }

  renderReservations() {
    const filteredReservations = this.filterReservations();
    const reservationsList = document.getElementById('reservations-list');
    const emptyState = document.getElementById('empty-state');
    const countText = document.getElementById('reservations-count-text');

    if (filteredReservations.length === 0) {
      reservationsList.innerHTML = '';
      emptyState.style.display = 'block';
      countText.textContent = '0 reservations';
      return;
    }

    emptyState.style.display = 'none';
    countText.textContent = `${filteredReservations.length} reservation${filteredReservations.length > 1 ? 's' : ''}`;

    reservationsList.innerHTML = filteredReservations.map(reservation => `
      <div class="reservation-card" data-id="${reservation.id}" onclick="mobileAdmin.showReservationDetails(${reservation.id})">
        <div class="reservation-header">
          <h3 class="reservation-name">${this.escapeHtml(reservation.name)}</h3>
          <span class="reservation-guests">${reservation.guests} guests</span>
        </div>
        <div class="reservation-info">
          <div>${this.escapeHtml(reservation.email)}</div>
          <div class="reservation-date">${this.formatDate(reservation.date)} at ${reservation.time}</div>
        </div>
      </div>
    `).join('');
  }

  filterReservations() {
    let filtered = [...this.reservations];

    // Filter by date
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (this.currentFilter) {
      case 'today':
        filtered = filtered.filter(r => {
          const reservationDate = new Date(r.date);
          return reservationDate.toDateString() === today.toDateString();
        });
        break;
      case 'upcoming':
        filtered = filtered.filter(r => new Date(r.date) >= today);
        break;
    }

    // Filter by search
    const searchTerm = document.getElementById('mobile-search').value.toLowerCase().trim();
    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(searchTerm) ||
        r.email.toLowerCase().includes(searchTerm) ||
        r.date.includes(searchTerm) ||
        r.time.includes(searchTerm) ||
        (r.phone && r.phone.includes(searchTerm))
      );
    }

    // Sort by date (most recent first)
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return filtered;
  }

  handleSearch(query) {
    this.renderReservations();
  }

  handleFilter(filter) {
    // Update filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

    this.currentFilter = filter;
    this.renderReservations();
  }

  showReservationDetails(id) {
    const reservation = this.reservations.find(r => r.id === id);
    if (!reservation) return;

    const details = document.getElementById('reservation-details');
    details.innerHTML = `
      <div class="reservation-detail">
        <span class="detail-label">Name:</span>
        <span class="detail-value">${this.escapeHtml(reservation.name)}</span>
      </div>
      <div class="reservation-detail">
        <span class="detail-label">Email:</span>
        <span class="detail-value">${this.escapeHtml(reservation.email)}</span>
      </div>
      <div class="reservation-detail">
        <span class="detail-label">Phone:</span>
        <span class="detail-value">${this.escapeHtml(reservation.phone || 'Not provided')}</span>
      </div>
      <div class="reservation-detail">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${this.formatDate(reservation.date)}</span>
      </div>
      <div class="reservation-detail">
        <span class="detail-label">Time:</span>
        <span class="detail-value">${reservation.time}</span>
      </div>
      <div class="reservation-detail">
        <span class="detail-label">Number of guests:</span>
        <span class="detail-value">${reservation.guests}</span>
      </div>
      <div class="reservation-detail">
        <span class="detail-label">Message:</span>
        <span class="detail-value">${this.escapeHtml(reservation.message || 'None')}</span>
      </div>
      <div class="reservation-detail">
        <span class="detail-label">Created:</span>
        <span class="detail-value">${this.formatDateTime(reservation.created_at)}</span>
      </div>
    `;

    document.getElementById('delete-reservation-btn').dataset.id = id;
    document.getElementById('edit-reservation-btn').dataset.id = id;
    document.getElementById('reservation-modal').style.display = 'flex';
  }

  closeModal() {
    document.getElementById('reservation-modal').style.display = 'none';
  }

  async deleteCurrentReservation() {
    const id = document.getElementById('delete-reservation-btn').dataset.id;
    if (!id) return;

    if (!confirm('Are you sure you want to delete this reservation?')) {
      return;
    }

    try {
      const response = await fetch(`/api/reservations/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Basic ' + this.authToken
        }
      });

      if (response.ok) {
        this.reservations = this.reservations.filter(r => r.id !== parseInt(id));
        this.renderReservations();
        this.loadStats();
        this.closeModal();
        this.showToast('Reservation deleted successfully');
      } else {
        throw new Error('Deletion error');
      }
    } catch (error) {
      console.error('Deletion error:', error);
      this.showToast('Deletion error', 'error');
    }
  }

  toggleEditMode() {
    const details = document.getElementById('reservation-details');
    const editBtn = document.getElementById('edit-reservation-btn');
    const deleteBtn = document.getElementById('delete-reservation-btn');
    const closeBtn = document.querySelector('.modal-close');

    if (details.classList.contains('edit-mode')) {
      // Save changes
      this.saveReservationChanges();
    } else {
      // Enter edit mode
      const id = editBtn.dataset.id;
      const reservation = this.reservations.find(r => r.id === parseInt(id));
      if (!reservation) return;

      details.innerHTML = `
        <form id="edit-reservation-form">
          <div class="form-group">
            <label for="edit-name">Name:</label>
            <input type="text" id="edit-name" name="name" value="${this.escapeHtml(reservation.name)}" required>
          </div>
          <div class="form-group">
            <label for="edit-email">Email:</label>
            <input type="email" id="edit-email" name="email" value="${this.escapeHtml(reservation.email)}" required>
          </div>
          <div class="form-group">
            <label for="edit-phone">Phone:</label>
            <input type="tel" id="edit-phone" name="phone" value="${this.escapeHtml(reservation.phone || '')}">
          </div>
          <div class="form-group">
            <label for="edit-date">Date:</label>
            <input type="date" id="edit-date" name="date" value="${reservation.date}" required>
          </div>
          <div class="form-group">
            <label for="edit-time">Time:</label>
            <input type="time" id="edit-time" name="time" value="${reservation.time}" required>
          </div>
          <div class="form-group">
            <label for="edit-guests">Number of guests:</label>
            <input type="number" id="edit-guests" name="guests" min="1" max="20" value="${reservation.guests}" required>
          </div>
          <div class="form-group">
            <label for="edit-message">Message:</label>
            <textarea id="edit-message" name="message" rows="3">${this.escapeHtml(reservation.message || '')}</textarea>
          </div>
        </form>
      `;

      details.classList.add('edit-mode');
      editBtn.textContent = 'Save';
      deleteBtn.style.display = 'none';
      closeBtn.style.display = 'none';
    }
  }

  async saveReservationChanges() {
    const form = document.getElementById('edit-reservation-form');
    if (!form) return;

    const formData = new FormData(form);
    const id = document.getElementById('edit-reservation-btn').dataset.id;
    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      date: formData.get('date'),
      time: formData.get('time'),
      guests: parseInt(formData.get('guests')),
      message: formData.get('message')
    };

    try {
      const response = await fetch(`/api/reservations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + this.authToken
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        // Update local data
        const index = this.reservations.findIndex(r => r.id === parseInt(id));
        if (index !== -1) {
          this.reservations[index] = { ...this.reservations[index], ...payload };
        }

        this.renderReservations();
        this.loadStats();
        this.showReservationDetails(parseInt(id)); // Refresh details view
        this.showToast('Reservation updated successfully');
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Update error');
      }
    } catch (error) {
      console.error('Update error:', error);
      this.showToast('Update error', 'error');
    }
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const messageEl = document.getElementById('toast-message');

    toast.className = `toast ${type}`;
    messageEl.textContent = message;
    toast.style.display = 'block';

    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000);
  }
}

// Initialize the app
const mobileAdmin = new MobileAdmin();

// PWA Installation
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Show install button if desired
  const installBtn = document.createElement('button');
  installBtn.textContent = 'Install app';
  installBtn.className = 'btn btn-primary';
  installBtn.style.position = 'fixed';
  installBtn.style.bottom = '20px';
  installBtn.style.right = '20px';
  installBtn.style.zIndex = '1000';

  installBtn.addEventListener('click', () => {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      deferredPrompt = null;
      installBtn.remove();
    });
  });

  document.body.appendChild(installBtn);
});
