#!/bin/bash

# Define the list of files and directories to ignore, with support for wildcards
IGNORE_LIST=(".git" "package-lock.json" "node_modules" "dist" "data" "*.log" "*.tmp" "*.crt" "*.key" "*.secret" "LICENSE" "print_tree.sh" "*_data.sql")

# Function to check if a file should be ignored
should_ignore() {
  local file="$1"
  local dir="$2"

  # Check if the file matches any pattern in the IGNORE_LIST
  for ignore_item in "${IGNORE_LIST[@]}"; do
    if [[ "$file" == $ignore_item ]]; then
      return 0
    fi
  done

  # Check if the file is ignored according to .gitignore
  if [[ -f "$dir/.gitignore" ]] && git check-ignore -q "$file"; then
    return 0
  fi

  return 1
}

# Function to check if a file is binary
is_binary() {
  local file="$1"

  # Treat JSON files as text
  if [[ "$file" == *.json ]]; then
    return 1
  fi

  if file --mime-type "$file" | grep -qv 'text/'; then
    return 0
  fi
  return 1
}

# Function to print the directory tree
print_tree() {
  local dir="$1"
  local prefix="$2"
  local files
  local file path new_prefix

  IFS=$'\n' read -d '' -r -a files < <(ls -1A "$dir")

  for i in "${!files[@]}"; do
    file="${files[$i]}"
    path="$dir/$file"

    # Skip if file should be ignored
    if should_ignore "$file" "$dir"; then
      continue
    fi

    # Determine if the current file is the last in the directory
    if [ $i -eq $((${#files[@]} - 1)) ]; then
      echo "${prefix}└── $file"
      new_prefix="${prefix}    "
    else
      echo "${prefix}├── $file"
      new_prefix="${prefix}│   "
    fi

    # If it's a directory and not a symlink, recurse into it
    if [ -d "$path" ] && [ ! -L "$path" ]; then
      print_tree "$path" "$new_prefix"
    else
      if is_binary "$path"; then
        echo "${new_prefix}(Binary file)"
      else
        echo "${new_prefix}Content:"
        sed "s/^/${new_prefix}    /" "$path"
      fi
    fi
  done
}

# Check if a directory was provided as an argument
if [ $# -eq 0 ]; then
  echo "Usage: $0 <path>"
  exit 1
fi

root_dir="$1"

# Print the directory tree starting from the root directory
echo "$root_dir"
print_tree "$root_dir" ""
