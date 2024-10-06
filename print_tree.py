import os
import re
import subprocess
import sys
from pathlib import Path
from typing import List, Dict, Any, TextIO

# Define the list of files and directories to ignore, with support for wildcards
IGNORE_LIST = {
    ".git", "package-lock.json", "node_modules", "dist", "data", "*.log", "*.tmp", "*.crt",
    "*.key", "*.secret", "LICENSE", "print_tree.sh", "*_data.sql", "*.csv", "*.txt",
    "coverage", "Generated -- *", "word_processing_scripts", "directory_tree.*", "screenshots", "videos",
    "playwright-report", "test-results"
}


def should_ignore(file: str, dir_path: str) -> bool:
    """Check if a file should be ignored based on IGNORE_LIST and .gitignore."""
    # Check against ignore list
    if any(re.fullmatch(ignore_item.replace('*', '.*'), file) for ignore_item in IGNORE_LIST):
        return True

    # Check against .gitignore if present
    gitignore_path = Path(dir_path) / '.gitignore'
    if gitignore_path.is_file():
        try:
            result = subprocess.run(['git', 'check-ignore', '-q', str(Path(dir_path) / file)],
                                    check=False, capture_output=True)
            return result.returncode == 0
        except FileNotFoundError:
            # Git is not installed or not found in PATH
            pass

    return False


def write_yaml_node(file: TextIO, node: Dict[str, Any], indent: str = '') -> None:
    """Write a node of the directory tree in YAML format."""
    file.write(f"{indent}- name: {node['name']}\n")
    file.write(f"{indent}  type: {node['type']}\n")

    if 'content' in node:
        file.write(f"{indent}  content: |\n")
        content_lines = node['content'].splitlines()
        for line in content_lines:
            file.write(f"{indent}    {line}\n")

    if 'children' in node:
        file.write(f"{indent}  children:\n")
        for child in node['children']:
            write_yaml_node(file, child, indent + '  ')


def build_tree(dir_path: str, base_dir: str) -> List[Dict[str, Any]]:
    """Build the directory tree structure."""
    tree = []
    try:
        for entry in sorted(Path(dir_path).iterdir()):
            if should_ignore(entry.name, dir_path) or not entry.exists():
                continue

            node = {
                "name": entry.name,
                "type": "directory" if entry.is_dir() else "file"
            }

            if entry.is_dir() and not entry.is_symlink():
                node["children"] = build_tree(str(entry), base_dir)
            elif entry.is_file():
                try:
                    node["content"] = entry.read_text(encoding='utf-8')
                except UnicodeDecodeError:
                    node["content"] = entry.read_bytes().decode('utf-8', errors='replace')
                except IOError:
                    node["content"] = "<unreadable content>"

            tree.append(node)
    except (PermissionError, OSError) as e:
        print(f"Error accessing {dir_path}: {e}", file=sys.stderr)

    return tree


def main():
    root_dir = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()

    if not root_dir.is_dir():
        print(f"Error: The path '{root_dir}' is not a valid directory.", file=sys.stderr)
        sys.exit(1)

    output_file = Path("directory_tree.yaml")

    directory_tree = {
        "name": root_dir.name,
        "type": "directory",
        "children": build_tree(str(root_dir), str(root_dir))
    }

    try:
        with output_file.open('w', encoding='utf-8') as f:
            f.write("name: {}\n".format(directory_tree['name']))
            f.write("type: {}\n".format(directory_tree['type']))
            f.write("children:\n")
            for child in directory_tree['children']:
                write_yaml_node(f, child, '  ')
        print(f"Directory tree saved to {output_file}")
    except IOError as e:
        print(f"Error: Unable to write to file '{output_file}': {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
