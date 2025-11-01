# Remaining TODO - LinguaQuiz App

## Completed ✅

### 1. Repository Rename from lingua-quiz-app to lingua-quiz

- ✅ Updated .github/workflows/preview-deploy.yml (repo name and image paths)
- ✅ Updated .github/workflows/promote-production.yml (image paths)
- ✅ Updated Makefile (helm directory path)
- ✅ Updated .secrets.baseline (helm directory path)
- ✅ Updated git remote URL
- ✅ Fixed README.md formatting (removed test comments)
- ✅ All pre-commit checks passing

## High Priority

### 1. Test PR #254 Pre-commit Status

- **Status**: ✅ README.md formatting fixed
- **Next**: Push changes and verify pre-commit passes
- **Branch**: `test-preview-1761997513`
- **PR**: #254

### 2. Test Preview Environment End-to-End

- **Status**: Preview pods are now running but not fully tested
- **Current state**:
  - Frontend: 1/1 Running
  - Backend: Starting up (was 0/1 Running)
  - Image fix applied and working
- **Actions**:
  - Verify backend becomes Ready
  - Test accessing preview URL: https://246.lingua-quiz.nikolay-eremeev.com
  - Verify database migrations run successfully
  - Test that new PRs automatically trigger preview deployments
  - Test preview cleanup when PR is closed

## Medium Priority

### 3. Merge Preview Workflow Fix to Main

- **Status**: Fix committed to test branch, needs merge
- **File**: `.github/workflows/preview-deploy.yml`
- **Change**: Added image repository to preview values.yaml generation
- **Action**: Merge `test-preview-1761997513` into main after CI passes

### 4. Update Documentation

- **Files to update**:
  - `README.md` - Add preview environment documentation
  - Update deployment workflow documentation
- **Content**:
  - How preview environments work
  - How to trigger preview deployments
  - Preview environment URL pattern
  - Cleanup process

## Low Priority

### 5. Monitor Dependabot PRs

- **Status**: Multiple Dependabot PRs exist (237-242)
- **Action**: Review and merge dependency updates
- **Note**: Auto-merge workflow should handle these

## Notes

### Preview Environment Status

✅ **FIXED**: ApplicationSet authentication to private gitops repo
✅ **FIXED**: Preview secrets added to values.preview.yaml
✅ **FIXED**: Image repository missing from preview values
✅ **WORKING**: Preview pods are now starting correctly

### Environment Health Summary

- **Staging**: ✅ Healthy (2/2 pods running)
- **Production**: ❌ Needs secrets configuration (see gitops repo TODO)
- **Preview PR-246**: ✅ Running (frontend ready, backend starting)
