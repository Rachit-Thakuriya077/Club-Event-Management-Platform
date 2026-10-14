SRMIST – Campus Event Management Platform

**Live demo:** _https://club-event-management-platform.vercel.app/_
---

## 📌 Executive Summary & Architecture

This project is a full-stack **Campus Event Management Platform** developed for the SRM Institute of Science and Technology (SRMIST) student community. It empowers students to discover campus events, view real-time capacities, register with atomic capacity constraints, manage E-Tickets with verified QR codes, and provides event organizers with an administrative control suite including entry check-in, participant rosters, CSV exports, and analytics.

### System Architecture
```
                           ┌────────────────────────────────────────┐
                           │      Single Page Application (SPA)     │
                           │  - Modern Glassmorphism Responsive UI │
                           │  - Dynamic Category & Date Filtering   │
                           │  - Canvas QR Code E-Ticket Passes      │
                           │  - Interactive Monthly Campus Calendar │
                           └──────────────────┬─────────────────────┘
                                              │ HTTP / JSON REST APIs
                                              ▼
                           ┌────────────────────────────────────────┐
                           │       FastAPI Backend Service          │
                           │  - JWT Bearer Authentication           │
                           │  - Role-Based Access (Student / Admin) │
                           │  - Atomic Registration & Race Safety   │
                           │  - Entry Desk Check-in Scanner API     │
                           └──────────────────┬─────────────────────┘
                                              │ Relational Queries & WAL
                                              ▼
                           ┌────────────────────────────────────────┐
                           │      SQLite Relational Database        │
                           │  - users (students & organizers)       │
                           │  - events (capacities, dates, venues)  │
                           │  - registrations (UNIQUE tickets & QR) │
                           │  - notifications (in-app alerts)       │
                           └────────────────────────────────────────┘
```

---

## 🚀 Key Features

### 1. User-Facing Frontend
- **Responsive Home & Hero Section:** Highlights upcoming and flagship events with live metric counters (Total Events, Active Students, 6 Specialized Tracks).
- **Event Catalog & Instant Filtering:**
  - Real-time keyword search across title, venue, organizer, and description.
  - Category filter pills: *Technical, Workshops, Cultural, Gaming, Sports, Seminars*.
  - Date filtering: *All, Upcoming, Today, Past*.
  - Sort by: *Date Soonest, Most Popular, Remaining Seats*.
- **Detailed Event Cards & Modal:**
  - Live capacity progress bar (`current / max_capacity`).
  - Status badges (*Registration Open, Filling Fast (<20% left), Sold Out, Cancelled*).
  - Venue, organizer contact, time schedule, and rich description.
- **Registration Flow with Immediate Feedback:**
  - One-click seat reservation for authenticated students.
  - Prevents duplicate registration with explicit conflict feedback (`409 Conflict`).
  - Enforces strict capacity limits (`400 Bad Request` when full).
  - Generates downloadable/printable **Digital Boarding Pass E-Ticket** with dynamic QR code!
- **Interactive Campus Calendar:** Visual monthly calendar showing all events plotted on their respective dates.
- **Student Dashboard ("My Tickets"):**
  - View all registered events, seat statuses, and admittance badges.
  - Instant access to E-Ticket modal.
  - Ability to cancel a registration, which atomically frees up the seat capacity for other students.

### 2. Admin & Organizer Features (Bonus Differentiators)
- **Role-Based Access Control:** Secure JWT tokens differentiating student privileges from organizer/admin actions.
- **Organizer Dashboard:** Real-time KPI summary cards (Total Events, Active Registrations, Checked-In Attendees, Average Fill Rate %).
- **Event Operations (CRUD):**
  - Create new events with title, category, date, venue, capacity, banner image, and organizer details.
  - Edit existing events (capacity changes validate against existing registrations).
  - Change event lifecycle (*Open, Completed, Cancelled*). Cancelled events automatically trigger notifications to registered attendees.
  - Delete events with cascading clean-up.
- **Participant Rosters & CSV Export:**
  - View all registered students per event with registration numbers and departments.
  - One-click **Download CSV Roster** button for offline event operations.
- **Entry Check-In Desk:**
  - Scan or enter Ticket ID (e.g., `ACM-2026-HK81A`).
  - Verifies ticket authenticity, checks attendance, records timestamp, and warns on duplicate entry attempts.
- **Registration Analytics:** Visual breakdown of registrations across categories and top flagship events.

---



## 🛠️ Technology Stack

- **Backend:** Python 3.12+ / 3.14, FastAPI, Uvicorn, Pydantic, Python-JOSE (JWT), PBKDF2-SHA256 password security.
- **Database:** SQLite3 in WAL mode with relational constraints (`UNIQUE(event_id, user_id)`).
- **Frontend:** HTML5, Modern CSS3 (Glassmorphism, CSS Grid, Flexbox, Micro-animations), Vanilla ES6+ JavaScript.
- **Testing:** Integration test suite (`test_api.py`) verifying all 10 core constraints.

---



## 📂 Project Directory Structure

```
campus-event-platform/
├── database.py       # SQLite connection, WAL mode, relational schema
├── auth.py           # Salted password hashing (PBKDF2) & JWT token handlers
├── models.py         # Pydantic validation schemas
├── seed_data.py      # Pre-seeded SRMIST events, students, and admin users
├── main.py           # FastAPI application, REST endpoints, static mounting
├── test_api.py       # Automated integration test suite
├── static/
│   ├── css/
│   │   └── style.css # Design system, glassmorphism, responsive cards, E-ticket
│   ├── js/
│   │   ├── api.js    # API service client with auth token headers
│   │   ├── app.js    # SPA controller, event filtering, modals, calendar, dashboard
│   │   └── qrcode.js # Zero-dependency canvas QR code generator
│   └── index.html    # Single Page Application entrypoint
└── README.md         # Documentation & guide
```
