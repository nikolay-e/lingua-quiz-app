from pydantic import BaseModel, Field


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    language: str = Field(..., pattern="^(en|de|ru|es)$")


class TTSResponse(BaseModel):
    audio_data: str = Field(alias="audioData")
    content_type: str = Field(alias="contentType", default="audio/mpeg")
    text: str
    language: str

    class Config:
        populate_by_name = True


class TTSLanguagesResponse(BaseModel):
    available: bool
    supported_languages: list[str] = Field(alias="supportedLanguages")

    class Config:
        populate_by_name = True
