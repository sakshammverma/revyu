from pydantic import BaseModel, EmailStr, Field


class OtpRequestBody(BaseModel):
    email: EmailStr


class OtpVerifyBody(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class AuthResponse(BaseModel):
    session_token: str
    expires_at: str
