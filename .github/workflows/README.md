# GitHub Actions Workflows

This directory contains CI/CD workflows for the Lingua Quiz application.

## Workflows

### CI (`ci.yml`)
Main CI workflow that runs on push and pull requests:
- Runs pre-commit hooks
- Builds Docker images for backend, frontend, and integration tests
- Tags images with:
  - `pr-<PR_NUMBER>-<SHA>-<TIMESTAMP>` for pull requests
  - `main-<SHA>-<TIMESTAMP>` for main branch
  - `<COMMIT_SHA>` for all commits
- Runs integration tests

### Preview Environment Deploy (`preview-deploy.yml`)
Automatically deploys preview environments for each pull request:
- Triggers on PR opened, synchronized, or reopened
- Creates a dedicated namespace `preview-pr-<NUMBER>`
- Deploys the application with PR-specific configuration
- Preview URL: `https://<PR_NUMBER>.lingua-quiz.nikolay-eremeev.com`
- Automatically copies GHCR registry secret from staging
- Posts deployment status as PR comment

### Preview Environment Cleanup (`preview-cleanup.yml`)
Automatically cleans up preview environments when PRs are closed:
- Removes preview environment namespace and resources
- Cleans up GitOps repository configuration
- Posts cleanup status as PR comment

### Dependabot Auto-merge (`dependabot-automerge.yml`)
Automatically merges Dependabot PRs that pass CI checks.

## Setup Requirements

### GitHub Secrets

The preview environment workflows require the following GitHub secret:

#### `GITOPS_PAT`
A Personal Access Token (PAT) with write access to the GitOps repository.

**How to create:**
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Name it: `lingua-quiz-gitops-access`
4. Set expiration as needed (recommend 90 days with renewal reminders)
5. Select scopes:
   - `repo` (Full control of private repositories)
6. Click "Generate token"
7. Copy the token (you won't see it again!)
8. Add it to repository secrets:
   - Go to Repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `GITOPS_PAT`
   - Value: Paste the token
   - Click "Add secret"

## Preview Environments

### How It Works

1. **On PR Creation/Update:**
   - CI workflow builds and pushes Docker images
   - Preview deploy workflow generates Kubernetes manifests
   - Manifests are committed to the GitOps repository
   - Flux CD detects changes and deploys to cluster
   - A Kubernetes Job automatically copies registry secrets
   - Preview environment becomes available at `https://<PR_NUMBER>.lingua-quiz.nikolay-eremeev.com`

2. **On PR Update:**
   - New images are built with updated code
   - Preview environment configuration is updated
   - Flux CD pulls changes and updates the deployment

3. **On PR Close:**
   - Cleanup workflow removes GitOps configuration
   - Flux CD detects removal and tears down resources
   - Namespace and all resources are deleted

### Resource Limits

Preview environments use optimized resource limits:
- **Backend:** 50m CPU / 128Mi memory (requests), 250m CPU / 384Mi memory (limits)
- **Frontend:** 25m CPU / 128Mi memory (requests), 50m CPU / 196Mi memory (limits)
- **Migrations:** 25m CPU / 64Mi memory (requests), 100m CPU / 256Mi memory (limits)

These limits allow for approximately 10 concurrent preview environments on a standard cluster.

### Database

Each preview environment gets its own database on the shared PostgreSQL instance:
- Database name: `linguaquiz_pr_<PR_NUMBER>`
- Migrations run automatically on deployment
- Database is cleaned up when PR is closed

### SSL Certificates

SSL certificates are automatically provisioned using cert-manager and Let's Encrypt:
- Certificate issuer: `letsencrypt-prod`
- Certificate secret: `preview-pr-<NUMBER>-tls`
- Initial certificate generation may take 1-2 minutes

### Monitoring Preview Environments

List all preview environments:
```bash
kubectl get namespaces -l preview-env=true
```

Check status of a specific preview:
```bash
kubectl get all -n preview-pr-<NUMBER>
```

View Flux reconciliation status:
```bash
flux get kustomizations -n flux-system | grep preview-pr
```

### Manual Operations

If needed, you can manually manage preview environments using kubectl:

**Copy GHCR secret (usually automated):**
```bash
kubectl get secret ghcr-secret -n lingua-quiz-staging -o yaml | \
  sed 's/namespace: lingua-quiz-staging/namespace: preview-pr-<NUMBER>/' | \
  kubectl apply -f -
```

**Force Flux reconciliation:**
```bash
flux reconcile kustomization preview-pr-<NUMBER>-infrastructure
flux reconcile kustomization preview-pr-<NUMBER>-apps
```

**Manually delete a preview environment:**
```bash
kubectl delete namespace preview-pr-<NUMBER>
# Remove from gitops repo:
cd ../lingua-quiz-gitops
rm -rf clusters/preview-pr-<NUMBER>
git add -A && git commit -m "Remove preview PR <NUMBER>" && git push
```

## Troubleshooting

### Preview environment not deploying

1. Check GitHub Actions workflow status
2. Check Flux reconciliation:
   ```bash
   flux get kustomizations -n flux-system
   ```
3. Check HelmRelease status:
   ```bash
   kubectl get helmrelease -n preview-pr-<NUMBER>
   ```
4. Check pod status:
   ```bash
   kubectl get pods -n preview-pr-<NUMBER>
   kubectl logs -n preview-pr-<NUMBER> <POD_NAME>
   ```

### SSL certificate not provisioning

Check cert-manager status:
```bash
kubectl get certificate -n preview-pr-<NUMBER>
kubectl describe certificate preview-pr-<NUMBER>-tls -n preview-pr-<NUMBER>
```

### Images not pulling

Verify the GHCR secret was copied:
```bash
kubectl get secret ghcr-secret -n preview-pr-<NUMBER>
```

If not, check the copy job:
```bash
kubectl get jobs -n preview-pr-<NUMBER>
kubectl logs -n preview-pr-<NUMBER> job/copy-ghcr-secret
```
