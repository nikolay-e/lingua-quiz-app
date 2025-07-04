#!/bin/bash

# Migration Status Checker
# Monitors Kubernetes migration job completion using kubectl wait

set -e

NAMESPACE=${1:-lingua-quiz-staging}

echo "Verifying migration job in namespace: $NAMESPACE..."

# Give it a moment for the job to be created
sleep 5

# Use 'kubectl wait' for a robust, clean wait
if kubectl wait --for=condition=complete --timeout=5m "job/lingua-quiz-migrations" -n "$NAMESPACE" 2>/dev/null; then
  echo "✅ Migration job completed successfully."
  exit 0
else
  echo "❌ Migration job failed or timed out!"
  
  # Capture detailed logs for debugging
  echo ""
  echo "=== Migration Job Status ==="
  kubectl describe job/lingua-quiz-migrations -n "$NAMESPACE" || true
  
  echo ""
  echo "=== Migration Pod Logs ==="
  kubectl logs job/lingua-quiz-migrations -n "$NAMESPACE" --all-containers=true || true
  
  # Also try to get logs from pods directly
  echo ""
  echo "=== Migration Pod Status ==="
  kubectl get pods -l job-name=lingua-quiz-migrations -n "$NAMESPACE" || true
  
  echo ""
  echo "=== Direct Pod Logs ==="
  kubectl logs -l job-name=lingua-quiz-migrations -n "$NAMESPACE" --all-containers=true || true
  
  exit 1
fi