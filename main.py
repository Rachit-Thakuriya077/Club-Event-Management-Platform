import os
import secrets
import string
import csv
import io
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, Query, status, Response
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from database import get_db, init_db
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user_from_token,
    get_optional_user_from_token
)
from models import (
    UserRegister,
    UserLogin,
    UserResponse,
    AuthResponse,
    EventCreate,
    EventUpdate,
    EventResponse,
    RegistrationRequest,
    RegistrationResponse,
    CheckInRequest
)
from seed_data import seed_demo_data

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(STATIC_DIR, exist_ok=True)

# Initialize and seed if fresh
init_db()
seed_demo_data(force=False)

app = FastAPI(
    title="ACM SRMIST Campus Event Management Platform API",
    description="Full-stack campus event discovery, registration, capacity management and organizer dashboard.",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def generate_ticket_id() -> str:
    alphabet = string.ascii_uppercase + string.digits
    suffix = ''.join(secrets.choice(alphabet) for _ in range(5))
    year = datetime.now().year
    return f"ACM-{year}-{suffix}"


# ==========================================
# 1. AUTHENTICATION & PROFILE APIS
# ==========================================

@app.post("/api/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Check if email is already registered
        cursor.execute("SELECT id FROM users WHERE email = ? COLLATE NOCASE;", (user_data.email,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists. Please log in instead."
            )
        
        # Validate role
        role = "admin" if user_data.role and user_data.role.lower() == "admin" else "student"
        
        pwd_hash = hash_password(user_data.password)
        cursor.execute("""
            INSERT INTO users (name, email, password_hash, role, reg_no, department)
            VALUES (?, ?, ?, ?, ?, ?);
        """, (user_data.name, user_data.email, pwd_hash, role, user_data.reg_no, user_data.department))
        
        user_id = cursor.lastrowid
        cursor.execute("SELECT id, name, email, role, reg_no, department, created_at FROM users WHERE id = ?;", (user_id,))
        new_user = dict(cursor.fetchone())

        # Create welcome notification
        cursor.execute("""
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (?, ?, ?, ?);
        """, (
            user_id,
            "Welcome to ACM SRMIST Event Hub!",
            "Explore upcoming technical symposiums, workshops, and fests. Register to reserve your seat.",
            "system"
        ))

    token = create_access_token({"sub": str(user_id), "email": new_user["email"], "role": new_user["role"], "name": new_user["name"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": new_user
    }


@app.post("/api/auth/login", response_model=AuthResponse)
def login(creds: UserLogin):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, email, password_hash, role, reg_no, department, created_at FROM users WHERE email = ? COLLATE NOCASE;", (creds.email,))
        user_row = cursor.fetchone()
        
        if not user_row or not verify_password(creds.password, user_row["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password. Please verify your credentials."
            )
        
        user_dict = dict(user_row)
        del user_dict["password_hash"]
    
    token = create_access_token({
        "sub": str(user_dict["id"]),
        "email": user_dict["email"],
        "role": user_dict["role"],
        "name": user_dict["name"]
    })
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_dict
    }


@app.get("/api/auth/me")
def get_current_user_profile(user_payload: dict = Depends(get_current_user_from_token)):
    user_id = int(user_payload["sub"])
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, email, role, reg_no, department, created_at FROM users WHERE id = ?;", (user_id,))
        user_row = cursor.fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="User account not found")
        
        # Get count of registrations
        cursor.execute("SELECT COUNT(*) FROM registrations WHERE user_id = ? AND status = 'confirmed';", (user_id,))
        active_registrations_count = cursor.fetchone()[0]
        
        # Get count of unread notifications
        cursor.execute("SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0;", (user_id,))
        unread_notifications_count = cursor.fetchone()[0]
        
        user_data = dict(user_row)
        user_data["active_registrations_count"] = active_registrations_count
        user_data["unread_notifications_count"] = unread_notifications_count
        return user_data


@app.get("/api/auth/demo-users")
def get_demo_users():
    """Provides safe demo accounts to make reviewer evaluation effortless."""
    return [
        # --- Admins / Organizers ---
        {
            "role": "admin",
            "name": "ACM SRMIST Admin",
            "email": "admin@acm.srmist.edu.in",
            "password": "admin123",
            "department": "ACM Student Chapter SRMIST",
            "reg_no": "FAC2024ACM01",
            "badge": "Chapter Lead",
            "description": "Lead Chapter Organizer. Full CRUD permissions, participant rosters, CSV export & gate check-in desk."
        },
        {
            "role": "admin",
            "name": "Tech Lead - Foundry",
            "email": "techlead@acm.srmist.edu.in",
            "password": "admin123",
            "department": "ACM Foundry Technical Domain",
            "reg_no": "FAC2024ACM02",
            "badge": "Tech Lead",
            "description": "Technical domain lead for ACM hackathons, workshop logistics, and server operations."
        },
        {
            "role": "admin",
            "name": "Dr. S. Ramanathan (Faculty)",
            "email": "faculty@srmist.edu.in",
            "password": "admin123",
            "department": "Department of Computing Technologies",
            "reg_no": "FAC1088CSE01",
            "badge": "Faculty In-Charge",
            "description": "Faculty coordinator overseeing department event approvals, venue clearances, and campus attendance."
        },
        # --- Students ---
        {
            "role": "student",
            "name": "Aarav Sharma",
            "email": "student@srmist.edu.in",
            "password": "student123",
            "department": "Computer Science & Engineering",
            "reg_no": "RA2211003010156",
            "badge": "Final Year CSE",
            "description": "Registered SRMIST student account with existing registrations and tickets."
        },
        {
            "role": "student",
            "name": "Priya Sundaram",
            "email": "priya@srmist.edu.in",
            "password": "student123",
            "department": "Information Technology",
            "reg_no": "RA2211003010482",
            "badge": "3rd Year IT",
            "description": "Active participant in HackMatrix and Milan Cultural fest passes."
        },
        {
            "role": "student",
            "name": "Rohan Iyer",
            "email": "rohan@srmist.edu.in",
            "password": "student123",
            "department": "Data Science & AI",
            "reg_no": "RA2211003010729",
            "badge": "2nd Year AI/DS",
            "description": "Pre-registered for GenAI Workshop with QR check-in completed."
        },
        {
            "role": "student",
            "name": "Sneha Reddy",
            "email": "sneha@srmist.edu.in",
            "password": "student123",
            "department": "Electronics & Communication",
            "reg_no": "RA2211003010893",
            "badge": "3rd Year ECE",
            "description": "Registered for Milan cultural evening with active QR ticket."
        },
        {
            "role": "student",
            "name": "Karthik Verma",
            "email": "karthik@srmist.edu.in",
            "password": "student123",
            "department": "Biotechnology & Genetic Engg",
            "reg_no": "RA2211003011024",
            "badge": "2nd Year Biotech",
            "description": "Enthusiastic hackathon attendee registered for HackMatrix 2026."
        }
    ]


# ==========================================
# 2. EVENT DISCOVERY & CRUD APIS
# ==========================================

@app.get("/api/categories")
def get_event_categories():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT category, COUNT(*) as count 
            FROM events 
            GROUP BY category 
            ORDER BY count DESC;
        """)
        rows = cursor.fetchall()
        return [{"category": row["category"], "count": row["count"]} for row in rows]


@app.get("/api/events")
def list_events(
    search: Optional[str] = Query(None, description="Keyword search in title, description, venue, organizer"),
    category: Optional[str] = Query(None, description="Category filter"),
    date_filter: Optional[str] = Query("all", description="all, today, upcoming, past"),
    status_filter: Optional[str] = Query("all", description="all, open, completed, cancelled"),
    sort_by: Optional[str] = Query("date_asc", description="date_asc, date_desc, popularity, capacity_remaining"),
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=100),
    user_payload: Optional[dict] = Depends(get_optional_user_from_token)
):
    current_user_id = int(user_payload["sub"]) if user_payload else None
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        query = """
            SELECT e.*,
            (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'confirmed') as confirmed_count
        """
        
        if current_user_id:
            query += """,
            (SELECT ticket_id FROM registrations r WHERE r.event_id = e.id AND r.user_id = ? AND r.status = 'confirmed') as user_ticket_id
            """
            params = [current_user_id]
        else:
            params = []
            
        query += " FROM events e WHERE 1=1"
        
        # Search query
        if search and search.strip():
            term = f"%{search.strip()}%"
            query += " AND (e.title LIKE ? OR e.description LIKE ? OR e.venue LIKE ? OR e.organizer_name LIKE ?)"
            params.extend([term, term, term, term])
            
        # Category filter
        if category and category.lower() != "all":
            query += " AND e.category = ?"
            params.append(category)
            
        # Status filter
        if status_filter and status_filter.lower() != "all":
            query += " AND e.status = ?"
            params.append(status_filter.lower())
            
        # Date filter
        today_str = datetime.now().strftime("%Y-%m-%d")
        if date_filter == "today":
            query += " AND e.date = ?"
            params.append(today_str)
        elif date_filter == "upcoming":
            query += " AND e.date >= ?"
            params.append(today_str)
        elif date_filter == "past":
            query += " AND e.date < ?"
            params.append(today_str)
            
        # Sorting
        if sort_by == "date_desc":
            query += " ORDER BY e.date DESC, e.time DESC"
        elif sort_by == "popularity":
            query += " ORDER BY confirmed_count DESC, e.date ASC"
        elif sort_by == "capacity_remaining":
            query += " ORDER BY (e.max_capacity - confirmed_count) ASC, e.date ASC"
        else: # date_asc default
            query += " ORDER BY e.date ASC, e.time ASC"
            
        # Pagination
        offset = (page - 1) * limit
        paginated_query = f"{query} LIMIT ? OFFSET ?;"
        exec_params = list(params)
        exec_params.extend([limit, offset])
        
        cursor.execute(paginated_query, exec_params)
        rows = cursor.fetchall()
        
        # Count total matches for pagination metadata
        count_query = "SELECT COUNT(*) FROM events e WHERE 1=1"
        count_params = []
        if search and search.strip():
            count_query += " AND (e.title LIKE ? OR e.description LIKE ? OR e.venue LIKE ? OR e.organizer_name LIKE ?)"
            count_params.extend([term, term, term, term])
        if category and category.lower() != "all":
            count_query += " AND e.category = ?"
            count_params.append(category)
        if status_filter and status_filter.lower() != "all":
            count_query += " AND e.status = ?"
            count_params.append(status_filter.lower())
        if date_filter == "today":
            count_query += " AND e.date = ?"
            count_params.append(today_str)
        elif date_filter == "upcoming":
            count_query += " AND e.date >= ?"
            count_params.append(today_str)
        elif date_filter == "past":
            count_query += " AND e.date < ?"
            count_params.append(today_str)
            
        cursor.execute(count_query, count_params)
        total_items = cursor.fetchone()[0]
        
        events_list = []
        for row in rows:
            event_item = dict(row)
            # Sync current registrations dynamically
            event_item["current_registrations"] = row["confirmed_count"]
            event_item["is_user_registered"] = bool(row["user_ticket_id"]) if current_user_id and "user_ticket_id" in row.keys() else False
            events_list.append(event_item)
            
        return {
            "page": page,
            "limit": limit,
            "total_items": total_items,
            "total_pages": (total_items + limit - 1) // limit if limit > 0 else 1,
            "items": events_list
        }


@app.get("/api/events/{event_id}")
def get_event_detail(event_id: int, user_payload: Optional[dict] = Depends(get_optional_user_from_token)):
    current_user_id = int(user_payload["sub"]) if user_payload else None
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM events WHERE id = ?;", (event_id,))
        event = cursor.fetchone()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found.")
        
        event_dict = dict(event)
        
        # Fetch verified confirmed registrations count
        cursor.execute("SELECT COUNT(*) FROM registrations WHERE event_id = ? AND status = 'confirmed';", (event_id,))
        confirmed_count = cursor.fetchone()[0]
        event_dict["current_registrations"] = confirmed_count
        
        # Check user registration status
        if current_user_id:
            cursor.execute("SELECT ticket_id, checked_in, registered_at FROM registrations WHERE event_id = ? AND user_id = ? AND status = 'confirmed';", (event_id, current_user_id))
            reg = cursor.fetchone()
            event_dict["is_user_registered"] = bool(reg)
            event_dict["user_ticket_id"] = reg["ticket_id"] if reg else None
            event_dict["user_checked_in"] = bool(reg["checked_in"]) if reg else False
        else:
            event_dict["is_user_registered"] = False
            event_dict["user_ticket_id"] = None
            event_dict["user_checked_in"] = False

        return event_dict


@app.post("/api/events", status_code=status.HTTP_201_CREATED)
def create_event(
    event_data: EventCreate,
    user_payload: dict = Depends(get_current_user_from_token)
):
    if user_payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator permissions required to create events.")
    
    user_id = int(user_payload["sub"])
    banner = event_data.banner_url or "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80"
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO events (
                title, description, category, date, time, venue, 
                organizer_name, organizer_email, max_capacity, 
                current_registrations, status, banner_url, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'open', ?, ?);
        """, (
            event_data.title,
            event_data.description,
            event_data.category,
            event_data.date,
            event_data.time,
            event_data.venue,
            event_data.organizer_name,
            str(event_data.organizer_email),
            event_data.max_capacity,
            banner,
            user_id
        ))
        new_event_id = cursor.lastrowid
        cursor.execute("SELECT * FROM events WHERE id = ?;", (new_event_id,))
        created = dict(cursor.fetchone())
        
    return created


@app.put("/api/events/{event_id}")
def update_event(
    event_id: int,
    event_data: EventUpdate,
    user_payload: dict = Depends(get_current_user_from_token)
):
    if user_payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator permissions required to edit events.")
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM events WHERE id = ?;", (event_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Event not found.")
        
        # Prepare dynamic updates
        updates = []
        params = []
        data_dict = event_data.model_dump(exclude_unset=True)
        
        if "max_capacity" in data_dict and data_dict["max_capacity"] is not None:
            # Capacity cannot be less than confirmed registrations
            cursor.execute("SELECT COUNT(*) FROM registrations WHERE event_id = ? AND status = 'confirmed';", (event_id,))
            confirmed_count = cursor.fetchone()[0]
            if data_dict["max_capacity"] < confirmed_count:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot reduce capacity to {data_dict['max_capacity']}. There are already {confirmed_count} confirmed registrations."
                )

        for key, value in data_dict.items():
            if value is not None:
                updates.append(f"{key} = ?")
                params.append(str(value) if "email" in key else value)
                
        if updates:
            params.append(event_id)
            cursor.execute(f"UPDATE events SET {', '.join(updates)} WHERE id = ?;", params)
            
        cursor.execute("SELECT * FROM events WHERE id = ?;", (event_id,))
        updated = dict(cursor.fetchone())
        
        # If event status changed to cancelled, notify registered users
        if data_dict.get("status") == "cancelled":
            cursor.execute("SELECT user_id FROM registrations WHERE event_id = ? AND status = 'confirmed';", (event_id,))
            reg_users = cursor.fetchall()
            for r_user in reg_users:
                cursor.execute("""
                    INSERT INTO notifications (user_id, title, message, type)
                    VALUES (?, ?, ?, ?);
                """, (
                    r_user["user_id"],
                    f"Notice: {existing['title']} has been cancelled",
                    f"The event scheduled for {existing['date']} at {existing['venue']} has been cancelled by the organizers.",
                    "cancellation"
                ))
                
        return updated


@app.delete("/api/events/{event_id}")
def delete_event(
    event_id: int,
    user_payload: dict = Depends(get_current_user_from_token)
):
    if user_payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator permissions required to delete events.")
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT title FROM events WHERE id = ?;", (event_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Event not found.")
        
        # Delete event (registrations cascade)
        cursor.execute("DELETE FROM events WHERE id = ?;", (event_id,))
        return {"success": True, "message": f"Event '{existing['title']}' was successfully deleted."}


# ==========================================
# 3. REGISTRATION & CANCELLATION FLOW
# ==========================================

@app.post("/api/events/{event_id}/register", status_code=status.HTTP_201_CREATED)
def register_for_event(
    event_id: int,
    user_payload: dict = Depends(get_current_user_from_token)
):
    user_id = int(user_payload["sub"])
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Fetch event
        cursor.execute("SELECT * FROM events WHERE id = ?;", (event_id,))
        event = cursor.fetchone()
        if not event:
            raise HTTPException(status_code=404, detail="Event does not exist.")
            
        if event["status"] != "open":
            raise HTTPException(
                status_code=400,
                detail=f"Registrations are closed. This event is currently marked as '{event['status']}'."
            )
            
        # 2. Check for duplicate registration
        cursor.execute("SELECT * FROM registrations WHERE event_id = ? AND user_id = ?;", (event_id, user_id))
        existing_reg = cursor.fetchone()
        if existing_reg:
            if existing_reg["status"] == "confirmed":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Duplicate registration detected! You are already registered for '{event['title']}' with Ticket ID #{existing_reg['ticket_id']}."
                )
            elif existing_reg["status"] == "cancelled":
                # User previously cancelled, we will re-activate their slot below if capacity allows
                re_register = True
            else:
                re_register = False
        else:
            re_register = False
            
        # 3. Check event capacity atomically
        cursor.execute("SELECT COUNT(*) FROM registrations WHERE event_id = ? AND status = 'confirmed';", (event_id,))
        active_count = cursor.fetchone()[0]
        
        if active_count >= event["max_capacity"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Event is full! Maximum capacity of {event['max_capacity']} attendees has been reached."
            )
            
        # 4. Generate unique Ticket ID & record registration
        ticket_id = generate_ticket_id()
        if re_register:
            cursor.execute("""
                UPDATE registrations 
                SET ticket_id = ?, status = 'confirmed', checked_in = 0, checked_in_at = NULL, registered_at = CURRENT_TIMESTAMP
                WHERE event_id = ? AND user_id = ?;
            """, (ticket_id, event_id, user_id))
            reg_id = existing_reg["id"]
        else:
            cursor.execute("""
                INSERT INTO registrations (ticket_id, event_id, user_id, status)
                VALUES (?, ?, ?, 'confirmed');
            """, (ticket_id, event_id, user_id))
            reg_id = cursor.lastrowid
            
        # 5. Atomically update event count
        cursor.execute("""
            UPDATE events 
            SET current_registrations = (SELECT COUNT(*) FROM registrations WHERE event_id = ? AND status = 'confirmed')
            WHERE id = ?;
        """, (event_id, event_id))
        
        # 6. Add in-app notification & confirmation
        cursor.execute("""
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (?, ?, ?, 'registration');
        """, (
            user_id,
            f"Registration Confirmed: {event['title']}",
            f"Your seat is reserved! Your E-Ticket #{ticket_id} is ready. Venue: {event['venue']}, Date: {event['date']}.",
        ))
        
        cursor.execute("SELECT * FROM registrations WHERE id = ?;", (reg_id,))
        reg_row = dict(cursor.fetchone())
        reg_row["event"] = dict(event)
        
        # E-mail confirmation preview data
        email_preview = {
            "to": user_payload["email"],
            "subject": f"Registration Confirmed: {event['title']} [Ticket #{ticket_id}]",
            "body": f"Hello {user_payload['name']},\n\nYour registration for {event['title']} at SRMIST has been successfully confirmed!\n\nEvent Details:\nDate: {event['date']}\nTime: {event['time']}\nVenue: {event['venue']}\nTicket ID: {ticket_id}\n\nPlease present your ticket or QR code at the check-in desk upon arrival.",
            "sent_at": datetime.now(timezone.utc).isoformat()
        }
        reg_row["email_confirmation_preview"] = email_preview

        return {
            "message": "Registration successful! Your E-ticket is ready.",
            "registration": reg_row
        }


@app.post("/api/registrations/{registration_id}/cancel")
def cancel_registration(
    registration_id: int,
    user_payload: dict = Depends(get_current_user_from_token)
):
    user_id = int(user_payload["sub"])
    is_admin = user_payload.get("role") == "admin"
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Find registration
        cursor.execute("""
            SELECT r.*, e.title as event_title, e.date as event_date, e.id as event_id
            FROM registrations r
            JOIN events e ON r.event_id = e.id
            WHERE r.id = ?;
        """, (registration_id,))
        reg = cursor.fetchone()
        
        if not reg:
            raise HTTPException(status_code=404, detail="Registration record not found.")
            
        if not is_admin and reg["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="You do not have permission to cancel this registration.")
            
        if reg["status"] == "cancelled":
            raise HTTPException(status_code=400, detail="This registration has already been cancelled.")
            
        # Cancel registration
        cursor.execute("UPDATE registrations SET status = 'cancelled' WHERE id = ?;", (registration_id,))
        
        # Update event's current registration count
        cursor.execute("""
            UPDATE events 
            SET current_registrations = (SELECT COUNT(*) FROM registrations WHERE event_id = ? AND status = 'confirmed')
            WHERE id = ?;
        """, (reg["event_id"], reg["event_id"]))
        
        # Notify user
        cursor.execute("""
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (?, ?, ?, 'cancellation');
        """, (
            reg["user_id"],
            f"Registration Cancelled: {reg['event_title']}",
            f"Your registration for {reg['event_title']} has been cancelled. Your seat has been released for other students.",
        ))
        
        return {
            "success": True,
            "message": f"Registration for '{reg['event_title']}' was successfully cancelled and the seat was freed up."
        }


@app.get("/api/registrations/my")
def get_my_registrations(user_payload: dict = Depends(get_current_user_from_token)):
    user_id = int(user_payload["sub"])
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                r.id as registration_id,
                r.ticket_id,
                r.status as registration_status,
                r.checked_in,
                r.checked_in_at,
                r.registered_at,
                e.id as event_id,
                e.title,
                e.description,
                e.category,
                e.date,
                e.time,
                e.venue,
                e.organizer_name,
                e.organizer_email,
                e.max_capacity,
                e.current_registrations,
                e.status as event_status,
                e.banner_url
            FROM registrations r
            JOIN events e ON r.event_id = e.id
            WHERE r.user_id = ?
            ORDER BY r.registered_at DESC;
        """, (user_id,))
        
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


@app.get("/api/registrations/ticket/{ticket_id}")
def verify_ticket(ticket_id: str):
    """Public or check-in verification for a ticket QR code."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                r.ticket_id,
                r.status as registration_status,
                r.checked_in,
                r.checked_in_at,
                r.registered_at,
                u.name as attendee_name,
                u.email as attendee_email,
                u.reg_no as attendee_reg_no,
                u.department as attendee_dept,
                e.id as event_id,
                e.title as event_title,
                e.date as event_date,
                e.time as event_time,
                e.venue as event_venue,
                e.organizer_name
            FROM registrations r
            JOIN users u ON r.user_id = u.id
            JOIN events e ON r.event_id = e.id
            WHERE r.ticket_id = ?;
        """, (ticket_id.strip().upper(),))
        
        ticket = cursor.fetchone()
        if not ticket:
            raise HTTPException(status_code=404, detail=f"Ticket '{ticket_id}' not found in the system.")
            
        return dict(ticket)


# ==========================================
# 4. ADMIN & ORGANIZER DASHBOARD APIS
# ==========================================

@app.get("/api/admin/overview")
def get_admin_overview(user_payload: dict = Depends(get_current_user_from_token)):
    if user_payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required.")
        
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Metrics
        cursor.execute("SELECT COUNT(*) FROM events;")
        total_events = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM events WHERE status = 'open';")
        active_events = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM registrations WHERE status = 'confirmed';")
        total_registrations = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM registrations WHERE checked_in = 1;")
        total_checked_in = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'student';")
        total_students = cursor.fetchone()[0]
        
        cursor.execute("SELECT SUM(max_capacity) FROM events;")
        sum_capacity = cursor.fetchone()[0] or 1
        
        capacity_fill_pct = round((total_registrations / sum_capacity) * 100, 1) if sum_capacity > 0 else 0
        
        # Recent registrations
        cursor.execute("""
            SELECT 
                r.ticket_id,
                r.registered_at,
                r.checked_in,
                u.name as attendee_name,
                u.reg_no as attendee_reg_no,
                e.title as event_title
            FROM registrations r
            JOIN users u ON r.user_id = u.id
            JOIN events e ON r.event_id = e.id
            ORDER BY r.registered_at DESC
            LIMIT 6;
        """)
        recent_activity = [dict(row) for row in cursor.fetchall()]
        
        return {
            "total_events": total_events,
            "active_events": active_events,
            "total_registrations": total_registrations,
            "total_checked_in": total_checked_in,
            "total_students": total_students,
            "capacity_fill_pct": capacity_fill_pct,
            "recent_activity": recent_activity
        }


@app.get("/api/admin/events/{event_id}/participants")
def get_event_participants(
    event_id: int,
    user_payload: dict = Depends(get_current_user_from_token)
):
    if user_payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required.")
        
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT title, max_capacity, venue, date FROM events WHERE id = ?;", (event_id,))
        event = cursor.fetchone()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found.")
            
        cursor.execute("""
            SELECT 
                r.id as registration_id,
                r.ticket_id,
                r.status,
                r.checked_in,
                r.checked_in_at,
                r.registered_at,
                u.id as user_id,
                u.name,
                u.email,
                u.reg_no,
                u.department
            FROM registrations r
            JOIN users u ON r.user_id = u.id
            WHERE r.event_id = ?
            ORDER BY r.registered_at ASC;
        """, (event_id,))
        
        participants = [dict(row) for row in cursor.fetchall()]
        
        return {
            "event": dict(event),
            "total_participants": len([p for p in participants if p["status"] == "confirmed"]),
            "participants": participants
        }


@app.get("/api/admin/events/{event_id}/participants/csv")
def download_participants_csv(
    event_id: int,
    user_payload: dict = Depends(get_current_user_from_token)
):
    if user_payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required.")
        
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT title FROM events WHERE id = ?;", (event_id,))
        event = cursor.fetchone()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found.")
            
        cursor.execute("""
            SELECT 
                r.ticket_id,
                u.name,
                u.email,
                u.reg_no,
                u.department,
                r.status,
                r.checked_in,
                r.checked_in_at,
                r.registered_at
            FROM registrations r
            JOIN users u ON r.user_id = u.id
            WHERE r.event_id = ?
            ORDER BY r.registered_at ASC;
        """, (event_id,))
        
        rows = cursor.fetchall()
        
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Ticket ID", "Full Name", "Email", "Reg Number", "Department", "Status", "Checked In", "Check-in Timestamp", "Registered At"])
    
    for row in rows:
        writer.writerow([
            row["ticket_id"],
            row["name"],
            row["email"],
            row["reg_no"] or "N/A",
            row["department"] or "N/A",
            row["status"],
            "YES" if row["checked_in"] else "NO",
            row["checked_in_at"] or "N/A",
            row["registered_at"]
        ])
        
    output.seek(0)
    filename = f"participants_event_{event_id}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.post("/api/admin/check-in")
def check_in_participant(
    check_in_data: CheckInRequest,
    user_payload: dict = Depends(get_current_user_from_token)
):
    if user_payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin check-in desk permissions required.")
        
    ticket_id = check_in_data.ticket_id.strip().upper()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT r.*, u.name as attendee_name, u.reg_no, e.title as event_title
            FROM registrations r
            JOIN users u ON r.user_id = u.id
            JOIN events e ON r.event_id = e.id
            WHERE r.ticket_id = ?;
        """, (ticket_id,))
        
        reg = cursor.fetchone()
        if not reg:
            raise HTTPException(status_code=404, detail=f"No ticket found matching '{ticket_id}'.")
            
        if reg["status"] != "confirmed":
            raise HTTPException(status_code=400, detail=f"Cannot check in: Ticket #{ticket_id} is '{reg['status']}'.")
            
        if reg["checked_in"] == 1:
            return {
                "success": True,
                "already_checked_in": True,
                "message": f"Attendee {reg['attendee_name']} is already checked in (since {reg['checked_in_at']}).",
                "attendee": {
                    "name": reg["attendee_name"],
                    "reg_no": reg["reg_no"],
                    "event_title": reg["event_title"],
                    "ticket_id": reg["ticket_id"],
                    "checked_in_at": reg["checked_in_at"]
                }
            }
            
        # Update check-in status
        cursor.execute("""
            UPDATE registrations 
            SET checked_in = 1, checked_in_at = ?
            WHERE ticket_id = ?;
        """, (now_str, ticket_id))
        
        return {
            "success": True,
            "already_checked_in": False,
            "message": f"Successfully verified & checked in {reg['attendee_name']} for '{reg['event_title']}'!",
            "attendee": {
                "name": reg["attendee_name"],
                "reg_no": reg["reg_no"],
                "event_title": reg["event_title"],
                "ticket_id": ticket_id,
                "checked_in_at": now_str
            }
        }


@app.get("/api/admin/analytics")
def get_analytics(user_payload: dict = Depends(get_current_user_from_token)):
    if user_payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin permissions required.")
        
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Registrations per category
        cursor.execute("""
            SELECT e.category, COUNT(r.id) as registrations_count
            FROM events e
            LEFT JOIN registrations r ON e.id = r.event_id AND r.status = 'confirmed'
            GROUP BY e.category
            ORDER BY registrations_count DESC;
        """)
        categories_data = [dict(row) for row in cursor.fetchall()]
        
        # 2. Top events by popularity
        cursor.execute("""
            SELECT e.id, e.title, e.category, e.max_capacity, COUNT(r.id) as confirmed_count
            FROM events e
            LEFT JOIN registrations r ON e.id = r.event_id AND r.status = 'confirmed'
            GROUP BY e.id
            ORDER BY confirmed_count DESC
            LIMIT 6;
        """)
        top_events = [dict(row) for row in cursor.fetchall()]
        
        # 3. Capacity utilization summary
        cursor.execute("""
            SELECT 
                COUNT(*) as total_events,
                SUM(max_capacity) as total_capacity,
                (SELECT COUNT(*) FROM registrations WHERE status = 'confirmed') as total_registered,
                (SELECT COUNT(*) FROM registrations WHERE checked_in = 1) as total_attended
            FROM events;
        """)
        stats = dict(cursor.fetchone())
        
        return {
            "categories": categories_data,
            "top_events": top_events,
            "summary": stats
        }


# ==========================================
# 5. USER NOTIFICATIONS APIS
# ==========================================

@app.get("/api/notifications")
def get_notifications(user_payload: dict = Depends(get_current_user_from_token)):
    user_id = int(user_payload["sub"])
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM notifications 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 20;
        """, (user_id,))
        return [dict(row) for row in cursor.fetchall()]


@app.put("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, user_payload: dict = Depends(get_current_user_from_token)):
    user_id = int(user_payload["sub"])
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?;", (notification_id, user_id))
        return {"success": True}


@app.put("/api/notifications/read-all")
def mark_all_notifications_read(user_payload: dict = Depends(get_current_user_from_token)):
    user_id = int(user_payload["sub"])
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?;", (user_id,))
        return {"success": True}


# ==========================================
# 6. STATIC FILES & SPA ENTRYPOINT
# ==========================================

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/", response_class=FileResponse)
@app.get("/index.html", response_class=FileResponse)
@app.get("/login", response_class=FileResponse)
@app.get("/admin/login", response_class=FileResponse)
def serve_index():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return HTMLResponse("<h1>ACM SRMIST Campus Event Platform</h1><p>Frontend loading...</p>")

@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
