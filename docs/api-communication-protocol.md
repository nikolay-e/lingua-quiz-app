# LinguaQuiz API Communication Protocol

## Overview

The LinguaQuiz application uses a REST API for communication between the frontend (Svelte) and backend (FastAPI). This document outlines the complete API protocol, including endpoints, request/response formats, and naming conventions.

## Naming Conventions

### Backend Internal Convention
- The backend uses **snake_case** for all internal variable names and database fields
- FastAPI endpoints expect query parameters in snake_case format

### API Response Convention
- All API responses are automatically converted from snake_case to **camelCase** using the `convert_keys_to_camel_case` function
- This ensures frontend compatibility with JavaScript/TypeScript conventions

### Request Body Convention
- Request bodies can use either snake_case or camelCase
- Pydantic models use `Field(alias="camelCase")` to accept camelCase input
- The `populate_by_name = True` config allows both formats

## Authentication

All endpoints except `/api/health`, `/api/auth/register`, and `/api/auth/login` require Bearer token authentication.

**Header format:**
```
Authorization: Bearer <token>
```

## API Endpoints

### 1. Health Check

**Endpoint:** `GET /api/health`  
**Authentication:** Not required  
**Response:**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2024-01-15T10:30:00"
}
```

### 2. User Registration

**Endpoint:** `POST /api/auth/register`  
**Authentication:** Not required  
**Rate Limit:** 100 requests per 15 minutes  
**Request Body:**
```json
{
  "username": "string (3-50 chars)",
  "password": "string (8-128 chars)"
}
```
**Response:**
```json
{
  "token": "jwt_token_string",
  "expiresIn": "24h",
  "user": {
    "id": 123,
    "username": "user123"
  }
}
```

### 3. User Login

**Endpoint:** `POST /api/auth/login`  
**Authentication:** Not required  
**Rate Limit:** 100 requests per 15 minutes  
**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```
**Response:** Same as registration

### 4. Delete Account

**Endpoint:** `DELETE /api/auth/delete-account`  
**Authentication:** Required  
**Response:**
```json
{
  "message": "Account deleted successfully"
}
```

### 5. Get All Word Sets

**Endpoint:** `GET /api/word-sets`  
**Authentication:** Required  
**Response:**
```json
[
  {
    "id": 1,
    "name": "German Russian A1",
    "createdAt": "2024-01-15T10:30:00",
    "updatedAt": "2024-01-15T10:30:00"
  }
]
```

### 6. Get User Word Sets (with Progress)

**Endpoint:** `GET /api/word-sets/user?word_list_name={name}`  
**Authentication:** Required  
**Query Parameters:**
- `word_list_name` (string, required) - Note: Use snake_case in query parameter

**Response:**
```json
[
  {
    "wordPairId": 123,
    "sourceWord": "Haus",
    "targetWord": "дом",
    "sourceLanguage": "German",
    "targetLanguage": "Russian",
    "sourceWordUsageExample": "Das ist ein Haus",
    "targetWordUsageExample": "Это дом",
    "status": "LEVEL_1"
  }
]
```

### 7. Get Specific Word Set with Words

**Endpoint:** `GET /api/word-sets/{word_set_id}`  
**Authentication:** Required  
**Path Parameters:**
- `word_set_id` (integer)

**Response:**
```json
{
  "id": 1,
  "name": "German Russian A1",
  "createdAt": "2024-01-15T10:30:00",
  "updatedAt": "2024-01-15T10:30:00",
  "words": [
    {
      "translationId": 456,
      "sourceWordId": 789,
      "targetWordId": 790,
      "sourceWord": "Haus",
      "targetWord": "дом",
      "sourceLanguage": "German",
      "targetLanguage": "Russian",
      "sourceExample": "Das ist ein Haus",
      "targetExample": "Это дом"
    }
  ]
}
```

### 8. Update User Word Status

**Endpoint:** `POST /api/word-sets/user`  
**Authentication:** Required  
**Request Body:**
```json
{
  "status": "LEVEL_0|LEVEL_1|LEVEL_2|LEVEL_3|LEVEL_4|LEVEL_5",
  "wordPairIds": [123, 456, 789]
}
```
**Response:**
```json
{
  "message": "Updated 3 word sets to LEVEL_1"
}
```

### 9. Synthesize Speech (TTS)

**Endpoint:** `POST /api/tts/synthesize`  
**Authentication:** Required  
**Rate Limit:** 100 requests per minute  
**Request Body:**
```json
{
  "text": "Hello world",
  "language": "German|Russian|Spanish"
}
```
**Response:**
```json
{
  "audioData": "base64_encoded_audio_data",
  "contentType": "audio/mpeg",
  "text": "Hello world",
  "language": "German"
}
```

### 10. Get TTS Languages

**Endpoint:** `GET /api/tts/languages`  
**Authentication:** Required  
**Response:**
```json
{
  "available": true,
  "supportedLanguages": ["German", "Russian", "Spanish"]
}
```

## Error Responses

### Validation Errors (422)
```json
{
  "detail": [
    {
      "loc": ["body", "username"],
      "msg": "String should have at least 3 characters",
      "type": "string_too_short"
    }
  ]
}
```

### Authentication Errors (401)
```json
{
  "detail": "Invalid token"
}
```

### Not Found Errors (404)
```json
{
  "error": "Resource not found"
}
```

### Server Errors (500)
```json
{
  "error": "Internal server error"
}
```

## Level System

The application uses a 6-level mastery system:

- **LEVEL_0**: New/unlearned words
- **LEVEL_1**: Focus pool (max 20 words) - normal direction
- **LEVEL_2**: Reverse direction mastery
- **LEVEL_3**: Normal direction with examples
- **LEVEL_4**: Reverse direction with examples
- **LEVEL_5**: Complete mastery

## Frontend Implementation Notes

1. **Status Conversion**: When the core quiz logic returns numeric levels (0-5), convert them to string format: `LEVEL_${numericLevel}`

2. **Query Parameters**: Use snake_case for query parameters (e.g., `word_list_name`)

3. **Request Bodies**: Use camelCase for request body properties (e.g., `wordPairIds`)

4. **Error Handling**: Always check for both `message` and `detail` properties in error responses

5. **Token Management**: Store JWT tokens securely and include in all authenticated requests

## Example Frontend API Client Usage

```typescript
// Login
const response = await api.login('username', 'password');
const token = response.token;

// Fetch user word sets
const wordSets = await api.fetchUserWordSets(token, 'German Russian A1');

// Update word status
await api.saveWordStatus(token, 'LEVEL_2', [123, 456]);

// Synthesize speech
const tts = await api.synthesizeSpeech(token, 'Hallo', 'German');
const audioBlob = base64ToBlob(tts.audioData, tts.contentType);
```

## Security Considerations

1. **HTTPS Only**: Always use HTTPS in production
2. **Token Expiry**: Tokens expire after 24 hours by default
3. **Rate Limiting**: Respect rate limits on registration, login, and TTS endpoints
4. **CORS**: Backend configured with specific allowed origins
5. **Input Validation**: All inputs are validated by Pydantic models
