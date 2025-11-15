from pydantic import BaseModel, Field


class ContentVersionResponse(BaseModel):
    version_id: int = Field(alias="versionId")
    version_name: str = Field(alias="versionName")
    is_active: bool = Field(alias="isActive")

    class Config:
        populate_by_name = True
