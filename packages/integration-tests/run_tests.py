#!/usr/bin/env python3
"""
Integration and E2E Test Runner
Runs all tests with proper reporting and exit codes
"""

import os
from pathlib import Path
import subprocess
import sys


def main():
    """Run all integration tests."""
    # Set working directory to the package root
    os.chdir(Path(__file__).parent)

    # Environment configuration
    api_url = os.getenv("API_URL", "http://localhost:9000/api")
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:80")
    skip_tts = os.getenv("SKIP_TTS_TESTS", "true")

    print("=== Integration and E2E Test Runner ===")
    print(f"API URL: {api_url}")
    print(f"Frontend URL: {frontend_url}")
    print(f"Skip TTS Tests: {skip_tts}")
    print()

    # Run pytest with proper configuration
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "tests/",
        "-v",  # Verbose output
        "--tb=short",  # Short traceback format
        "--html=reports/test_report.html",  # HTML report
        "--self-contained-html",  # Embed CSS/JS in HTML report
        "-x",  # Stop on first failure
    ]

    # Add markers for different test types
    test_type = os.getenv("TEST_TYPE", "all")
    if test_type == "integration":
        cmd.extend(["-m", "integration"])
    elif test_type == "e2e":
        cmd.extend(["-m", "e2e"])
    # else run all tests

    print("Running command:", " ".join(cmd))
    print("=" * 50)

    # Create reports directory
    Path("reports").mkdir(exist_ok=True)

    # Run the tests
    try:
        result = subprocess.run(cmd, check=False)
        exit_code = result.returncode
    except FileNotFoundError:
        print("❌ pytest not found. Please install requirements.txt")
        return 1
    except KeyboardInterrupt:
        print("❌ Tests interrupted by user")
        return 130

    print("=" * 50)

    if exit_code == 0:
        print("✅ All tests passed!")
    else:
        print(f"❌ Tests failed with exit code {exit_code}")

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
