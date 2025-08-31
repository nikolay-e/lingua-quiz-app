# ===================================================================================
# Lingua Quiz :: Unified Makefile
# ===================================================================================
.DEFAULT_GOAL := help
.PHONY: help local staging prod full-deploy build push deploy clean clean-db \
        clean-local clean-staging clean-prod

# ===================================================================================
# Core Configuration
# ===================================================================================
# The target environment ('local', 'staging', 'prod'). Can be set on the command line.
ENV ?= local

# Docker registry for remote images. Default to GHCR for better caching
REGISTRY ?= ghcr.io/nikolay-e/lingua-quiz
# Git commit hash is the default image tag. Override with `make ... IMAGE_TAG=...`
IMAGE_TAG ?= $(shell git rev-parse --short HEAD)

# List of services to build and push. Add new services here.
SERVICES := backend frontend integration-e2e-tests

# ===================================================================================
# Application & Helm Configuration
# ===================================================================================
APP_RELEASE_NAME := lingua-quiz
DB_RELEASE_NAME  := shared-postgres
HELM_INSTALL_FLAGS := --wait --timeout 10m

# --- Paths ---
HELM_APP_DIR      := ./helm/lingua-quiz-app
HELM_DB_DIR       := ./helm/shared-postgres
SOPS_AGE_KEY_FILE ?= .age-key.txt

# ===================================================================================
# Environment-Specific Configuration
# ===================================================================================
# This block dynamically configures variables based on the active ENV.
ifeq ($(ENV),local)
    APP_NAMESPACE := lingua-quiz-local
    DB_NAMESPACE  := shared-database
    VALUES_FILE   := $(HELM_APP_DIR)/values.local.yaml
else ifeq ($(ENV),staging)
    APP_NAMESPACE := lingua-quiz-staging
    DB_NAMESPACE  := shared-database
    VALUES_FILE   := $(HELM_APP_DIR)/values.staging.yaml
    INGRESS_HOST  := test-lingua-quiz.nikolay-eremeev.com
else ifeq ($(ENV),prod)
    APP_NAMESPACE := lingua-quiz-production
    DB_NAMESPACE  := shared-database
    VALUES_FILE   := $(HELM_APP_DIR)/values.prod.yaml
    INGRESS_HOST  := lingua-quiz.nikolay-eremeev.com
else
    $(error Invalid ENV specified: '$(ENV)'. Use 'local', 'staging', or 'prod'.)
endif

# --- Dynamic Helm Flags ---
# Add extra Helm '--set' flags for non-local environments.
HELM_SET_FLAGS :=
ifneq ($(ENV),local)
    ifeq ($(IMAGE_TAG),)
        $(error IMAGE_TAG must be set for staging or prod environments)
    endif
    HELM_SET_FLAGS = \
        $(foreach service,$(filter-out integration-e2e-tests,$(SERVICES)), \
            --set $(service).image.repository=$(REGISTRY)/lingua-quiz-$(service) \
            --set $(service).image.tag=$(IMAGE_TAG) \
        ) \
        --set tests.image.repository=$(REGISTRY)/lingua-quiz-integration-e2e-tests \
        --set tests.image.tag=$(IMAGE_TAG) \
        --set ingress.frontend.host=$(INGRESS_HOST)
endif

# ===================================================================================
# HELP
# ===================================================================================
help: ## ✨ Show this help message
	@echo "Lingua Quiz - Unified Workflow Makefile"
	@echo "----------------------------------------"
	@echo "Usage:"
	@echo "  make <command> [ENV=...] [IMAGE_TAG=...]"
	@echo ""
	@echo "Primary Environment Commands:"
	@echo "  make local                  Builds and deploys the LOCAL stack."
	@echo "  make staging                Builds, pushes, and deploys the STAGING stack."
	@echo "  make prod                   Builds, pushes, and deploys the PRODUCTION stack."
	@echo ""
	@echo "Cleanup Commands:"
	@echo "  make clean-local            Removes the LOCAL app and its database."
	@echo "  make clean-staging          Removes the STAGING application (leaves database untouched)."
	@echo "  make clean-prod             Removes the PRODUCTION application (leaves database untouched)."
	@echo ""
	@echo "Core Tasks:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9._-]+:.*?## / {printf "  \033[36m%-25s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ===================================================================================
# PRIMARY WORKFLOWS
# ===================================================================================
local: ## ▶️  Build and Deploy for the LOCAL environment.
	@$(MAKE) build ENV=local
	@$(MAKE) deploy ENV=local

staging: ## ▶️  Build, Push, and Deploy for the STAGING environment.
	@$(MAKE) full-deploy ENV=staging

prod: ## ▶️  Build, Push, and Deploy for the PRODUCTION environment.
	@$(MAKE) full-deploy ENV=prod

# --- Meta Workflows ---
full-deploy: build push deploy ## 🚀 Run the full build, push, and deploy sequence.

# ===================================================================================
# CLEANUP WORKFLOWS
# ===================================================================================
clean-local: ## 🧹 Remove the LOCAL stack (app and database).
	@$(MAKE) clean ENV=local
	@$(MAKE) clean-db ENV=local

clean-staging: ## 🧹 Remove the STAGING stack (app ONLY).
	@$(MAKE) clean ENV=staging

clean-prod: ## 🧹 Remove the PRODUCTION stack (app ONLY).
	@$(MAKE) clean ENV=prod

# ===================================================================================
# CORE TASKS (Called by workflows)
# ===================================================================================
build: ## 📦 Build all Docker images for the LOCAL environment only.
ifeq ($(ENV),local)
	@echo "--> Building local images..."
	$(foreach service,$(SERVICES), \
		echo "--> Building lingua-quiz-$(service):local"; \
		docker build --target $(service) -t lingua-quiz-$(service):local . ; \
	)
else
	@echo "--> Skipping build for [$(ENV)]: Handled by CI/CD workflow with GHCR caching."
endif

push: ## ⬆️ (CI ONLY) Push all Docker images to the registry.
	@echo "--> Skipping push: Handled by CI/CD workflow with build-push-action and GHCR caching."

# Reusable macro for idempotent Helm deployments
define HELM_DEPLOY
    @echo "--> Deploying release '$(1)' to namespace [$(3)]..."
    SOPS_AGE_KEY_FILE="$(PWD)/$(SOPS_AGE_KEY_FILE)" sops -d $(2)/values.sops.yaml | \
    helm upgrade --install $(1) $(2) \
        --namespace $(3) \
        --create-namespace \
        --reset-values \
        -f - \
        $(if $(4),-f $(4)) \
        $(5) \
        $(HELM_INSTALL_FLAGS)
endef

deploy: ## 🚀 Deploy application and database via Helm.
	@echo "--> Deploying database to namespace [$(DB_NAMESPACE)]..."
	$(call HELM_DEPLOY,$(DB_RELEASE_NAME),$(HELM_DB_DIR),$(DB_NAMESPACE))
	@echo "--> Deploying application to namespace [$(APP_NAMESPACE)]..."
	$(call HELM_DEPLOY,$(APP_RELEASE_NAME),$(HELM_APP_DIR),$(APP_NAMESPACE),$(VALUES_FILE),$(HELM_SET_FLAGS))
	@echo "\n✅ Deployment to [$(ENV)] complete!"

clean: ## 🗑️  Uninstall the application Helm release.
	@echo "--> Removing application '$(APP_RELEASE_NAME)' from namespace [$(APP_NAMESPACE)]..."
	@helm uninstall $(APP_RELEASE_NAME) --namespace $(APP_NAMESPACE) --wait || true

clean-db: ## ⚠️  Uninstall the database Helm release.
	@echo "--> Removing database '$(DB_RELEASE_NAME)' from namespace [$(DB_NAMESPACE)]..."
	@helm uninstall $(DB_RELEASE_NAME) --namespace $(DB_NAMESPACE) --wait || true
