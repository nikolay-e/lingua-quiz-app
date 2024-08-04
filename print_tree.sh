#!/bin/bash

# Function to check if a file should be ignored
should_ignore() {
    local file="$1"
    local dir="$2"

    # Check for .gitignore in the current directory only
    if [[ -f "$dir/.gitignore" ]]; then
        if git check-ignore -q "$file"; then
            return 0
        fi
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
    if [[ $(file --mime-type -b "$file") != text/* ]]; then
        return 0
    fi
    return 1
}

print_tree() {
    local dir="$1"
    local prefix="$2"
    local files
    IFS=$'\n' read -d '' -r -a files < <(ls -1A "$dir")

    for i in "${!files[@]}"; do
        local file="${files[$i]}"
        local path="$dir/$file"
        
        # Skip if file should be ignored, if it's in the .git directory, if it's package-lock.json, if it's in node_modules, or if it's in data
        if should_ignore "$file" "$dir" || [[ "$file" == ".git" ]] || [[ "$file" == "package-lock.json" ]] || [[ "$file" == "node_modules" ]] || [[ "$file" == "dist" ]] || [[ "$file" == "data" ]]; then
            continue
        fi

        if [ $i -eq $((${#files[@]} - 1)) ]; then
            echo "${prefix}└── $file"
            new_prefix="${prefix}    "
        else
            echo "${prefix}├── $file"
            new_prefix="${prefix}│   "
        fi

        if [ -d "$path" ]; then
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

if [ $# -eq 0 ]; then
    echo "Usage: $0 <path>"
    exit 1
else
    root_dir="$1"
fi

echo "$root_dir"
print_tree "$root_dir" ""
