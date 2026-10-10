/**
 * ACM SRMIST Campus Event Management Platform
 * Frontend Application Controller
 */

// Application State
const state = {
  currentUser: null,
  events: [],
  categories: [],
  activeTab: 'explore', // explore, calendar, dashboard, admin
  filters: {
    search: '',
    category: 'all',
    date: 'all',
    status: 'all',
    sortBy: 'date_asc',
    page: 1
  },
  selectedEvent: null,
  myRegistrations: [],
  adminOverview: null,
  adminAnalytics: null,
  notifications: []
};

// Toast notification helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '✓';
  if (type === 'error') icon = '✕';
  if (type === 'warning') icon = '⚠';

  toast.innerHTML = `
    <span style="font-weight: bold; font-size: 1.1rem;">${icon}</span>
    <div>${message}</div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Formatters
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCategoryClass(category) {
  const cat = (category || '').toLowerCase();
  if (cat.includes('tech')) return 'tag-technical';
  if (cat.includes('work')) return 'tag-workshop';
  if (cat.includes('cult')) return 'tag-cultural';
  if (cat.includes('game')) return 'tag-gaming';
  if (cat.includes('sport')) return 'tag-sports';
  if (cat.includes('sem')) return 'tag-seminar';
  return 'tag-technical';
}

// Main Controller
document.addEventListener('DOMContentLoaded', async () => {
  initAuth();
  await loadCategories();
  await loadEvents();
  setupEventListeners();
  renderCalendar();
});

// Authentication Success Flow
function onAuthSuccess() {
  updateAuthUI();
  loadNotifications();
  if (state.currentUser && state.currentUser.role === 'admin') {
    switchTab('admin');
  } else {
    switchTab('dashboard');
  }
}

// Auth Initialization
function initAuth() {
  state.currentUser = API.getCurrentUser();
  updateAuthUI();
  if (state.currentUser) {
    fetchProfile();
    loadNotifications();
    if (state.currentUser.role === 'admin') {
      switchTab('admin');
    } else {
      switchTab('dashboard');
    }
  }
}

async function fetchProfile() {
  try {
    const user = await API.getMe();
    state.currentUser = user;
    API.setCurrentUser(user);
    updateAuthUI();
  } catch (err) {
    if (err.status === 401) {
      logout();
    }
  }
}

function updateAuthUI() {
  const user = state.currentUser;
  const gatewayEl = document.getElementById('login-gateway');
  const appLayoutEl = document.getElementById('app-layout');
  const userSection = document.getElementById('user-section');
  const navItemAdmin = document.getElementById('nav-item-admin');
  const navItemDashboard = document.getElementById('nav-item-dashboard');
  const roleSubtitle = document.getElementById('navbar-role-subtitle');

  if (user) {
    // Hide pre-login Gateway, show Main App Layout
    if (gatewayEl) gatewayEl.style.display = 'none';
    if (appLayoutEl) appLayoutEl.style.display = 'block';

    // Populate user profile info in navbar (DO NOT show login buttons!)
    if (userSection) {
      userSection.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="text-align: right; line-height: 1.25;">
            <div style="font-weight: 700; font-size: 0.88rem; color: #fff;">${user.name}</div>
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.35rem; margin-top: 0.15rem;">
              ${user.role === 'admin' 
                ? '<span class="badge-tag" style="background:#8b5cf633; color:#c4b5fd; border-color:rgba(139,92,246,0.5);">🛡️ Executive Host</span>' 
                : '<span class="badge-tag" style="background:#3b82f622; color:#93c5fd; border-color:rgba(59,130,246,0.3);">🎓 Student</span>'}
            </div>
          </div>
          <button id="btn-logout" class="icon-btn" title="Sign Out / Exit Portal" style="color: #f87171; border-color: rgba(239,68,68,0.25); background: rgba(239,68,68,0.08);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      `;
      const logoutBtn = document.getElementById('btn-logout');
      if (logoutBtn) logoutBtn.addEventListener('click', logout);
    }

    // Role-specific Navigation Bar Adjustments
    if (user.role === 'admin') {
      if (navItemAdmin) navItemAdmin.style.display = 'block';
      if (navItemDashboard) navItemDashboard.style.display = 'none';
      if (roleSubtitle) roleSubtitle.textContent = 'Executive Console';
    } else {
      if (navItemDashboard) navItemDashboard.style.display = 'block';
      if (navItemAdmin) navItemAdmin.style.display = 'none';
      if (roleSubtitle) roleSubtitle.textContent = 'Student Portal';

      // Update Student Dashboard Header Card
      const welcomeName = document.getElementById('student-welcome-name');
      if (welcomeName) welcomeName.textContent = `Welcome back, ${user.name}! 🎓`;
      const badgeReg = document.getElementById('student-badge-regno');
      if (badgeReg) badgeReg.textContent = `Reg No: ${user.reg_no || 'RA2211003010156'}`;
      const badgeDept = document.getElementById('student-badge-dept');
      if (badgeDept) badgeDept.textContent = `Dept: ${user.department || 'SRMIST Student'}`;
      const badgeTickets = document.getElementById('student-badge-tickets');
      if (badgeTickets) badgeTickets.textContent = `${user.active_registrations_count || 0} Confirmed Passes`;
    }
  } else {
    // Unauthenticated: Show pre-login Gateway, hide Main App
    if (gatewayEl) gatewayEl.style.display = 'flex';
    if (appLayoutEl) appLayoutEl.style.display = 'none';
    if (userSection) userSection.innerHTML = '';
  }
}

function logout() {
  API.setToken(null);
  API.setCurrentUser(null);
  state.currentUser = null;
  updateAuthUI();
  showToast('Signed out of campus portal.', 'success');
}

// Load Categories
async function loadCategories() {
  try {
    const cats = await API.getCategories();
    state.categories = cats;
    renderCategoryChips();
  } catch (err) {
    console.error('Failed to load categories', err);
  }
}

function renderCategoryChips() {
  const container = document.getElementById('category-chips');
  if (!container) return;

  let html = `
    <button class="chip-btn ${state.filters.category === 'all' ? 'active' : ''}" data-cat="all">
      All Categories
    </button>
  `;

  state.categories.forEach(c => {
    const active = state.filters.category === c.category ? 'active' : '';
    html += `
      <button class="chip-btn ${active}" data-cat="${c.category}">
        ${c.category} <span style="font-size:0.75rem; opacity:0.8;">(${c.count})</span>
      </button>
    `;
  });

  container.innerHTML = html;
  container.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filters.category = btn.getAttribute('data-cat');
      container.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadEvents();
    });
  });
}

// Load Events
async function loadEvents() {
  const grid = document.getElementById('events-grid');
  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #94a3b8;">
      <div style="display: inline-block; width: 30px; height: 30px; border: 3px solid #3b82f6; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      <p style="margin-top: 0.8rem;">Loading campus events...</p>
    </div>
  `;

  try {
    const res = await API.getEvents({
      search: state.filters.search,
      category: state.filters.category,
      date_filter: state.filters.date,
      status_filter: state.filters.status,
      sort_by: state.filters.sortBy,
      page: state.filters.page,
      limit: 15
    });

    state.events = res.items;
    renderEvents(state.events);
    updateStatsCounters(state.events);
  } catch (err) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <h3>Failed to load events</h3>
        <p>${err.message}</p>
        <button class="btn-primary" style="margin-top: 1rem;" onclick="loadEvents()">Try Again</button>
      </div>
    `;
  }
}

function updateStatsCounters(events) {
  const totalCounter = document.getElementById('counter-events');
  if (totalCounter) totalCounter.textContent = `${events.length}+`;
}

function renderEvents(events) {
  const grid = document.getElementById('events-grid');
  if (!events || events.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <h3>No events found</h3>
        <p>Try clearing your search query or selecting a different category filter.</p>
        <button class="btn-outline" style="margin-top: 1rem;" onclick="resetFilters()">Reset Filters</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = events.map(event => {
    const isFull = event.current_registrations >= event.max_capacity;
    const remaining = Math.max(0, event.max_capacity - event.current_registrations);
    const fillPercent = Math.min(100, Math.round((event.current_registrations / event.max_capacity) * 100));

    let statusPill = `<span class="status-pill status-open">Open</span>`;
    if (event.status === 'cancelled') {
      statusPill = `<span class="status-pill status-cancelled">Cancelled</span>`;
    } else if (isFull) {
      statusPill = `<span class="status-pill status-full">Sold Out</span>`;
    } else if (fillPercent >= 80) {
      statusPill = `<span class="status-pill status-fast">Filling Fast</span>`;
    }

    const isRegistered = event.is_user_registered;

    return `
      <div class="event-card">
        <div class="card-banner">
          <img src="${event.banner_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80'}" alt="${event.title}" loading="lazy" />
          <div class="card-overlay-badges">
            <span class="category-tag ${getCategoryClass(event.category)}">${event.category}</span>
            ${statusPill}
          </div>
        </div>
        <div class="card-body">
          <h3 class="card-title">${event.title}</h3>
          
          <div class="card-meta">
            <div class="meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>${formatDate(event.date)} &bull; ${event.time}</span>
            </div>
            <div class="meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span title="${event.venue}">${event.venue}</span>
            </div>
          </div>

          <p class="card-desc">${event.description}</p>

          <div class="capacity-box">
            <div class="capacity-labels">
              <span>Capacity: ${event.current_registrations} / ${event.max_capacity}</span>
              <span><strong>${remaining}</strong> seats left</span>
            </div>
            <div class="capacity-bar">
              <div class="capacity-progress ${fillPercent >= 85 ? 'danger' : ''}" style="width: ${fillPercent}%;"></div>
            </div>
          </div>

          <div class="card-actions">
            <button class="btn-outline btn-card-details" onclick="openEventDetails(${event.id})">
              Details
            </button>
            ${isRegistered ? `
              <button class="btn-success btn-card-register" onclick="openTicketModal('${event.user_ticket_id}')">
                ✓ Registered
              </button>
            ` : event.status === 'cancelled' ? `
              <button class="btn-outline btn-card-register" disabled style="opacity: 0.5;">
                Cancelled
              </button>
            ` : isFull ? `
              <button class="btn-outline btn-card-register" disabled style="color: #fb7185; border-color: rgba(244,63,94,0.3);">
                Event Full
              </button>
            ` : `
              <button class="btn-primary btn-card-register" onclick="handleQuickRegister(${event.id})">
                Register Now
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function resetFilters() {
  state.filters.search = '';
  state.filters.category = 'all';
  state.filters.date = 'all';
  state.filters.status = 'all';
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  renderCategoryChips();
  loadEvents();
}

// Event Details Modal
async function openEventDetails(eventId) {
  try {
    const event = await API.getEventDetail(eventId);
    state.selectedEvent = event;
    const modal = document.getElementById('event-detail-modal');
    const content = document.getElementById('event-detail-content');

    const isFull = event.current_registrations >= event.max_capacity;
    const remaining = Math.max(0, event.max_capacity - event.current_registrations);
    const fillPercent = Math.min(100, Math.round((event.current_registrations / event.max_capacity) * 100));

    content.innerHTML = `
      <div style="margin: -1.75rem -1.75rem 1.5rem -1.75rem; height: 220px; overflow: hidden; position: relative;">
        <img src="${event.banner_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80'}" style="width: 100%; height: 100%; object-fit: cover;" />
        <div style="position: absolute; bottom: 1rem; left: 1.5rem; display: flex; gap: 0.5rem;">
          <span class="category-tag ${getCategoryClass(event.category)}">${event.category}</span>
          <span class="status-pill status-${event.status === 'open' ? (isFull ? 'full' : 'open') : 'cancelled'}">
            ${event.status === 'open' ? (isFull ? 'Sold Out' : 'Registration Open') : event.status}
          </span>
        </div>
      </div>

      <h2 style="font-family: var(--font-heading); font-size: 1.5rem; margin-bottom: 0.8rem; line-height: 1.25;">
        ${event.title}
      </h2>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: rgba(30,41,59,0.3); border: 1px solid var(--border-subtle); padding: 1rem; border-radius: var(--radius-sm); margin-bottom: 1.25rem;">
        <div>
          <div style="font-size: 0.72rem; color: #94a3b8; text-transform: uppercase;">Date & Time</div>
          <div style="font-size: 0.92rem; font-weight: 600; color: #fff;">${formatDate(event.date)}</div>
          <div style="font-size: 0.82rem; color: #cbd5e1;">${event.time}</div>
        </div>
        <div>
          <div style="font-size: 0.72rem; color: #94a3b8; text-transform: uppercase;">Venue</div>
          <div style="font-size: 0.92rem; font-weight: 600; color: #fff;">${event.venue}</div>
          <div style="font-size: 0.82rem; color: #93c5fd;">SRMIST Kattankulathur</div>
        </div>
      </div>

      <div style="margin-bottom: 1.25rem;">
        <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 0.4rem;">About This Event</h4>
        <p style="font-size: 0.9rem; color: #cbd5e1; line-height: 1.6; white-space: pre-line;">${event.description}</p>
      </div>

      <div style="background: rgba(15, 23, 42, 0.4); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.84rem; margin-bottom: 0.4rem;">
          <span>Attendee Seats: <strong>${event.current_registrations}</strong> / ${event.max_capacity}</span>
          <span style="color: ${remaining <= 5 ? '#f59e0b' : '#34d399'}; font-weight: 600;">
            ${remaining} spots remaining
          </span>
        </div>
        <div class="capacity-bar" style="height: 8px;">
          <div class="capacity-progress ${fillPercent >= 85 ? 'danger' : ''}" style="width: ${fillPercent}%;"></div>
        </div>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--border-subtle); padding-top: 1.25rem;">
        <div>
          <div style="font-size: 0.72rem; color: #94a3b8; text-transform: uppercase;">Organized by</div>
          <div style="font-size: 0.88rem; font-weight: 600;">${event.organizer_name}</div>
          <div style="font-size: 0.78rem; color: #60a5fa;">${event.organizer_email}</div>
        </div>

        <div id="modal-action-btn">
          ${event.is_user_registered ? `
            <button class="btn-success" onclick="openTicketModal('${event.user_ticket_id}')">
              View My E-Ticket
            </button>
          ` : event.status !== 'open' ? `
            <button class="btn-outline" disabled>Event Closed</button>
          ` : isFull ? `
            <button class="btn-outline" disabled style="color: #fb7185;">Capacity Reached</button>
          ` : `
            <button class="btn-primary" onclick="handleQuickRegister(${event.id})">
              Confirm Registration
            </button>
          `}
        </div>
      </div>
    `;

    modal.classList.add('active');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Registration Handler
async function handleQuickRegister(eventId) {
  if (!state.currentUser) {
    showToast('Please sign in with your student profile to register for events.', 'warning');
    openStudentAuthModal();
    return;
  }

  try {
    const res = await API.registerForEvent(eventId);
    showToast(res.message || 'Registration confirmed!', 'success');
    closeModal('event-detail-modal');
    await loadEvents();
    if (res.registration && res.registration.ticket_id) {
      openTicketModal(res.registration.ticket_id);
    }
  } catch (err) {
    if (err.status === 409) {
      showToast(err.message || 'You are already registered for this event.', 'warning');
    } else {
      showToast(err.message || 'Could not complete registration.', 'error');
    }
  }
}

// E-Ticket Boarding Pass Modal
async function openTicketModal(ticketId) {
  try {
    const ticket = await API.getTicket(ticketId);
    const modal = document.getElementById('ticket-modal');
    const container = document.getElementById('ticket-card-render');

    container.innerHTML = `
      <div class="ticket-wrapper">
        <div class="ticket-header">
          <div>
            <div class="ticket-acm-badge">ACM SRMIST &bull; Official Campus Pass</div>
            <div style="font-size: 0.78rem; color: #cbd5e1;">SRM Institute of Science and Technology</div>
          </div>
          <div class="ticket-id-tag">#${ticket.ticket_id}</div>
        </div>

        <div class="ticket-main">
          <div class="ticket-details">
            <h4>${ticket.event_title}</h4>

            <div class="ticket-meta-grid">
              <div>
                <div class="ticket-meta-label">Attendee Name</div>
                <div class="ticket-meta-value">${ticket.attendee_name}</div>
              </div>
              <div>
                <div class="ticket-meta-label">Registration No.</div>
                <div class="ticket-meta-value">${ticket.attendee_reg_no || 'N/A'}</div>
              </div>
              <div>
                <div class="ticket-meta-label">Date & Time</div>
                <div class="ticket-meta-value">${formatDate(ticket.event_date)} | ${ticket.event_time}</div>
              </div>
              <div>
                <div class="ticket-meta-label">Assigned Venue</div>
                <div class="ticket-meta-value">${ticket.event_venue}</div>
              </div>
              <div>
                <div class="ticket-meta-label">Department</div>
                <div class="ticket-meta-value">${ticket.attendee_dept || 'Student'}</div>
              </div>
              <div>
                <div class="ticket-meta-label">Check-In Status</div>
                <div class="ticket-meta-value" style="color: ${ticket.checked_in ? '#34d399' : '#fbbf24'};">
                  ${ticket.checked_in ? '✓ Verified / Admitted' : 'Pending Entry Scan'}
                </div>
              </div>
            </div>
          </div>

          <div class="ticket-qr-container">
            <canvas id="ticket-qr-canvas"></canvas>
            <div class="ticket-qr-note">Scan at Desk</div>
          </div>
        </div>

        <div style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; color: #94a3b8;">
          <div>Organized by: <strong style="color: #e2e8f0;">${ticket.organizer_name}</strong></div>
          <div>Issued: ${formatDate(ticket.registered_at)}</div>
        </div>
      </div>
    `;

    // Render Canvas QR Code
    setTimeout(() => {
      const canvas = document.getElementById('ticket-qr-canvas');
      if (canvas && window.CampusQR) {
        window.CampusQR.render(canvas, `ACM-TICKET:${ticket.ticket_id}|EVENT:${ticket.event_id}`, { size: 140 });
      }
    }, 50);

    modal.classList.add('active');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// User Dashboard ("My Registrations")
async function loadMyDashboard() {
  if (!state.currentUser) {
    return;
  }

  const user = state.currentUser;
  const welcomeName = document.getElementById('student-welcome-name');
  if (welcomeName) welcomeName.textContent = `Welcome back, ${user.name}! 🎓`;
  const badgeReg = document.getElementById('student-badge-regno');
  if (badgeReg) badgeReg.textContent = `Reg No: ${user.reg_no || 'RA2211003010156'}`;
  const badgeDept = document.getElementById('student-badge-dept');
  if (badgeDept) badgeDept.textContent = `Dept: ${user.department || 'SRMIST Student'}`;

  const container = document.getElementById('my-registrations-list');
  container.innerHTML = `<div style="text-align: center; padding: 2rem; color: #94a3b8;">Loading your tickets...</div>`;

  try {
    const list = await API.getMyRegistrations();
    state.myRegistrations = list;

    const badgeTickets = document.getElementById('student-badge-tickets');
    if (badgeTickets) {
      const confirmedCount = list.filter(r => r.registration_status === 'confirmed').length;
      badgeTickets.textContent = `${confirmedCount} Confirmed Passes`;
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <h3>No event registrations yet</h3>
          <p>Discover exciting campus hackathons, workshops, and fests to reserve your tickets.</p>
          <button class="btn-primary" style="margin-top: 1rem;" onclick="switchTab('explore')">Explore Events</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="registrations-table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Event Title</th>
              <th>Date & Venue</th>
              <th>Status</th>
              <th>Check-In</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(r => `
              <tr>
                <td>
                  <span style="font-family: monospace; font-weight: 700; color: #60a5fa;">#${r.ticket_id}</span>
                </td>
                <td>
                  <strong>${r.title}</strong>
                  <div style="font-size: 0.76rem; color: #94a3b8;">${r.category} &bull; ${r.organizer_name}</div>
                </td>
                <td>
                  <div>${formatDate(r.date)} &bull; ${r.time}</div>
                  <div style="font-size: 0.78rem; color: #94a3b8;">${r.venue}</div>
                </td>
                <td>
                  <span class="status-pill status-${r.registration_status === 'confirmed' ? 'open' : 'cancelled'}">
                    ${r.registration_status}
                  </span>
                </td>
                <td>
                  <span style="font-size: 0.82rem; font-weight: 600; color: ${r.checked_in ? '#34d399' : '#94a3b8'};">
                    ${r.checked_in ? '✓ Attended' : 'Pending'}
                  </span>
                </td>
                <td>
                  <div style="display: flex; gap: 0.5rem;">
                    ${r.registration_status === 'confirmed' ? `
                      <button class="btn-primary" style="padding: 0.35rem 0.75rem; font-size: 0.78rem;" onclick="openTicketModal('${r.ticket_id}')">
                        E-Ticket
                      </button>
                      <button class="btn-danger" style="padding: 0.35rem 0.75rem; font-size: 0.78rem;" onclick="confirmCancelRegistration(${r.registration_id}, '${r.title.replace(/'/g, "\\'")}')">
                        Cancel
                      </button>
                    ` : `
                      <span style="font-size: 0.8rem; color: #64748b;">Released</span>
                    `}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h3>Error loading registrations</h3><p>${err.message}</p></div>`;
  }
}

// Cancel Registration Flow
async function confirmCancelRegistration(regId, title) {
  if (!confirm(`Are you sure you want to cancel your registration for "${title}"?\n\nThis will free up your reserved seat for other SRM students.`)) {
    return;
  }

  try {
    const res = await API.cancelRegistration(regId);
    showToast(res.message || 'Registration cancelled.', 'success');
    await loadMyDashboard();
    await loadEvents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Calendar View
function renderCalendar(targetMonthOffset = 0) {
  const container = document.getElementById('calendar-container');
  if (!container) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // Current month (October)

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // Sunday = 0

  let gridHtml = `
    <div class="calendar-day-header">Sun</div>
    <div class="calendar-day-header">Mon</div>
    <div class="calendar-day-header">Tue</div>
    <div class="calendar-day-header">Wed</div>
    <div class="calendar-day-header">Thu</div>
    <div class="calendar-day-header">Fri</div>
    <div class="calendar-day-header">Sat</div>
  `;

  // Previous month trailing days
  for (let i = 0; i < firstDayIndex; i++) {
    gridHtml += `<div class="calendar-cell other-month"></div>`;
  }

  // Days in current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayEvents = state.events.filter(e => e.date === dayStr);

    gridHtml += `
      <div class="calendar-cell ${dayEvents.length > 0 ? 'has-events' : ''}">
        <span class="calendar-date-number">${d}</span>
        ${dayEvents.map(e => `
          <div class="calendar-event-tag" title="${e.title} (${e.time})" onclick="openEventDetails(${e.id})">
            ${e.title}
          </div>
        `).join('')}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="calendar-header">
      <h3 style="font-family: var(--font-heading); font-size: 1.25rem;">
        ${monthNames[month]} ${year} &bull; Campus Schedule
      </h3>
      <div style="font-size: 0.84rem; color: #94a3b8;">
        Click any event pill to view details & reserve a seat
      </div>
    </div>
    <div class="calendar-grid">
      ${gridHtml}
    </div>
  `;
}

// Admin Console
async function loadAdminConsole() {
  if (!state.currentUser || state.currentUser.role !== 'admin') {
    document.getElementById('admin-content').innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <h3>Executive Permissions Required</h3>
        <p>You are currently signed in as a student or guest. Please authenticate via the Organizer Login Portal to manage campus events.</p>
        <div style="display: flex; justify-content: center; gap: 0.75rem; margin-top: 1.25rem;">
          <button class="btn-primary" onclick="openAdminAuthModal()">
            🛡️ Open Organizer Login Portal
          </button>
          <button class="btn-outline" onclick="quickDemoLogin('admin')">
            ⚡ 1-Click Switch to Demo Admin
          </button>
        </div>
      </div>
    `;
    return;
  }

  const content = document.getElementById('admin-content');
  content.innerHTML = `<div style="text-align: center; padding: 3rem; color: #94a3b8;">Loading management metrics...</div>`;

  try {
    const overview = await API.getAdminOverview();
    const analytics = await API.getAdminAnalytics();
    state.adminOverview = overview;
    state.adminAnalytics = analytics;

    content.innerHTML = `
      <!-- Admin Top Metrics -->
      <div class="stats-bar" style="margin-top: 0.5rem; margin-bottom: 2rem;">
        <div class="stat-card">
          <div class="stat-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
          <div class="stat-info">
            <h3>${overview.total_events}</h3>
            <p>Total Campus Events</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="color: #34d399; background: rgba(16, 185, 129, 0.15);"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
          <div class="stat-info">
            <h3>${overview.total_registrations}</h3>
            <p>Active Registrations</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="color: #60a5fa; background: rgba(59, 130, 246, 0.15);"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
          <div class="stat-info">
            <h3>${overview.total_checked_in}</h3>
            <p>Checked-In Attendees</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="color: #fbbf24; background: rgba(245, 158, 11, 0.15);"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <div class="stat-info">
            <h3>${overview.capacity_fill_pct}%</h3>
            <p>Average Capacity Fill</p>
          </div>
        </div>
      </div>

      <!-- Action Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <h3 style="font-family: var(--font-heading); font-size: 1.3rem;">Event Operations & Rosters</h3>
        <div style="display: flex; gap: 0.75rem;">
          <button class="btn-outline" onclick="openCheckInModal()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h3"/><path d="M20 7V4h-3"/><path d="M4 17v3h3"/><path d="M20 17v3h-3"/><rect x="7" y="7" width="10" height="10"/></svg>
            Entry Check-In Desk
          </button>
          <button class="btn-primary" onclick="openCreateEventModal()">
            + Create New Event
          </button>
        </div>
      </div>

      <!-- Events Management Table -->
      <div class="registrations-table-card">
        <table class="data-table">
          <thead>
            <tr>
              <th>Event Title</th>
              <th>Category</th>
              <th>Date & Venue</th>
              <th>Capacity</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${state.events.map(ev => `
              <tr>
                <td>
                  <strong>${ev.title}</strong>
                  <div style="font-size: 0.75rem; color: #94a3b8;">${ev.organizer_name}</div>
                </td>
                <td><span class="category-tag ${getCategoryClass(ev.category)}">${ev.category}</span></td>
                <td>
                  <div>${formatDate(ev.date)} &bull; ${ev.time}</div>
                  <div style="font-size: 0.78rem; color: #94a3b8;">${ev.venue}</div>
                </td>
                <td>
                  <strong>${ev.current_registrations}</strong> / ${ev.max_capacity}
                  <div style="font-size: 0.72rem; color: #94a3b8;">${Math.round((ev.current_registrations/ev.max_capacity)*100)}% filled</div>
                </td>
                <td>
                  <select onchange="updateEventStatus(${ev.id}, this.value)" style="background: rgba(30,41,59,0.8); color: #fff; border: 1px solid var(--border-subtle); border-radius: 4px; padding: 0.25rem 0.5rem; font-size: 0.78rem;">
                    <option value="open" ${ev.status === 'open' ? 'selected' : ''}>Open</option>
                    <option value="completed" ${ev.status === 'completed' ? 'selected' : ''}>Completed</option>
                    <option value="cancelled" ${ev.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                  </select>
                </td>
                <td>
                  <div style="display: flex; gap: 0.4rem;">
                    <button class="btn-outline" style="padding: 0.35rem 0.65rem; font-size: 0.78rem;" onclick="viewParticipants(${ev.id})">
                      Participants (${ev.current_registrations})
                    </button>
                    <button class="btn-outline" style="padding: 0.35rem 0.65rem; font-size: 0.78rem;" onclick="openEditEventModal(${ev.id})">
                      Edit
                    </button>
                    <button class="btn-danger" style="padding: 0.35rem 0.65rem; font-size: 0.78rem;" onclick="handleDeleteEvent(${ev.id}, '${ev.title.replace(/'/g, "\\'")}')">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Direct Participants Roster Explorer -->
      <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem; margin-top: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 0.75rem;">
          <div>
            <h4 style="font-family: var(--font-heading); font-size: 1.25rem; color: #fff; font-weight: 700;">Participant Rosters & CSV Export</h4>
            <p style="font-size: 0.84rem; color: #94a3b8; margin-top: 0.15rem;">Inspect verified attendees for any campus event and download official CSV rosters.</p>
          </div>
          <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
            <select id="admin-roster-select" class="custom-select" onchange="renderInlineRoster(this.value)">
              ${state.events.map(ev => `<option value="${ev.id}">${ev.title} (${ev.current_registrations} attendees)</option>`).join('')}
            </select>
            <a id="admin-roster-csv-btn" href="/api/admin/events/${state.events[0] ? state.events[0].id : 1}/participants/csv" class="btn-primary" style="padding: 0.45rem 1rem; font-size: 0.82rem; text-decoration: none;" download>
              Download CSV Roster
            </a>
          </div>
        </div>
        <div id="inline-roster-table"></div>
      </div>

      <!-- Analytics Breakdown Cards -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 2.5rem;">
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
          <h4 style="font-family: var(--font-heading); font-size: 1.1rem; margin-bottom: 1rem;">Registrations by Category</h4>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${analytics.categories.map(c => `
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 0.84rem; margin-bottom: 0.25rem;">
                  <span>${c.category}</span>
                  <span style="font-weight: 600;">${c.registrations_count} signups</span>
                </div>
                <div class="capacity-bar" style="height: 6px;">
                  <div class="capacity-progress" style="width: ${Math.min(100, c.registrations_count * 15)}%;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1.5rem;">
          <h4 style="font-family: var(--font-heading); font-size: 1.1rem; margin-bottom: 1rem;">Top Flagship Events</h4>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${analytics.top_events.slice(0, 4).map(te => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 0.6rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div>
                  <div style="font-size: 0.88rem; font-weight: 600;">${te.title}</div>
                  <div style="font-size: 0.75rem; color: #94a3b8;">${te.category} &bull; Cap: ${te.max_capacity}</div>
                </div>
                <span class="badge-tag" style="background: rgba(59,130,246,0.2); color: #60a5fa;">
                  ${te.confirmed_count} Attendees
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Automatically trigger initial roster render
    if (state.events && state.events.length > 0) {
      renderInlineRoster(state.events[0].id);
    }
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><h3>Admin Error</h3><p>${err.message}</p></div>`;
  }
}

async function renderInlineRoster(eventId) {
  const container = document.getElementById('inline-roster-table');
  const csvBtn = document.getElementById('admin-roster-csv-btn');
  if (csvBtn) csvBtn.href = `/api/admin/events/${eventId}/participants/csv`;
  if (!container) return;

  container.innerHTML = `<div style="text-align: center; padding: 1.5rem; color: #94a3b8;">Loading attendees roster...</div>`;

  try {
    const res = await API.getEventParticipants(eventId);
    if (!res.participants || res.participants.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: #94a3b8; background: rgba(0,0,0,0.2); border-radius: var(--radius-sm); margin-top: 0.75rem;">
          No registered attendees yet for "${res.event.title}".
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="margin-top: 0.75rem; overflow-x: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Student Name</th>
              <th>Reg No & Dept</th>
              <th>Registration Date</th>
              <th>Status</th>
              <th>Check-In Status</th>
            </tr>
          </thead>
          <tbody>
            ${res.participants.map(p => `
              <tr>
                <td><span style="font-family: monospace; font-weight: 700; color: #60a5fa;">#${p.ticket_id}</span></td>
                <td>
                  <strong>${p.name}</strong>
                  <div style="font-size: 0.75rem; color: #94a3b8;">${p.email}</div>
                </td>
                <td>
                  <div>${p.reg_no || 'N/A'}</div>
                  <div style="font-size: 0.75rem; color: #94a3b8;">${p.department || 'N/A'}</div>
                </td>
                <td>
                  <span style="font-size: 0.8rem; color: #cbd5e1;">${formatDate(p.registered_at)}</span>
                </td>
                <td><span class="status-pill status-${p.status === 'confirmed' ? 'open' : 'cancelled'}">${p.status}</span></td>
                <td>
                  <span style="color: ${p.checked_in ? '#34d399' : '#fbbf24'}; font-weight: 600; font-size: 0.82rem;">
                    ${p.checked_in ? '✓ Admitted' : 'Pending Scan'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color: #f87171; padding: 1rem;">Failed to load participant roster: ${err.message}</div>`;
  }
}

// Participants Modal & CSV Export
async function viewParticipants(eventId) {
  try {
    const res = await API.getEventParticipants(eventId);
    const modal = document.getElementById('participants-modal');
    const container = document.getElementById('participants-modal-content');

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <h3 style="font-family: var(--font-heading); font-size: 1.3rem;">${res.event.title}</h3>
          <p style="font-size: 0.84rem; color: #94a3b8;">${res.total_participants} confirmed attendee(s) &bull; Venue: ${res.event.venue}</p>
        </div>
        <a href="/api/admin/events/${eventId}/participants/csv" class="btn-primary" style="padding: 0.45rem 1rem; font-size: 0.82rem; text-decoration: none;" download>
          Download CSV Roster
        </a>
      </div>

      <div class="registrations-table-card" style="max-height: 400px; overflow-y: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Student Name</th>
              <th>Reg No / Dept</th>
              <th>Status</th>
              <th>Check-In</th>
            </tr>
          </thead>
          <tbody>
            ${res.participants.length === 0 ? `
              <tr><td colspan="5" style="text-align: center; color: #94a3b8;">No registered attendees yet.</td></tr>
            ` : res.participants.map(p => `
              <tr>
                <td><span style="font-family: monospace; font-weight: 700; color: #60a5fa;">#${p.ticket_id}</span></td>
                <td>
                  <strong>${p.name}</strong>
                  <div style="font-size: 0.75rem; color: #94a3b8;">${p.email}</div>
                </td>
                <td>
                  <div>${p.reg_no || 'N/A'}</div>
                  <div style="font-size: 0.75rem; color: #94a3b8;">${p.department || 'N/A'}</div>
                </td>
                <td><span class="status-pill status-${p.status === 'confirmed' ? 'open' : 'cancelled'}">${p.status}</span></td>
                <td>
                  <span style="color: ${p.checked_in ? '#34d399' : '#fbbf24'}; font-weight: 600; font-size: 0.82rem;">
                    ${p.checked_in ? '✓ Checked In' : 'Not Scanned'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    modal.classList.add('active');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Check-In Desk
function openCheckInModal() {
  const modal = document.getElementById('checkin-modal');
  const input = document.getElementById('checkin-ticket-input');
  const resultBox = document.getElementById('checkin-result-box');
  if (input) input.value = '';
  if (resultBox) resultBox.innerHTML = '';
  modal.classList.add('active');
}

async function handleCheckInSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('checkin-ticket-input');
  const resultBox = document.getElementById('checkin-result-box');
  const ticketId = input.value.trim();

  if (!ticketId) return;

  resultBox.innerHTML = `<div style="text-align: center; color: #94a3b8;">Verifying ticket #${ticketId}...</div>`;

  try {
    const res = await API.checkInParticipant(ticketId);
    if (res.already_checked_in) {
      resultBox.innerHTML = `
        <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.35); padding: 1rem; border-radius: var(--radius-sm); color: #fbbf24;">
          <strong>⚠ Notice: Already Checked In</strong>
          <p style="font-size: 0.86rem; margin-top: 0.3rem;">${res.message}</p>
        </div>
      `;
    } else {
      resultBox.innerHTML = `
        <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); padding: 1rem; border-radius: var(--radius-sm); color: #34d399;">
          <strong>✓ Entry Verified & Checked In!</strong>
          <div style="font-size: 0.88rem; margin-top: 0.4rem; color: #fff;">Attendee: <strong>${res.attendee.name}</strong> (${res.attendee.reg_no})</div>
          <div style="font-size: 0.8rem; color: #cbd5e1;">Event: ${res.attendee.event_title}</div>
          <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.2rem;">Timestamp: ${res.attendee.checked_in_at}</div>
        </div>
      `;
      showToast('Attendee checked in successfully!', 'success');
      loadAdminConsole();
    }
    input.value = '';
  } catch (err) {
    resultBox.innerHTML = `
      <div style="background: rgba(244, 63, 94, 0.15); border: 1px solid rgba(244, 63, 94, 0.35); padding: 1rem; border-radius: var(--radius-sm); color: #fb7185;">
        <strong>✕ Verification Failed</strong>
        <p style="font-size: 0.86rem; margin-top: 0.3rem;">${err.message}</p>
      </div>
    `;
  }
}

// Event Create / Edit / Delete
function openCreateEventModal() {
  const modal = document.getElementById('event-form-modal');
  document.getElementById('event-form-title').textContent = 'Create New Campus Event';
  document.getElementById('event-form').reset();
  document.getElementById('event-edit-id').value = '';
  modal.classList.add('active');
}

async function openEditEventModal(eventId) {
  try {
    const ev = await API.getEventDetail(eventId);
    const modal = document.getElementById('event-form-modal');
    document.getElementById('event-form-title').textContent = 'Edit Event Details';
    document.getElementById('event-edit-id').value = ev.id;
    document.getElementById('form-title').value = ev.title;
    document.getElementById('form-category').value = ev.category;
    document.getElementById('form-date').value = ev.date;
    document.getElementById('form-time').value = ev.time;
    document.getElementById('form-venue').value = ev.venue;
    document.getElementById('form-capacity').value = ev.max_capacity;
    document.getElementById('form-organizer').value = ev.organizer_name;
    document.getElementById('form-email').value = ev.organizer_email;
    document.getElementById('form-banner').value = ev.banner_url || '';
    document.getElementById('form-description').value = ev.description;
    modal.classList.add('active');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleEventFormSubmit(e) {
  e.preventDefault();
  const editId = document.getElementById('event-edit-id').value;
  const payload = {
    title: document.getElementById('form-title').value.trim(),
    category: document.getElementById('form-category').value,
    date: document.getElementById('form-date').value,
    time: document.getElementById('form-time').value.trim(),
    venue: document.getElementById('form-venue').value.trim(),
    max_capacity: parseInt(document.getElementById('form-capacity').value, 10),
    organizer_name: document.getElementById('form-organizer').value.trim(),
    organizer_email: document.getElementById('form-email').value.trim(),
    banner_url: document.getElementById('form-banner').value.trim() || undefined,
    description: document.getElementById('form-description').value.trim()
  };

  try {
    if (editId) {
      await API.updateEvent(editId, payload);
      showToast('Event updated successfully!', 'success');
    } else {
      await API.createEvent(payload);
      showToast('New event published successfully!', 'success');
    }
    closeModal('event-form-modal');
    await loadEvents();
    if (state.activeTab === 'admin') loadAdminConsole();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function updateEventStatus(eventId, newStatus) {
  try {
    await API.updateEvent(eventId, { status: newStatus });
    showToast(`Event status updated to "${newStatus}".`, 'success');
    await loadEvents();
    if (state.activeTab === 'admin') loadAdminConsole();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeleteEvent(eventId, title) {
  if (!confirm(`Are you sure you want to permanently delete "${title}"?\n\nThis will remove all participant registrations and cannot be undone.`)) {
    return;
  }

  try {
    await API.deleteEvent(eventId);
    showToast('Event removed.', 'success');
    await loadEvents();
    if (state.activeTab === 'admin') loadAdminConsole();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Demo Account Quick Switcher
async function quickDemoLogin(role) {
  const email = role === 'admin' ? 'admin@acm.srmist.edu.in' : 'student@srmist.edu.in';
  const pass = role === 'admin' ? 'admin123' : 'student123';

  try {
    const res = await API.login(email, pass);
    API.setToken(res.access_token);
    API.setCurrentUser(res.user);
    state.currentUser = res.user;
    updateAuthUI();
    closeModal('student-auth-modal');
    closeModal('admin-auth-modal');
    showToast(`Signed in as ${res.user.name} (${res.user.role.toUpperCase()})`, 'success');
    await loadEvents();
    if (role === 'admin') {
      switchTab('admin');
    } else if (state.activeTab === 'dashboard') {
      loadMyDashboard();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Student & Admin Auth Modals
function openStudentAuthModal() {
  closeModal('admin-auth-modal');
  const modal = document.getElementById('student-auth-modal');
  if (modal) modal.classList.add('active');
}

function openAdminAuthModal() {
  closeModal('student-auth-modal');
  const modal = document.getElementById('admin-auth-modal');
  if (modal) modal.classList.add('active');
}

// Fallback compatibility
function openAuthModal() {
  openStudentAuthModal();
}

// Notifications
async function loadNotifications() {
  if (!state.currentUser) return;
  try {
    const notes = await API.getNotifications();
    state.notifications = notes;
    const badge = document.getElementById('notification-badge');
    const unread = notes.filter(n => !n.is_read).length;
    if (badge) {
      if (unread > 0) {
        badge.style.display = 'flex';
        badge.textContent = unread;
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Failed to load notifications', err);
  }
}

function openNotificationDrawer() {
  const drawer = document.getElementById('notification-drawer');
  const list = document.getElementById('notification-list');
  
  if (state.notifications.length === 0) {
    list.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 2rem;">No notifications yet.</div>`;
  } else {
    list.innerHTML = state.notifications.map(n => `
      <div style="padding: 0.9rem; border-bottom: 1px solid var(--border-subtle); background: ${n.is_read ? 'transparent' : 'rgba(59,130,246,0.06)'};">
        <div style="font-weight: 600; font-size: 0.88rem; color: #fff;">${n.title}</div>
        <div style="font-size: 0.82rem; color: #cbd5e1; margin: 0.2rem 0;">${n.message}</div>
        <div style="font-size: 0.72rem; color: #64748b;">${formatDate(n.created_at)}</div>
      </div>
    `).join('');
  }

  drawer.classList.add('active');
  API.markAllNotificationsRead().then(() => {
    state.notifications.forEach(n => n.is_read = 1);
    const badge = document.getElementById('notification-badge');
    if (badge) badge.style.display = 'none';
  });
}

// Tab Switching
function switchTab(tabName) {
  state.activeTab = tabName;
  
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  const targetNav = document.getElementById(`nav-${tabName}`);
  if (targetNav) targetNav.classList.add('active');

  const tabSections = ['explore', 'calendar', 'dashboard', 'admin'];
  tabSections.forEach(t => {
    const sec = document.getElementById(`section-${t}`);
    if (sec) sec.style.display = t === tabName ? 'block' : 'none';
  });

  if (tabName === 'dashboard') {
    loadMyDashboard();
  } else if (tabName === 'admin') {
    loadAdminConsole();
  } else if (tabName === 'calendar') {
    renderCalendar();
  } else if (tabName === 'explore') {
    loadEvents();
  }
}

// Event Listeners Setup
function setupEventListeners() {
  // Navigation tabs
  const navExplore = document.getElementById('nav-explore');
  if (navExplore) navExplore.addEventListener('click', () => switchTab('explore'));
  const navCalendar = document.getElementById('nav-calendar');
  if (navCalendar) navCalendar.addEventListener('click', () => switchTab('calendar'));
  const navDashboard = document.getElementById('nav-dashboard');
  if (navDashboard) navDashboard.addEventListener('click', () => switchTab('dashboard'));
  const navAdmin = document.getElementById('nav-admin-tab');
  if (navAdmin) navAdmin.addEventListener('click', () => {
    if (state.currentUser && state.currentUser.role === 'admin') {
      switchTab('admin');
    }
  });

  // Hero search
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let debounce;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        state.filters.search = e.target.value;
        loadEvents();
      }, 250);
    });
  }

  // Filter dropdowns
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.filters.sortBy = e.target.value;
      loadEvents();
    });
  }

  const dateSelect = document.getElementById('date-select');
  if (dateSelect) {
    dateSelect.addEventListener('change', (e) => {
      state.filters.date = e.target.value;
      loadEvents();
    });
  }

  // Notification button
  const notifBtn = document.getElementById('btn-notifications');
  if (notifBtn) {
    notifBtn.addEventListener('click', openNotificationDrawer);
  }

  // Modal close buttons
  document.querySelectorAll('.modal-close, .btn-modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      if (modal) modal.classList.remove('active');
    });
  });

  // Check-In form
  const checkinForm = document.getElementById('checkin-form');
  if (checkinForm) checkinForm.addEventListener('submit', handleCheckInSubmit);

  // Event create/edit form
  const eventForm = document.getElementById('event-form');
  if (eventForm) eventForm.addEventListener('submit', handleEventFormSubmit);

  // Close modals on clicking overlay backdrop
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  });
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}
