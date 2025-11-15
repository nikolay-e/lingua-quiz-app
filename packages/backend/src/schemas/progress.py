from pydantic import BaseModel, Field


class UserProgressResponse(BaseModel):
    vocabulary_item_id: str = Field(alias="vocabularyItemId")
    source_text: str = Field(alias="sourceText")
    source_language: str = Field(alias="sourceLanguage")
    target_language: str = Field(alias="targetLanguage")
    level: int
    queue_position: int = Field(alias="queuePosition")
    correct_count: int = Field(alias="correctCount")
    incorrect_count: int = Field(alias="incorrectCount")
    consecutive_correct: int = Field(alias="consecutiveCorrect")
    last_practiced: str | None = Field(alias="lastPracticed")

    class Config:
        populate_by_name = True


class ProgressUpdateRequest(BaseModel):
    source_text: str = Field(alias="sourceText")
    source_language: str = Field(alias="sourceLanguage")
    target_language: str = Field(alias="targetLanguage")
    level: int = Field(..., ge=0, le=5)
    queue_position: int = Field(alias="queuePosition", ge=0)
    correct_count: int = Field(alias="correctCount", ge=0)
    incorrect_count: int = Field(alias="incorrectCount", ge=0)
    consecutive_correct: int = Field(alias="consecutiveCorrect", ge=0)

    class Config:
        populate_by_name = True
