#!/bin/bash
set -euo pipefail

# Preview Environment Management Script
# This script provides helper functions for managing PR preview environments

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Sanitize branch name to make it DNS-safe
# - Convert to lowercase
# - Replace '/' and '_' with '-'
# - Remove non-alphanumeric characters except '-'
# - Truncate to 63 characters (DNS label limit)
# - Remove trailing hyphens
sanitize_branch_name() {
    local branch="$1"
    echo "$branch" | \
        tr '[:upper:]' '[:lower:]' | \
        sed 's/[/_]/-/g' | \
        sed 's/[^a-z0-9-]//g' | \
        cut -c1-63 | \
        sed 's/-*$//'
}

# Generate manifests from templates
# Args: $1 = PR number, $2 = branch name (for display only)
generate_manifests() {
    local pr_number="$1"
    local branch_name="${2:-pr-$pr_number}"
    local namespace="preview-pr-${pr_number}"
    local template_dir="flux/templates/preview"
    local output_dir="flux/clusters/preview-pr-${pr_number}"

    echo -e "${GREEN}Generating manifests for PR #${pr_number} (branch: ${branch_name})${NC}"

    # Create output directory structure
    mkdir -p "${output_dir}/infrastructure"
    mkdir -p "${output_dir}/apps"

    # Process infrastructure templates
    for template in "${template_dir}/infrastructure"/*.yaml; do
        if [ -f "$template" ]; then
            local filename=$(basename "$template")
            echo "  Processing infrastructure/${filename}..."
            sed -e "s/{PR_NUMBER}/${pr_number}/g" \
                -e "s/{NAMESPACE}/${namespace}/g" \
                -e "s/{ NAMESPACE }/${namespace}/g" \
                "$template" > "${output_dir}/infrastructure/${filename}"
        fi
    done

    # Process apps templates
    for template in "${template_dir}/apps"/*.yaml; do
        if [ -f "$template" ]; then
            local filename=$(basename "$template")
            local output_file="${output_dir}/apps/${filename}"

            # Skip HelmRelease if it already exists - let ImageUpdateAutomation manage image tags
            if [ "$filename" == "helmrelease.yaml" ] && [ -f "$output_file" ]; then
                echo "  Skipping apps/${filename} (already exists, preserving image tags)..."
                continue
            fi

            echo "  Processing apps/${filename}..."
            sed -e "s/{PR_NUMBER}/${pr_number}/g" \
                -e "s/{NAMESPACE}/${namespace}/g" \
                -e "s/{ NAMESPACE }/${namespace}/g" \
                "$template" > "$output_file"
        fi
    done

    # Process Kustomization CRDs (infra.yaml, apps.yaml)
    # These go in production directory so flux-system can find and apply them
    for template in "${template_dir}"/infra.yaml "${template_dir}"/apps.yaml; do
        if [ -f "$template" ]; then
            local filename=$(basename "$template")
            local preview_filename="preview-pr-${pr_number}-${filename}"
            echo "  Processing ${filename} -> flux/clusters/production/${preview_filename}..."
            sed -e "s/{PR_NUMBER}/${pr_number}/g" \
                -e "s/{NAMESPACE}/${namespace}/g" \
                -e "s/{ NAMESPACE }/${namespace}/g" \
                "$template" > "flux/clusters/production/${preview_filename}"
        fi
    done

    # Generate Helm values file from template (one per preview)
    echo "  Generating Helm values..."
    local values_template="helm/lingua-quiz-app/values.preview.yaml.template"
    local values_output="helm/lingua-quiz-app/values.preview-pr-${pr_number}.yaml"

    if [ -f "$values_template" ]; then
        sed -e "s/{PR_NUMBER}/${pr_number}/g" \
            -e "s/{NAMESPACE}/${namespace}/g" \
            -e "s/{ NAMESPACE }/${namespace}/g" \
            "$values_template" > "$values_output"
    else
        echo -e "${YELLOW}Warning: values.preview.yaml.template not found${NC}"
    fi

    echo -e "${GREEN}Manifests generated successfully in ${output_dir}${NC}"
}

# Check active preview environment count
# Returns the count of active preview environments
check_preview_count() {
    local count=$(find flux/clusters -maxdepth 1 -type d -name "preview-*" 2>/dev/null | wc -l)
    echo "$count"
}

# Get oldest preview environment
# Returns the directory name of the oldest preview environment
get_oldest_preview() {
    find flux/clusters -maxdepth 1 -type d -name "preview-*" -printf '%T+ %p\n' 2>/dev/null | \
        sort | \
        head -n1 | \
        awk '{print $2}' | \
        xargs basename 2>/dev/null || echo ""
}

# Cleanup oldest preview environment
# Removes the oldest preview environment to make room for new ones
cleanup_oldest_preview() {
    local oldest=$(get_oldest_preview)

    if [ -z "$oldest" ]; then
        echo -e "${YELLOW}No preview environments found to clean up${NC}"
        return 0
    fi

    echo -e "${YELLOW}Cleaning up oldest preview environment: ${oldest}${NC}"

    # Extract PR number from directory name (preview-pr-123 -> 123)
    local pr_id="${oldest#preview-pr-}"

    # Remove the preview directory, Kustomization CRDs, and per-preview values file
    rm -rf "flux/clusters/${oldest}"
    rm -f "flux/clusters/production/preview-pr-${pr_id}-infra.yaml"
    rm -f "flux/clusters/production/preview-pr-${pr_id}-apps.yaml"
    rm -f "helm/lingua-quiz-app/values.preview-pr-${pr_id}.yaml"

    echo -e "${GREEN}Cleaned up ${oldest}${NC}"
}

# Enforce preview environment limit
# Ensures no more than MAX_PREVIEWS environments exist
enforce_preview_limit() {
    local max_previews="${MAX_PREVIEW_ENVS:-10}"
    local current_count=$(check_preview_count)

    echo "Current preview environments: ${current_count}/${max_previews}"

    while [ "$current_count" -ge "$max_previews" ]; do
        echo -e "${YELLOW}Preview limit reached (${current_count}/${max_previews}). Cleaning up oldest...${NC}"
        cleanup_oldest_preview
        current_count=$(check_preview_count)
    done

    echo -e "${GREEN}Preview environment count within limit: ${current_count}/${max_previews}${NC}"
}

# Apply database cleanup job
# Args: $1 = PR number
apply_cleanup_job() {
    local pr_number="$1"
    local namespace="preview-pr-${pr_number}"
    local template="flux/templates/cleanup/database-cleanup-job.yaml"
    local temp_file=$(mktemp)

    echo -e "${GREEN}Applying database cleanup job for PR #${pr_number}${NC}"

    # Generate cleanup job manifest
    sed -e "s/{PR_NUMBER}/${pr_number}/g" \
        -e "s/{NAMESPACE}/${namespace}/g" \
        -e "s/{ NAMESPACE }/${namespace}/g" \
        "$template" > "$temp_file"

    # Apply the job (requires kubectl to be configured)
    if command -v kubectl &> /dev/null; then
        kubectl apply -f "$temp_file" 2>&1 || echo -e "${YELLOW}Warning: Failed to apply cleanup job${NC}"

        # Wait for job completion (with timeout)
        echo "Waiting for cleanup job to complete..."
        kubectl wait --for=condition=complete \
            --timeout=120s \
            -n "$namespace" \
            "job/cleanup-db-pr-${pr_number}" 2>&1 || echo -e "${YELLOW}Warning: Cleanup job wait timed out${NC}"
    else
        echo -e "${YELLOW}kubectl not found, skipping job application${NC}"
    fi

    rm -f "$temp_file"
    echo -e "${GREEN}Cleanup job processed${NC}"
}

# List all preview environments
list_preview_envs() {
    echo "Active preview environments:"
    find flux/clusters -maxdepth 1 -type d -name "preview-*" -printf '%T+ %p\n' 2>/dev/null | \
        sort -r | \
        while read -r line; do
            local timestamp=$(echo "$line" | awk '{print $1}')
            local dir=$(echo "$line" | awk '{print $2}')
            local name=$(basename "$dir")
            echo "  - ${name} (modified: ${timestamp})"
        done
}

# Main function for CLI usage
main() {
    local command="${1:-help}"

    case "$command" in
        sanitize)
            [ -z "${2:-}" ] && { echo "Usage: $0 sanitize <branch-name>"; exit 1; }
            sanitize_branch_name "$2"
            ;;
        generate)
            [ -z "${2:-}" ] && {
                echo "Usage: $0 generate <pr-number> [branch-name]"
                exit 1
            }
            generate_manifests "$2" "$3"
            ;;
        count)
            check_preview_count
            ;;
        oldest)
            get_oldest_preview
            ;;
        cleanup-oldest)
            cleanup_oldest_preview
            ;;
        enforce-limit)
            enforce_preview_limit
            ;;
        cleanup-db)
            [ -z "${2:-}" ] && {
                echo "Usage: $0 cleanup-db <pr-number>"
                exit 1
            }
            apply_cleanup_job "$2"
            ;;
        list)
            list_preview_envs
            ;;
        *)
            echo "Preview Environment Management Script"
            echo ""
            echo "Usage: $0 <command> [args]"
            echo ""
            echo "Commands:"
            echo "  sanitize <branch>              Sanitize branch name for DNS (deprecated)"
            echo "  generate <pr-num> [branch]     Generate manifests from templates"
            echo "  count                          Count active preview environments"
            echo "  oldest                         Get oldest preview environment"
            echo "  cleanup-oldest                 Remove oldest preview environment"
            echo "  enforce-limit                  Enforce preview environment limit"
            echo "  cleanup-db <pr-num>            Apply database cleanup job"
            echo "  list                           List all preview environments"
            echo "  help                           Show this help message"
            exit 1
            ;;
    esac
}

# Run main if script is executed directly
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi
