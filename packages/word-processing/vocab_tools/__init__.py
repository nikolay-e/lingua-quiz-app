"""
LinguaQuiz Vocabulary Analysis Tools

A refactored toolkit for analyzing and maintaining vocabulary databases
for language learning applications.

Key Components:
- VocabularyAnalyzer: Base class for language-specific vocabulary analysis
- DatabaseParser: Handles migration file parsing and data extraction
- MigrationValidator: Validates database integrity and consistency
- Language-specific analyzers for English, German, and Spanish
"""

__version__ = "2.0.0"
__author__ = "Nikolay Eremeev"

from .core.database_parser import DatabaseParser
from .core.vocabulary_analyzer import VocabularyAnalyzer
from .validation.migration_validator import MigrationValidator

__all__ = [
    "VocabularyAnalyzer",
    "DatabaseParser",
    "MigrationValidator",
]
