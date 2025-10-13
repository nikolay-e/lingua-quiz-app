# FluxCD GitOps Setup

This directory contains the FluxCD configuration for continuous deployment of LinguaQuiz to Kubernetes.

## Architecture

```
flux/
├── clusters/
│   ├── production/
│   │   ├── infrastructure/  # Namespaces, secrets, etc.
│   │   └── apps/           # Application HelmReleases
│   └── staging/
│       ├── infrastructure/
│       └── apps/
```

## Prerequisites

1. **Kubernetes cluster** with kubectl access
2. **FluxCD CLI** installed:
   ```bash
   brew install fluxcd/tap/flux
   ```
3. **GitHub Personal Access Token** with repo permissions
4. **GHCR Token** (GitHub Container Registry) for pulling images

## Bootstrap FluxCD

### 1. Export Environment Variables

```bash
export GITHUB_TOKEN=<your-github-pat>
export GITHUB_USER=nikolay-e
export GITHUB_REPO=lingua-quiz
```

### 2. Bootstrap Production Cluster

```bash
flux bootstrap github \
  --owner=$GITHUB_USER \
  --repository=$GITHUB_REPO \
  --branch=main \
  --path=./flux/clusters/production \
  --personal \
  --token-auth
```

### 3. Bootstrap Staging Cluster (Optional)

```bash
flux bootstrap github \
  --owner=$GITHUB_USER \
  --repository=$GITHUB_REPO \
  --branch=main \
  --path=./flux/clusters/staging \
  --personal \
  --token-auth
```

### 4. Create GitHub Container Registry Secret

After bootstrap, create the GHCR secret in your cluster:

```bash
# For production
kubectl create secret generic ghcr-secret \
  --from-literal=GHCR_TOKEN=<your-ghcr-token> \
  -n lingua-quiz-production

# For staging
kubectl create secret generic ghcr-secret \
  --from-literal=GHCR_TOKEN=<your-ghcr-token> \
  -n lingua-quiz-staging
```

Or use SOPS to encrypt the secret:

```bash
# Create a Kubernetes secret with SOPS
cat <<EOF | sops -e /dev/stdin > flux/clusters/production/infrastructure/ghcr-secret-encrypted.yaml
apiVersion: v1
kind: Secret
metadata:
  name: ghcr-secret
  namespace: lingua-quiz-production
type: kubernetes.io/dockerconfigjson
stringData:
  .dockerconfigjson: |
    {
      "auths": {
        "ghcr.io": {
          "username": "nikolay-e",
          "password": "<your-ghcr-token>",
          "auth": "$(echo -n 'nikolay-e:<your-ghcr-token>' | base64)"
        }
      }
    }
EOF
```

## How It Works

### Image Updates

Flux automatically monitors the GitHub Container Registry for new images:

1. **CI Pipeline** builds and pushes images to GHCR with tags:
   - PRs: `pr-{PR_NUMBER}-{SHORT_SHA}-{TIMESTAMP}` (e.g., `pr-123-abc1234-1234567890`)
   - Main: `main-{SHORT_SHA}-{TIMESTAMP}` (e.g., `main-abc1234-1234567890`)
2. **ImageRepository** scans GHCR every minute for new images
3. **ImagePolicy** selects the latest image based on the tag pattern:
   - **Staging**: Deploys latest PR images automatically
   - **Production**: Deploys latest main branch images automatically
4. **HelmRelease** deploys the new version to Kubernetes
5. **Automatic rollback** on deployment failure

### Manual Reconciliation

Force Flux to check for updates:

```bash
# Reconcile specific resources
flux reconcile source git lingua-quiz-repo
flux reconcile kustomization lingua-quiz-production
flux reconcile helmrelease lingua-quiz -n lingua-quiz-production

# Reconcile everything
flux reconcile kustomization --with-source
```

### Monitoring

Check the status of Flux resources:

```bash
# Check all Flux resources
flux get all

# Check specific resource types
flux get sources git
flux get kustomizations
flux get helmreleases -n lingua-quiz-production
flux get images all -n lingua-quiz-production

# View logs
flux logs --follow --all-namespaces
```

## Troubleshooting

### Images Not Updating

```bash
# Check ImageRepository status
flux get image repository -n lingua-quiz-production

# Check ImagePolicy
flux get image policy -n lingua-quiz-production

# Verify secret
kubectl get secret ghcr-secret -n lingua-quiz-production
```

### HelmRelease Failing

```bash
# Check HelmRelease status
kubectl get helmrelease lingua-quiz -n lingua-quiz-production -o yaml

# View Helm release history
helm list -n lingua-quiz-production
helm history lingua-quiz -n lingua-quiz-production
```

### Force Reconciliation

```bash
# Suspend and resume to force recon ciliation
flux suspend helmrelease lingua-quiz -n lingua-quiz-production
flux resume helmrelease lingua-quiz -n lingua-quiz-production
```

## Updating the Configuration

1. Make changes to files in `flux/clusters/{production,staging}/`
2. Commit and push to the `main` branch
3. Flux will automatically apply changes within 1-5 minutes
4. Or force immediate reconciliation:
   ```bash
   flux reconcile kustomization lingua-quiz-production
   ```

## Security Notes

- The `ghcr-secret` contains credentials for pulling images from GHCR
- Consider using SOPS to encrypt secrets in Git
- Use separate tokens for production and staging
- Rotate tokens regularly

## Migration from GitHub Actions

The previous CD pipeline in `.github/workflows/ci-cd.yml` has been removed. The CI pipeline still:

- Runs tests
- Builds Docker images
- Pushes images to GHCR

FluxCD now handles:

- Monitoring for new images
- Deploying to Kubernetes
- Managing Helm releases
- Automated rollbacks on failure
