#!/usr/bin/env python3
"""
Single command to run complete vocabulary analysis and validation.
Loads configuration from config.yaml and executes the core CLI functions.

Usage: python main.py <command> [options]
Example: python main.py all
"""

from vocab_tools.cli.main import VocabularyToolsCLI


def main():
    """
    Main entry point for the vocab-tools CLI.
    This function instantiates and runs the command-line interface.
    """
    cli = VocabularyToolsCLI()
    cli.run()


if __name__ == "__main__":
    main()
