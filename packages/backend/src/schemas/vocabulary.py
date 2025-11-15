from pydantic import BaseModel, Field


class VocabularyItemResponse(BaseModel):
    id: str
    source_text: str = Field(alias="sourceText")
    source_language: str = Field(alias="sourceLanguage")
    target_text: str = Field(alias="targetText")
    target_language: str = Field(alias="targetLanguage")
    list_name: str = Field(alias="listName")
    source_usage_example: str | None = Field(alias="sourceUsageExample")
    target_usage_example: str | None = Field(alias="targetUsageExample")

    class Config:
        populate_by_name = True


class WordListResponse(BaseModel):
    list_name: str = Field(alias="listName")
    word_count: int = Field(alias="wordCount")

    class Config:
        populate_by_name = True
