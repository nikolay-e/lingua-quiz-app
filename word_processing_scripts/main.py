#!/usr/bin/env python3
"""
Single command to run complete vocabulary analysis and validation.
Loads configuration from config.yaml and executes the core CLI functions.

Usage: python main.py
"""

from vocab_tools.cli.main import VocabularyToolsCLI
from vocab_tools.config.constants import SUPPORTED_LANGUAGES, CEFR_LEVELS
import argparse
import yaml

def progress_display(current, total, level, lang):
    """Simple progress display."""
    percent = current / total
    filled = int(20 * percent)  # Shorter bar
    bar = '█' * filled + '░' * (20 - filled)
    print(f'\r{level} {lang.upper()}: |{bar}| {percent:.1%}', end='', flush=True)

def print_summary(validation, analysis_results):
    """Print a final summary of the run."""
    print("\n📋 RESULTS:")
    if validation:
        status = "✅" if validation['is_valid'] else "❌"
        print(f"   {status} Validation: {validation['error_count']} errors, {validation['warning_count']} warnings")

    total_missing = 0
    for level, data in analysis_results.items():
        recs = sum(r.get('recommendation_count', 0) for r in data.values() if 'error' not in r)
        total_missing += recs
        print(f"   📚 {level}: {recs:,} missing words found")
    
    # Calculate total existing words (from first level to avoid triple counting)
    first_level = list(analysis_results.values())[0]
    total_existing = sum(r.get('total_existing_words', 0) for r in first_level.values() if 'error' not in r)
    
    print(f"\n💾 Database: {total_existing:,} words | Missing: {total_missing:,} words")

def main():
    """Run complete CEFR-level analysis with validation for all languages."""
    print("🚀 LinguaQuiz Vocabulary Analysis")
    print("📚 A1/A2/B1 words | EN/DE/ES")
    print()

    # Load configuration
    languages = SUPPORTED_LANGUAGES
    levels = CEFR_LEVELS
    cli = VocabularyToolsCLI()
    
    # 1. Run validation (silent)
    from vocab_tools.validation.migration_validator import MigrationValidator
    validator = MigrationValidator(migrations_directory=None, strict_mode=True)
    validation_result = validator.validate_all_migrations(silent=True)
    validation_results = validation_result.to_dict()
    
    # 2. Run analysis for each CEFR level with simple progress
    all_cefr_results = {}
    
    for i, (level_name, level_info) in enumerate(levels.items(), 1):
        start, end = level_info['range']
        print(f"[{i}/3] Analyzing {level_name} ({start:,}-{end:,} frequency range)...", end=' ')
        
        level_results = {}
        for language in languages:
            try:
                # Run analysis silently by directly using the analyzer
                analyzer_class = cli.analyzers[language]
                analyzer = analyzer_class(None, silent=True)  # Auto-detect migrations dir, silent mode
                
                # Silent analysis
                result = analyzer.analyze_vocabulary_gaps(
                    top_n=end,
                    start_rank=start,
                    show_progress=False  # Silent
                )
                
                level_results[language] = result.to_dict()
                print(f"{language.upper()}", end=' ')
                
            except Exception as e:
                level_results[language] = {'error': str(e)}
                print(f"{language.upper()}❌", end=' ')
        
        all_cefr_results[level_name] = level_results
        print("✓")

    print()
    # 3. Print summary
    print_summary(validation_results, all_cefr_results)
    print("📁 Complete analysis saved to: analysis_history.json")
    
    return {'validation': validation_results, 'cefr_levels': all_cefr_results}

if __name__ == "__main__":
    main()