from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ProcessingContext:
    """Shared state passed between processing stages."""

    word: str
    metadata: dict = field(default_factory=dict)
    normalized: str | None = None
    lemma: str | None = None
    pos_tag: str | None = None
    morphology: dict | None = None
    frequency: float | None = None
    category: str | None = None
    should_filter: bool = False
    filter_reason: str | None = None


class ProcessingStage(ABC):
    """Base class for vocabulary processing stages."""

    @abstractmethod
    def process(self, context: ProcessingContext) -> ProcessingContext:
        """
        Process a word context through this stage.

        Args:
            context: Current processing context

        Returns:
            Updated context (may mark should_filter=True)
        """
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Stage name for logging/debugging."""
        pass


class ProcessingPipeline:
    """Pipeline of processing stages."""

    def __init__(self, stages: list[ProcessingStage]):
        self.stages = stages

    def process(self, context: ProcessingContext) -> ProcessingContext:
        """
        Process context through all stages.

        Stops early if should_filter becomes True.
        """
        for stage in self.stages:
            if context.should_filter:
                break
            context = stage.process(context)
        return context
