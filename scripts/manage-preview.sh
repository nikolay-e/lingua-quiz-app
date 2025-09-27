#!/bin/bash
set -euo pipefail

# Простой скрипт для ручного управления preview окружениями
# Использование:
#   ./scripts/manage-preview.sh create <pr-number>
#   ./scripts/manage-preview.sh delete <pr-number>
#   ./scripts/manage-preview.sh list

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Функция для создания preview окружения
create_preview() {
    local pr_number="$1"
    local namespace="preview-pr-${pr_number}"

    echo -e "${GREEN}Создание preview окружения для PR #${pr_number}${NC}"

    # Проверка что шаблоны существуют
    if [ ! -d "${REPO_ROOT}/flux/templates/preview" ]; then
        echo -e "${RED}Ошибка: шаблоны не найдены в flux/templates/preview${NC}"
        exit 1
    fi

    # Создание директорий
    mkdir -p "${REPO_ROOT}/flux/clusters/preview-pr-${pr_number}/infrastructure"
    mkdir -p "${REPO_ROOT}/flux/clusters/preview-pr-${pr_number}/apps"

    # Генерация манифестов из шаблонов
    echo "  Генерация infrastructure манифестов..."
    for template in "${REPO_ROOT}/flux/templates/preview/infrastructure"/*.yaml; do
        if [ -f "$template" ]; then
            filename=$(basename "$template")
            sed -e "s/{PR_NUMBER}/${pr_number}/g" \
                -e "s/{NAMESPACE}/${namespace}/g" \
                -e "s/{ NAMESPACE }/${namespace}/g" \
                "$template" > "${REPO_ROOT}/flux/clusters/preview-pr-${pr_number}/infrastructure/${filename}"
        fi
    done

    echo "  Генерация apps манифестов..."
    for template in "${REPO_ROOT}/flux/templates/preview/apps"/*.yaml; do
        if [ -f "$template" ]; then
            filename=$(basename "$template")
            sed -e "s/{PR_NUMBER}/${pr_number}/g" \
                -e "s/{NAMESPACE}/${namespace}/g" \
                -e "s/{ NAMESPACE }/${namespace}/g" \
                "$template" > "${REPO_ROOT}/flux/clusters/preview-pr-${pr_number}/apps/${filename}"
        fi
    done

    # Генерация Kustomization CRD для infrastructure
    echo "  Генерация Kustomization CRD для infrastructure..."
    sed -e "s/{PR_NUMBER}/${pr_number}/g" \
        -e "s/{NAMESPACE}/${namespace}/g" \
        -e "s/{ NAMESPACE }/${namespace}/g" \
        "${REPO_ROOT}/flux/templates/preview/infra.yaml" > "${REPO_ROOT}/flux/clusters/production/preview-pr-${pr_number}-infra.yaml"

    # Генерация Kustomization CRD для apps
    echo "  Генерация Kustomization CRD для apps..."
    sed -e "s/{PR_NUMBER}/${pr_number}/g" \
        -e "s/{NAMESPACE}/${namespace}/g" \
        -e "s/{ NAMESPACE }/${namespace}/g" \
        "${REPO_ROOT}/flux/templates/preview/apps.yaml" > "${REPO_ROOT}/flux/clusters/production/preview-pr-${pr_number}-apps.yaml"

    # Генерация Helm values
    if [ -f "${REPO_ROOT}/helm/lingua-quiz-app/values.preview.yaml.template" ]; then
        echo "  Генерация Helm values..."
        sed -e "s/{PR_NUMBER}/${pr_number}/g" \
            -e "s/{NAMESPACE}/${namespace}/g" \
            -e "s/{ NAMESPACE }/${namespace}/g" \
            "${REPO_ROOT}/helm/lingua-quiz-app/values.preview.yaml.template" > "${REPO_ROOT}/helm/lingua-quiz-app/values.preview-pr-${pr_number}.yaml"
    fi

    # Добавление в kustomization.yaml
    echo "  Обновление kustomization.yaml..."
    local kustomization_file="${REPO_ROOT}/flux/clusters/production/kustomization.yaml"

    if ! grep -q "preview-pr-${pr_number}-infra.yaml" "$kustomization_file"; then
        # Добавляем перед последней строкой
        sed -i.bak "/^$/i\\
  - preview-pr-${pr_number}-infra.yaml\\
  - preview-pr-${pr_number}-apps.yaml" "$kustomization_file"
        rm -f "${kustomization_file}.bak"
    fi

    echo -e "${GREEN}✓ Preview окружение создано${NC}"
    echo ""
    echo "Следующие шаги:"
    echo "  1. git add flux/ helm/"
    echo "  2. git commit -m 'Add preview environment for PR #${pr_number}'"
    echo "  3. git push"
    echo "  4. flux reconcile kustomization flux-system --with-source"
}

# Функция для удаления preview окружения
delete_preview() {
    local pr_number="$1"

    echo -e "${YELLOW}Удаление preview окружения для PR #${pr_number}${NC}"

    # Удаление манифестов
    rm -rf "${REPO_ROOT}/flux/clusters/preview-pr-${pr_number}"
    rm -f "${REPO_ROOT}/flux/clusters/production/preview-pr-${pr_number}-infra.yaml"
    rm -f "${REPO_ROOT}/flux/clusters/production/preview-pr-${pr_number}-apps.yaml"
    rm -f "${REPO_ROOT}/helm/lingua-quiz-app/values.preview-pr-${pr_number}.yaml"

    # Удаление из kustomization.yaml (macOS совместимый способ)
    local kustomization_file="${REPO_ROOT}/flux/clusters/production/kustomization.yaml"
    grep -v "preview-pr-${pr_number}-infra.yaml" "$kustomization_file" | \
    grep -v "preview-pr-${pr_number}-apps.yaml" > "${kustomization_file}.tmp"
    mv "${kustomization_file}.tmp" "$kustomization_file"

    echo -e "${GREEN}✓ Preview окружение удалено${NC}"
    echo ""
    echo "Следующие шаги:"
    echo "  1. git add -A"
    echo "  2. git commit -m 'Remove preview environment for PR #${pr_number}'"
    echo "  3. git push"
    echo "  4. flux reconcile kustomization flux-system --with-source"
}

# Функция для показа списка preview окружений
list_previews() {
    echo -e "${GREEN}Активные preview окружения:${NC}"
    echo ""

    if [ -d "${REPO_ROOT}/flux/clusters" ]; then
        local count=0
        for dir in "${REPO_ROOT}/flux/clusters"/preview-pr-*; do
            if [ -d "$dir" ]; then
                local pr_id=$(basename "$dir" | sed 's/preview-pr-//')
                echo "  - PR #${pr_id} (namespace: preview-pr-${pr_id})"
                count=$((count + 1))
            fi
        done

        if [ $count -eq 0 ]; then
            echo "  Нет активных preview окружений"
        else
            echo ""
            echo "Всего: ${count}"
        fi
    fi
}

# Main
case "${1:-help}" in
    create)
        if [ -z "${2:-}" ]; then
            echo "Использование: $0 create <pr-number>"
            exit 1
        fi
        create_preview "$2"
        ;;
    delete)
        if [ -z "${2:-}" ]; then
            echo "Использование: $0 delete <pr-number>"
            exit 1
        fi
        delete_preview "$2"
        ;;
    list)
        list_previews
        ;;
    *)
        echo "Управление preview окружениями"
        echo ""
        echo "Использование:"
        echo "  $0 create <pr-number>   Создать preview окружение"
        echo "  $0 delete <pr-number>   Удалить preview окружение"
        echo "  $0 list                 Показать список preview окружений"
        exit 1
        ;;
esac
