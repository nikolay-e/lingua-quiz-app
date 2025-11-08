from dataclasses import dataclass, field


@dataclass
class BaseValidationIssue:
    severity: str
    category: str
    file_name: str
    entry_id: int | None = None

    def __str__(self) -> str:
        location = f"{self.file_name}"
        if self.entry_id:
            location += f" (ID: {self.entry_id})"
        return f"{self.severity.upper()}: {self.get_message()} [{location}]"

    def get_message(self) -> str:
        return "Validation issue"

    def to_dict(self) -> dict:
        return {
            "severity": self.severity,
            "category": self.category,
            "file_name": self.file_name,
            "entry_id": self.entry_id,
        }


@dataclass
class BaseValidationResult:
    total_checked: int
    files_validated: list[str] = field(default_factory=list)
    issues: list = field(default_factory=list)

    @property
    def error_count(self) -> int:
        return len([i for i in self.issues if i.severity == "error"])

    @property
    def warning_count(self) -> int:
        return len([i for i in self.issues if i.severity == "warning"])

    @property
    def is_valid(self) -> bool:
        return self.error_count == 0

    def to_dict(self) -> dict:
        return {
            "is_valid": self.is_valid,
            "total_checked": self.total_checked,
            "files_validated": self.files_validated,
            "error_count": self.error_count,
            "warning_count": self.warning_count,
            "issues": [issue.to_dict() for issue in self.issues],
        }
