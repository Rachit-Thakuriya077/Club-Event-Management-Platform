from pydantic import BaseModel, Field, field_validator
import re
from typing import Optional, List

EMAIL_REGEX = re.compile(r"^[\w\.-]+@[\w\.-]+\.\w+$")

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str
    password: str = Field(..., min_length=6, max_length=100)
    role: Optional[str] = "student"
    reg_no: Optional[str] = None
    department: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not EMAIL_REGEX.match(clean):
            raise ValueError("Invalid email address format.")
        return clean

class UserLogin(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return v.strip().lower()

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    reg_no: Optional[str] = None
    department: Optional[str] = None
    created_at: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class EventCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10)
    category: str = Field(..., min_length=2, max_length=50)
    date: str = Field(..., description="YYYY-MM-DD")
    time: str = Field(..., min_length=2, max_length=50)
    venue: str = Field(..., min_length=2, max_length=150)
    organizer_name: str = Field(..., min_length=2, max_length=100)
    organizer_email: str
    max_capacity: int = Field(..., gt=0)
    banner_url: Optional[str] = None

    @field_validator("organizer_email")
    @classmethod
    def validate_org_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not EMAIL_REGEX.match(clean):
            raise ValueError("Invalid organizer email format.")
        return clean

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    venue: Optional[str] = None
    organizer_name: Optional[str] = None
    organizer_email: Optional[str] = None
    max_capacity: Optional[int] = None
    status: Optional[str] = None
    banner_url: Optional[str] = None

class EventResponse(BaseModel):
    id: int
    title: str
    description: str
    category: str
    date: str
    time: str
    venue: str
    organizer_name: str
    organizer_email: str
    max_capacity: int
    current_registrations: int
    status: str
    banner_url: Optional[str]
    created_at: str
    is_user_registered: Optional[bool] = False
    user_ticket_id: Optional[str] = None

class RegistrationRequest(BaseModel):
    event_id: int

class RegistrationResponse(BaseModel):
    id: int
    ticket_id: str
    event_id: int
    user_id: int
    status: str
    checked_in: bool
    checked_in_at: Optional[str]
    registered_at: str
    event: Optional[dict] = None

class CheckInRequest(BaseModel):
    ticket_id: str
