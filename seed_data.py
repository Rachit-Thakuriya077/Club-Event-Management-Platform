import sqlite3
import random
from database import get_db, init_db
from auth import hash_password

def seed_demo_data(force=False):
    init_db()
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        if force:
            cursor.execute("DELETE FROM notifications;")
            cursor.execute("DELETE FROM registrations;")
            cursor.execute("DELETE FROM events;")
            cursor.execute("DELETE FROM users;")
        else:
            # Check if already seeded
            cursor.execute("SELECT COUNT(*) FROM users;")
            user_count = cursor.fetchone()[0]
            if user_count > 0:
                print("Database already contains data. Skipping seed.")
                return

        print("Seeding database with realistic SRMIST campus event data...")

        # 1. Seed Users (Admins and Students)
        users = [
            # Admins
            ("ACM SRMIST Admin", "admin@acm.srmist.edu.in", hash_password("admin123"), "admin", "FAC2024ACM01", "ACM Student Chapter SRMIST"),
            ("Tech Lead - Foundry", "techlead@acm.srmist.edu.in", hash_password("admin123"), "admin", "FAC2024ACM02", "ACM Foundry Technical Domain"),
            ("Dr. S. Ramanathan (Faculty)", "faculty@srmist.edu.in", hash_password("admin123"), "admin", "FAC1088CSE01", "Department of Computing Technologies"),
            # Students
            ("Aarav Sharma", "student@srmist.edu.in", hash_password("student123"), "student", "RA2211003010156", "Computer Science & Engineering"),
            ("Priya Sundaram", "priya@srmist.edu.in", hash_password("student123"), "student", "RA2211003010482", "Information Technology"),
            ("Rohan Iyer", "rohan@srmist.edu.in", hash_password("student123"), "student", "RA2211003010729", "Data Science & AI"),
            ("Sneha Reddy", "sneha@srmist.edu.in", hash_password("student123"), "student", "RA2211003010893", "Electronics & Communication"),
            ("Karthik Verma", "karthik@srmist.edu.in", hash_password("student123"), "student", "RA2211003011024", "Biotechnology & Genetic Engg"),
        ]

        cursor.executemany("""
            INSERT INTO users (name, email, password_hash, role, reg_no, department)
            VALUES (?, ?, ?, ?, ?, ?);
        """, users)

        cursor.execute("SELECT id FROM users WHERE email = 'admin@acm.srmist.edu.in';")
        admin_id = cursor.fetchone()[0]
        cursor.execute("SELECT id FROM users WHERE email = 'student@srmist.edu.in';")
        student1_id = cursor.fetchone()[0]
        cursor.execute("SELECT id FROM users WHERE email = 'priya@srmist.edu.in';")
        student2_id = cursor.fetchone()[0]
        cursor.execute("SELECT id FROM users WHERE email = 'rohan@srmist.edu.in';")
        student3_id = cursor.fetchone()[0]
        cursor.execute("SELECT id FROM users WHERE email = 'sneha@srmist.edu.in';")
        student4_id = cursor.fetchone()[0]
        cursor.execute("SELECT id FROM users WHERE email = 'karthik@srmist.edu.in';")
        student5_id = cursor.fetchone()[0]

        # 2. Seed Events (omitted from replace chunk, see below for actual placement)

        # 2. Seed Events
        events = [
            (
                "SRM HackMatrix 2026: 36-Hour National Hackathon",
                "Join India's premier student-led hackathon hosted by ACM SRMIST! Build groundbreaking projects in Web3, AI/ML, Cloud Computing, and Social Impact. Win cash prizes worth ₹1,50,000, internship opportunities, swag kits, and mentorship from top industry leaders. Free meals, high-speed WiFi, and 24/7 mentor support provided.",
                "Technical",
                "2026-10-24",
                "09:00 AM - 09:00 PM (Next Day)",
                "Dr. T.P. Ganesan Auditorium & TP Lab Complex",
                "ACM Student Chapter SRMIST",
                "contact@acm.srmist.edu.in",
                150,
                0,
                "open",
                "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80",
                admin_id
            ),
            (
                "Generative AI & Autonomous Agent Architecture Workshop",
                "A deep-dive, hands-on workshop covering LLM fine-tuning, retrieval-augmented generation (RAG), and building multi-agent systems using Python and FastAPI. Bring your laptops fully charged with Python 3.10+ installed. Participants will deploy a functioning agent by the end of the session.",
                "Workshop",
                "2026-10-18",
                "01:30 PM - 05:00 PM",
                "Tech Park 6th Floor - Audi 1",
                "ACM Foundry Domain",
                "foundry@acm.srmist.edu.in",
                60,
                0,
                "open",
                "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
                admin_id
            ),
            (
                "Milan 2026: National Battle of the Bands",
                "The flagship musical showdown of SRMIST's annual cultural extravaganza Milan! Witness colleges across the nation battle it out with electric guitar solos, thunderous drum fills, and soulful vocals on the grand open stage. Free entry for all SRM students with valid E-Ticket.",
                "Cultural",
                "2026-11-05",
                "05:00 PM - 10:00 PM",
                "Open Air Theatre (OAT), Main Campus",
                "Directorate of Student Affairs",
                "dsa@srmist.edu.in",
                400,
                0,
                "open",
                "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80",
                admin_id
            ),
            (
                "Web3 & Zero-Knowledge Cryptography Bootcamp",
                "Discover how decentralized ledger technologies, smart contract security, and zero-knowledge proofs are transforming the internet. Includes live demo of smart contract deployment on Ethereum testnets.",
                "Technical",
                "2026-10-30",
                "10:00 AM - 01:00 PM",
                "Bio-Tech Block Seminar Hall 301",
                "SRM Blockchain Research Group",
                "blockchain@srmist.edu.in",
                45,
                0,
                "open",
                "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80",
                admin_id
            ),
            (
                "SRM Esports Championship: Valorant & BGMI Cup",
                "Competitive campus gaming tournament featuring 5v5 tactical shooter brackets and mobile battle royale. Cast live on Twitch with custom merchandise for winning squads.",
                "Gaming",
                "2026-10-21",
                "11:00 AM - 06:00 PM",
                "University Building (UB) Ground Floor Arena",
                "SRM Gaming Society",
                "gaming@srmist.edu.in",
                32,
                0,
                "open",
                "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
                admin_id
            ),
            (
                "Tech Career Masterclass: Cracking Tier-1 Product Roles",
                "Exclusive panel discussion with alumni currently at Google, Microsoft, and Uber. Learn effective system design preparation, resume optimization, and mock technical interview strategies.",
                "Seminar",
                "2026-11-12",
                "02:00 PM - 04:30 PM",
                "Dr. T.P. Ganesan Mini Hall 2",
                "ACM SRMIST Alumni Network",
                "alumni@acm.srmist.edu.in",
                120,
                0,
                "open",
                "https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=1200&q=80",
                admin_id
            ),
            (
                "Inter-Collegiate 5-a-Side Futsal Tournament",
                "High octane knockout football tournament under floodlights. Medals, trophies, and cash prizes for top 3 teams. Certified referees and on-site medical staff provided.",
                "Sports",
                "2026-10-15",
                "04:00 PM - 08:30 PM",
                "SRMIST Sports Complex Futsal Arena",
                "SRM Dept of Physical Education",
                "sports@srmist.edu.in",
                24,
                0,
                "open",
                "https://images.unsplash.com/photo-1529900245534-47fbf82a4661?auto=format&fit=crop&w=1200&q=80",
                admin_id
            ),
            (
                "Quantum Computing: Principles & Qiskit Applications",
                "Introductory seminar into qubits, quantum superposition, quantum gates, and how IBM Qiskit enables algorithms to run on actual quantum processors in the cloud.",
                "Seminar",
                "2026-10-12",
                "10:30 AM - 12:30 PM",
                "Tech Park Mini Hall 1",
                "ACM Research Wing",
                "research@acm.srmist.edu.in",
                2, # Intentionally tiny capacity to test full event edge case
                0,
                "open",
                "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80",
                admin_id
            ),
            (
                "Symposium on Responsible AI",
                "A three-day event focused on ethical and trustworthy AI, featuring an ideathon, hackathon, expert talks, and project presentations.",
                "Technical",
                "2026-03-18",
                "09:30 AM - 05:00 PM (3-Day Event)",
                "Dr. T.P. Ganesan Auditorium & Mini Hall 1",
                "SRMIST E-Cell & ACM Student Chapter",
                "responsible.ai@srmist.edu.in",
                250,
                0,
                "open",
                "https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=1200&q=80",
                admin_id
            ),
            (
                "ACM Chapter Orientation",
                "An introductory event covering ACM resources, technology, collaboration, and opportunities within the chapter.",
                "Seminar",
                "2024-04-15",
                "10:00 AM - 01:00 PM",
                "Tech Park 3rd Floor Computing Lab Complex",
                "ACM Student Chapter SRMIST",
                "orientation@acm.srmist.edu.in",
                120,
                0,
                "open",
                "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80",
                admin_id
            )
        ]

        cursor.executemany("""
            INSERT INTO events (
                title, description, category, date, time, venue, 
                organizer_name, organizer_email, max_capacity, 
                current_registrations, status, banner_url, created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, events)

        # 3. Seed some initial registrations
        cursor.execute("SELECT id, title FROM events;")
        event_rows = cursor.fetchall()
        event_by_prefix = {}
        for row in event_rows:
            if "HackMatrix" in row["title"]:
                event_by_prefix["hack"] = row["id"]
            elif "Workshop" in row["title"]:
                event_by_prefix["workshop"] = row["id"]
            elif "Milan" in row["title"]:
                event_by_prefix["milan"] = row["id"]
            elif "Quantum" in row["title"]:
                event_by_prefix["quantum"] = row["id"]
                
        initial_registrations = [
            ("ACM-2026-HK81A", event_by_prefix.get("hack", 1), student1_id, "confirmed", 0, None),
            ("ACM-2026-AI92B", event_by_prefix.get("workshop", 2), student1_id, "confirmed", 1, "2026-10-09 11:20:00"),
            ("ACM-2026-HK81C", event_by_prefix.get("hack", 1), student2_id, "confirmed", 0, None),
            ("ACM-2026-QC01A", event_by_prefix.get("quantum", 8), student1_id, "confirmed", 0, None),
            ("ACM-2026-QC01B", event_by_prefix.get("quantum", 8), student2_id, "confirmed", 0, None),
            ("ACM-2026-ML33D", event_by_prefix.get("milan", 3), student2_id, "confirmed", 0, None),
            ("ACM-2026-RO88A", event_by_prefix.get("hack", 1), student3_id, "confirmed", 1, "2026-10-09 09:45:00"),
            ("ACM-2026-RO88B", event_by_prefix.get("workshop", 2), student3_id, "confirmed", 0, None),
            ("ACM-2026-SN44A", event_by_prefix.get("milan", 3), student4_id, "confirmed", 0, None),
            ("ACM-2026-KV55A", event_by_prefix.get("hack", 1), student5_id, "confirmed", 0, None),
        ]

        cursor.executemany("""
            INSERT INTO registrations (ticket_id, event_id, user_id, status, checked_in, checked_in_at)
            VALUES (?, ?, ?, ?, ?, ?);
        """, initial_registrations)

        # Update event current_registrations count dynamically from registrations
        cursor.execute("""
            UPDATE events 
            SET current_registrations = (
                SELECT COUNT(*) FROM registrations WHERE registrations.event_id = events.id AND registrations.status = 'confirmed'
            );
        """)

        # 4. Add initial notification for student1
        cursor.execute("""
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (?, ?, ?, ?);
        """, (
            student1_id,
            "Registration Confirmed: SRM HackMatrix 2026",
            "Your ticket ACM-2026-HK81A has been generated! Keep your QR code ready at TP Ganesan Auditorium.",
            "registration"
        ))

        print("Database successfully seeded with realistic SRMIST events, users, and registrations!")

if __name__ == "__main__":
    seed_demo_data(force=True)
