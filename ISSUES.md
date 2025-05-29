# Known Issues and Improvements

This document tracks known issues, bugs, and potential improvements for the LinguaQuiz application.

## Authentication & User Experience

### 1. Redundant Login After Registration (High Priority)
**Issue:** After successful registration, users are redirected to the login page and forced to enter their credentials again.

**Current Behavior:**
- User registers with email/password
- Backend creates account AND returns JWT token in response
- Frontend ignores the token, shows "Registration successful" message
- After 2 seconds, redirects to login page
- User must enter the same credentials again

**Expected Behavior:**
- After successful registration, the user should be automatically logged in
- The JWT token returned by the backend should be saved and used
- User should be directed straight to the Quiz view

**Technical Details:**
- Backend endpoint `/api/auth/register` already returns a token
- Frontend `Register.svelte` component discards this token
- Same token-saving logic from `Login.svelte` should be applied to registration


### 5. Overwhelming Password Requirements (Low Priority)
**Issue:** Registration shows 5 separate password requirements which may feel excessive.

**Current Requirements:**
- At least 8 characters long
- Contains at least one uppercase letter
- Contains at least one lowercase letter
- Contains at least one number
- Contains at least one special character

**Potential Improvements:**
- Consider reducing requirements
- Add visual password strength meter
- Group related requirements for cleaner UI


*Last Updated: May 30, 2025*