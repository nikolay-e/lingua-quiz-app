# Makefile for Lingua Quiz - Local K8s Development with Rancher Desktop
.PHONY: help build-local build-local-clean deploy-local-db deploy-local-app deploy-local clean-local logs-backend logs-frontend port-forward

help:
	@echo "Lingua Quiz - Local K8s Development Commands"
	@echo "============================================"
	@echo "Setup & Deployment:"
	@echo "  make build-local       - Build Docker images for local K8s"
	@echo "  make deploy-local      - Deploy everything to local K8s (DB + App)"
	@echo "  make deploy-local-db   - Deploy only PostgreSQL to local K8s"
	@echo "  make deploy-local-app  - Deploy only application to local K8s"
	@echo ""
	@echo "Access & Monitoring:"
	@echo "  make port-forward      - Forward ports for local access"
	@echo "  make logs-backend      - Show backend logs"
	@echo "  make logs-frontend     - Show frontend logs"
	@echo "  make logs-db          - Show database logs"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean-local       - Remove all local K8s deployments"
	@echo "  make clean-local-db    - Remove PostgreSQL deployment"
	@echo "  make clean-local-app   - Remove application deployment"
	@echo ""
	@echo "URLs after deployment:"
	@echo "  Frontend: http://localhost:30080"
	@echo "  Backend:  http://localhost:30900"
	@echo "  Database: localhost:30543 (if port-forwarded)"

build-local:
	@echo "Force removing existing images..."
	-docker rmi -f lingua-quiz-backend:local lingua-quiz-frontend:local 2>/dev/null || true
	@echo "Building backend image (no cache)..."
	docker build --no-cache -t lingua-quiz-backend:local ./packages/backend
	@echo "Building frontend image (no cache)..."
	docker build --no-cache -t lingua-quiz-frontend:local -f ./packages/frontend/Dockerfile .
	@echo "Images built successfully!"

deploy-local-db:
	@echo "Creating shared-database namespace..."
	kubectl create namespace shared-database --dry-run=client -o yaml | kubectl apply -f -
	@echo "Deploying shared PostgreSQL..."
	helm upgrade --install shared-postgres ./helm/shared-postgres \
		-f ./helm/shared-postgres/values.local.yaml \
		--namespace shared-database \
		--wait --timeout 5m
	@echo "PostgreSQL deployed successfully!"

# Deploy application
deploy-local-app:
	@echo "Deploying Lingua Quiz application..."
	helm upgrade --install lingua-quiz ./helm/lingua-quiz-app \
		-f ./helm/lingua-quiz-app/values.local.yaml \
		--namespace default \
		--wait --timeout 5m
	@echo "Application deployed successfully!"
	@echo ""
	@echo "Access the application at:"
	@echo "  Frontend: http://localhost:30080"
	@echo "  Backend API: http://localhost:30900/api"

deploy-local: build-local deploy-local-db deploy-local-app
	@echo "Full deployment completed!"

port-forward:
	@echo "Setting up port forwarding for PostgreSQL..."
	@echo "Database will be available at: localhost:5432"
	@echo "Press Ctrl+C to stop port forwarding"
	kubectl port-forward -n shared-database svc/shared-postgres 5432:5432

logs-backend:
	kubectl logs -n default -l app.kubernetes.io/name=lingua-quiz-app,app.kubernetes.io/component=backend

logs-frontend:
	kubectl logs -n default -l app.kubernetes.io/name=lingua-quiz-app,app.kubernetes.io/component=frontend

logs-db:
	kubectl logs -n shared-database -l app.kubernetes.io/name=shared-postgres

# Clean up deployments
clean-local-app:
	@echo "Removing Lingua Quiz application..."
	helm uninstall lingua-quiz --namespace default || true
	@echo "Application removed!"

clean-local-db:
	@echo "Removing shared PostgreSQL..."
	helm uninstall shared-postgres --namespace shared-database || true
	@echo "Removing PVCs..."
	kubectl delete pvc -n shared-database -l app.kubernetes.io/name=shared-postgres || true
	@echo "PostgreSQL removed!"

clean-local: clean-local-app clean-local-db
	@echo "Cleanup completed!"
	@echo "Removing namespace..."
	kubectl delete namespace shared-database --ignore-not-found=true

restart-backend:
	kubectl rollout restart deployment -n default lingua-quiz-backend

restart-frontend:
	kubectl rollout restart deployment -n default lingua-quiz-frontend

status:
	@echo "=== Namespaces ==="
	@kubectl get namespace | grep -E "(default|shared-database)" || true
	@echo ""
	@echo "=== Database Status (shared-database namespace) ==="
	@kubectl get all -n shared-database 2>/dev/null || echo "Database not deployed"
	@echo ""
	@echo "=== Application Status (default namespace) ==="
	@kubectl get all -n default -l app.kubernetes.io/name=lingua-quiz-app 2>/dev/null || echo "Application not deployed"
	@echo ""
	@echo "=== Persistent Volumes ==="
	@kubectl get pvc -A | grep -E "(shared-database|lingua-quiz)" || true

# Quick development cycle
dev: build-local
	@echo "Updating application with new images..."
	kubectl rollout restart deployment -n default lingua-quiz-backend || true
	kubectl rollout restart deployment -n default lingua-quiz-frontend || true
	@echo "Waiting for rollout to complete..."
	kubectl rollout status deployment -n default lingua-quiz-backend --timeout=2m || true
	kubectl rollout status deployment -n default lingua-quiz-frontend --timeout=2m || true
	@echo "Development update completed!"

# Database operations
db-shell:
	@echo "Connecting to PostgreSQL shell..."
	kubectl exec -it -n shared-database statefulset/shared-postgres -- psql -U postgres

db-backup:
	@echo "Creating database backup..."
	kubectl exec -n shared-database statefulset/shared-postgres -- pg_dump -U postgres linguaquiz_dev > backup-$(shell date +%Y%m%d-%H%M%S).sql
	@echo "Backup saved to backup-*.sql"
