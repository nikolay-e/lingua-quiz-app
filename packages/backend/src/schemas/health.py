from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    database: str
    timestamp: str


class VersionResponse(BaseModel):
    version: str
