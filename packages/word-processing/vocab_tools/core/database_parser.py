"""
Database migration file parser for LinguaQuiz vocabulary tools.

Handles extraction and parsing of vocabulary data from SQL migration files.
"""

import os
import re
import glob
from pathlib import Path
from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass


@dataclass
class VocabularyEntry:
    """Represents a single vocabulary entry from the database."""
    translation_id: int
    source_word_id: int
    target_word_id: int
    source_word: str
    target_word: str
    source_example: str
    target_example: str

    def __post_init__(self):
        """Clean up the entry data after initialization."""
        # Unescape SQL quotes
        self.source_word = self.source_word.replace("''", "'")
        self.target_word = self.target_word.replace("''", "'") 
        self.source_example = self.source_example.replace("''", "'")
        self.target_example = self.target_example.replace("''", "'")


class DatabaseParser:
    """
    Parses SQL migration files to extract vocabulary data.
    
    Handles the extraction of vocabulary entries from SQL INSERT statements
    in migration files following the LinguaQuiz database schema.
    """
    
    def __init__(self, migrations_directory: Optional[Path] = None):
        """
        Initialize the database parser.
        
        Args:
            migrations_directory: Path to migrations directory. If None, 
                                auto-detects based on current location.
        """
        self.migrations_dir = migrations_directory or self._find_migrations_directory()
    
    def _find_migrations_directory(self) -> Path:
        """
        Get the hardcoded migrations directory location.

        Returns:
            Path to migrations directory

        Raises:
            FileNotFoundError: If migrations directory cannot be found
        """
        # Hardcoded path relative to this file
        current_dir = Path(__file__).parent
        migrations_path = current_dir / ".." / ".." / ".." / "backend" / "migrations"
        migrations_path = migrations_path.resolve()
        
        if migrations_path.exists() and migrations_path.is_dir():
            return migrations_path
        
        raise FileNotFoundError(
            f"Hardcoded migrations directory not found: {migrations_path}"
        )
    
    def parse_migration_file(self, filename: str) -> List[VocabularyEntry]:
        """
        Parse a single migration file and extract vocabulary entries.
        
        Args:
            filename: Name of the migration file to parse
            
        Returns:
            List of vocabulary entries found in the file
            
        Raises:
            FileNotFoundError: If the migration file doesn't exist
            ValueError: If the file format is invalid
        """
        # Look for file in data subdirectory first, then main migrations dir
        file_path = self.migrations_dir / "data" / filename
        if not file_path.exists():
            file_path = self.migrations_dir / filename
        
        if not file_path.exists():
            raise FileNotFoundError(f"Migration file not found: {file_path}")
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            raise ValueError(f"Error reading migration file {filename}: {e}")
        
        return self._extract_entries_from_content(content, filename)
    
    def _extract_entries_from_content(self, content: str, filename: str) -> List[VocabularyEntry]:
        """
        Extract vocabulary entries from SQL file content.
        
        Args:
            content: SQL file content
            filename: Source filename (for error reporting)
            
        Returns:
            List of vocabulary entries
        """
        entries = []
        
        # Filter out commented lines to avoid processing commented-out entries
        lines = content.split('\n')
        active_lines = []
        for line in lines:
            stripped = line.strip()
            if not stripped.startswith('--'):
                active_lines.append(line)
        
        filtered_content = '\n'.join(active_lines)
        
        # Pattern to match INSERT statements with vocabulary data
        # Handles escaped quotes ('') properly
        insert_pattern = re.compile(
            r'\(\s*(\d+),\s*(\d+),\s*(\d+),\s*'
            r"'((?:[^']|'')*)'\s*,\s*"  # source_word
            r"'((?:[^']|'')*)'\s*,\s*"  # translation
            r"'((?:[^']|'')*)'\s*,\s*"  # example
            r"'((?:[^']|'')*)'\s*"      # example_translation
            r'\)',
            re.MULTILINE
        )
        
        matches = insert_pattern.findall(filtered_content)
        
        for match in matches:
            try:
                entry = VocabularyEntry(
                    translation_id=int(match[0]),
                    source_word_id=int(match[1]),
                    target_word_id=int(match[2]),
                    source_word=match[3],
                    target_word=match[4],
                    source_example=match[5],
                    target_example=match[6]
                )
                entries.append(entry)
            except (ValueError, IndexError) as e:
                print(f"Warning: Skipping malformed entry in {filename}: {match} ({e})")
                continue
        
        return entries
    
    def discover_migration_files(self) -> Dict[str, List[str]]:
        """
        Dynamically discover migration files by pattern.
        
        Pattern: 9{number}_{source_lang}_{target_lang}_{level}_words.sql
        
        Returns:
            Dict mapping language codes to list of their migration files
        """
        discovered_files = {}
        
        # Search pattern for vocabulary migration files in data subdirectory
        data_dir = self.migrations_dir / "data"
        if not data_dir.exists():
            return discovered_files
            
        pattern = os.path.join(data_dir, "9*_*_*_*_words.sql")
        migration_files = glob.glob(pattern)
        
        for file_path in migration_files:
            filename = os.path.basename(file_path)
            
            # Parse filename pattern: 9XX_source_target_level_words.sql
            match = re.match(r'^9\d+_(\w+)_(\w+)_(\w+)_words\.sql$', filename)
            if match:
                source_lang, target_lang, level = match.groups()
                
                # Map common language names to codes
                lang_mapping = {
                    'english': 'en',
                    'german': 'de', 
                    'spanish': 'es',
                    'russian': 'ru'
                }
                
                source_code = lang_mapping.get(source_lang.lower(), source_lang)
                
                if source_code not in discovered_files:
                    discovered_files[source_code] = []
                
                discovered_files[source_code].append(filename)
        
        # Sort files by filename to ensure consistent order
        for lang_code in discovered_files:
            discovered_files[lang_code].sort()
        
        return discovered_files
    
    def get_migration_files(self) -> List[str]:
        """
        Get list of all migration files in the directory.
        
        Returns:
            List of migration filenames
        """
        if not self.migrations_dir.exists():
            return []
        
        migration_files = []
        for file_path in self.migrations_dir.glob("*.sql"):
            migration_files.append(file_path.name)
        
        return sorted(migration_files)
    
    def get_vocabulary_files(self) -> List[str]:
        """
        Get list of vocabulary migration files (9xx series).
        
        Returns:
            List of vocabulary migration filenames
        """
        all_files = self.get_migration_files()
        return [f for f in all_files if f.startswith('9') and 'words' in f]