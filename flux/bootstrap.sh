#!/bin/bash
set -e

# FluxCD Bootstrap Script for LinguaQuiz
# Usage: ./bootstrap.sh [production|staging]

ENV=${1:-production}

if [[ "$ENV" != "production" && "$ENV" != "staging" ]]; then
    echo "Error: Environment must be 'production' or 'staging'"
    echo "Usage: $0 [production|staging]"
    exit 1
fi

echo "🚀 Bootstrapping FluxCD for $ENV environment"

# Check prerequisites
if ! command -v flux &> /dev/null; then
    echo "❌ Flux CLI not found. Install it with:"
    echo "   brew install fluxcd/tap/flux"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    exit 1
fi

if [[ -z "$GITHUB_TOKEN" ]]; then
    echo "❌ GITHUB_TOKEN environment variable not set"
    echo "   Export your GitHub Personal Access Token:"
    echo "   export GITHUB_TOKEN=<your-token>"
    exit 1
fi

GITHUB_USER=${GITHUB_USER:-nikolay-e}
GITHUB_REPO=${GITHUB_REPO:-lingua-quiz}
BRANCH=${BRANCH:-main}

echo "📋 Configuration:"
echo "   GitHub User: $GITHUB_USER"
echo "   Repository: $GITHUB_REPO"
echo "   Branch: $BRANCH"
echo "   Environment: $ENV"
echo "   Path: ./flux/clusters/$ENV"
echo ""

read -p "Continue with bootstrap? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# Check cluster connection
echo "🔍 Checking Kubernetes cluster connection..."
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster"
    exit 1
fi

CLUSTER_NAME=$(kubectl config current-context)
echo "✅ Connected to cluster: $CLUSTER_NAME"
echo ""

# Bootstrap Flux
echo "🔧 Bootstrapping FluxCD..."
flux bootstrap github \
    --owner="$GITHUB_USER" \
    --repository="$GITHUB_REPO" \
    --branch="$BRANCH" \
    --path="./flux/clusters/$ENV" \
    --personal \
    --token-auth

echo ""
echo "✅ FluxCD bootstrap complete!"
echo ""
echo "📝 Next steps:"
echo "1. Create the GHCR secret:"
echo "   kubectl create secret generic ghcr-secret \\"
echo "     --from-literal=GHCR_TOKEN=<your-ghcr-token> \\"
echo "     -n lingua-quiz-$ENV"
echo ""
echo "2. Check Flux status:"
echo "   flux get all"
echo "   flux get helmreleases -n lingua-quiz-$ENV"
echo ""
echo "3. View logs:"
echo "   flux logs --follow --all-namespaces"
