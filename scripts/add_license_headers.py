#!/usr/bin/env python3
#
# LinguaQuiz – Copyright © 2025 Nikolay Eremeev
#
# Dual-licensed:
#  – Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
#  – Commercial License v2              →  see LICENSE-COMMERCIAL.md
#
# Contact: lingua-quiz@nikolay-eremeev.com
# Repository: https://github.com/nikolay-e/lingua-quiz
#
"""
LinguaQuiz License Header Manager
A script to add license headers to source files using the licenseheaders library
"""

import os
import argparse
import sys
from pathlib import Path
import subprocess
import logging

def check_licenseheaders_installed():
    """Check if licenseheaders is installed, and install if not."""
    try:
        import licenseheaders
        logging.info("licenseheaders is already installed.")
        return True
    except ImportError:
        logging.info("licenseheaders is not installed. Installing now...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "licenseheaders"])
            logging.info("licenseheaders successfully installed.")
            return True
        except subprocess.CalledProcessError:
            logging.error("Failed to install licenseheaders. Please install manually with 'pip install licenseheaders'")
            return False

def create_template(contact, repository):
    """Create a license header template file."""
    template_dir = Path("./license-templates")
    template_dir.mkdir(exist_ok=True)
    
    template_path = template_dir / "linguaquiz.tmpl"
    template_content = f"""LinguaQuiz – Copyright © ${{years}} ${{owner}}

Dual-licensed:
 – Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 – Commercial License v2              →  see LICENSE-COMMERCIAL.md

Contact: {contact}
Repository: {repository}
"""
    
    with open(template_path, 'w', encoding='utf-8') as f:
        f.write(template_content)
    logging.info(f"Created template: {template_path}")
    
    return template_path

def main():
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(levelname)s: %(message)s'
    )

    # Set up command line arguments
    parser = argparse.ArgumentParser(description='Add license headers to files using licenseheaders')
    parser.add_argument('--js', action='store_true', help='Process JavaScript files')
    parser.add_argument('--py', action='store_true', help='Process Python files')
    parser.add_argument('--sql', action='store_true', help='Process SQL files')
    parser.add_argument('--yaml', action='store_true', help='Process YAML files')
    parser.add_argument('--sh', action='store_true', help='Process Shell scripts')
    parser.add_argument('--all', action='store_true', help='Process all supported file types')
    parser.add_argument('--dir', type=str, default='.', help='Base directory to process')
    parser.add_argument('--owner', type=str, default='Nikolay Eremeev', help='Copyright owner')
    parser.add_argument('--contact', type=str, default='lingua-quiz@nikolay-eremeev.com', help='Contact email')
    parser.add_argument('--repository', type=str, default='https://github.com/nikolay-e/lingua-quiz', help='Repository URL')
    parser.add_argument('--backup', action='store_true', help='Create backup of modified files')
    parser.add_argument('--dry-run', action='store_true', help='Dry run without making changes')
    parser.add_argument('--verbose', '-v', action='count', default=0, help='Increase verbosity')
    
    args = parser.parse_args()
    
    # Check if licenseheaders is installed
    if not check_licenseheaders_installed():
        return 1
    
    # Create template with hard-coded values for contact and repository
    template_path = create_template(args.contact, args.repository)
    
    # Build extensions list based on arguments
    extensions = []
    if args.js or args.all:
        extensions.extend(['.js', '.jsx', '.ts', '.tsx'])
    if args.py or args.all:
        extensions.extend(['.py'])
    if args.sql or args.all:
        extensions.extend(['.sql'])
    if args.yaml or args.all:
        extensions.extend(['.yml', '.yaml'])
    if args.sh or args.all:
        extensions.extend(['.sh'])
        
    if not extensions:
        logging.error("No file types selected. Use --all or specify file types (--js, --py, etc.)")
        return 1
    
    # Build the command for licenseheaders
    cmd = [
        sys.executable, "-m", "licenseheaders",
        "-t", str(template_path),
        "-cy",  # Current year
        "-o", args.owner,
        "-d", args.dir,
        "-E"
    ]
    
    # Add extensions
    cmd.extend(extensions)
    
    # Add exclude patterns
    excludes = ['node_modules', '.git', 'dist', 'build', 'coverage']
    for exclude in excludes:
        cmd.extend(["-x", exclude])
    
    # Add backup option if requested
    if args.backup:
        cmd.append("-b")
    
    # Add dry-run option if requested
    if args.dry_run:
        cmd.append("--dry")
    
    # Add verbosity
    for _ in range(args.verbose):
        cmd.append("-v")
    
    # Execute the command
    logging.info(f"Running: {' '.join(cmd)}")
    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        logging.info("License header update completed successfully")
        return 0
    except subprocess.CalledProcessError as e:
        logging.error(f"Error running licenseheaders: {e}")
        if e.stdout:
            print(e.stdout)
        if e.stderr:
            print(e.stderr, file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
