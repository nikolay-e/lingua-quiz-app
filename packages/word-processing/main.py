#!/usr/bin/env python3
"""
Main entry point for vocab-tools CLI.

Usage:
    python main.py                    # Interactive mode
    python main.py analyze es-a1      # Direct command execution
    python main.py --help             # Show help

This is a convenience wrapper around the new Typer-based CLI.
"""

from vocab_tools.cli.app import main

if __name__ == "__main__":
    main()
