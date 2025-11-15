from pydantic import BaseModel, Field


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)


class UserRegistration(UserBase):
    password: str = Field(..., min_length=8, max_length=128)


class UserLogin(UserBase):
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    is_admin: bool = False


class TokenResponse(BaseModel):
    token: str
    refresh_token: str
    expires_in: str = "15m"
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: str
