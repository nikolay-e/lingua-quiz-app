/**
 * Centralized test data fixtures for use across all tests.
 * Using shared fixtures helps maintain consistency and reduces duplication.
 */

// Basic word pair test data
export const testWordPairs = [
  {
    wordPairId: 1,
    sourceWord: 'hello',
    targetWord: 'hola',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_0',
    sourceWordUsageExample: 'Hello, how are you?',
    targetWordUsageExample: '¿Hola, cómo estás?',
  },
  {
    wordPairId: 2,
    sourceWord: 'goodbye',
    targetWord: 'adiós',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_1',
    sourceWordUsageExample: 'Goodbye, see you later!',
    targetWordUsageExample: '¡Adiós, hasta luego!',
  },
  {
    wordPairId: 3,
    sourceWord: 'thank you',
    targetWord: 'gracias',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_2',
    sourceWordUsageExample: 'Thank you for your help.',
    targetWordUsageExample: 'Gracias por tu ayuda.',
  },
  {
    wordPairId: 4,
    sourceWord: 'please',
    targetWord: 'por favor',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_1',
    sourceWordUsageExample: 'Please, help me.',
    targetWordUsageExample: 'Por favor, ayúdame.',
  },
  {
    wordPairId: 5,
    sourceWord: 'good',
    targetWord: 'bueno',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'LEVEL_3', // Already mastered
    sourceWordUsageExample: 'This is good.',
    targetWordUsageExample: 'Esto es bueno.',
  },
];

// Helper to get fresh copy of test data to avoid contamination across tests
export function getTestWordPairs() {
  return JSON.parse(JSON.stringify(testWordPairs));
}

// Sample word lists (for fetchWordLists tests)
export const testWordLists = [
  { id: 1, name: 'Spanish-English A1' },
  { id: 2, name: 'German-English A1' },
];

// Sample JWT creation function for authentication tests
export function createMockToken(payload = {}, expireInSeconds = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const tokenPayload = {
    exp: Math.floor(Date.now() / 1000) + expireInSeconds,
    userId: 'test-user-id',
    email: 'test@example.com',
    ...payload,
  };
  
  // Base64 encode the parts
  const base64Encode = (obj) => btoa(JSON.stringify(obj));
  const tokenParts = [
    base64Encode(header),
    base64Encode(tokenPayload),
    'signature', // We don't need a real signature for testing
  ];
  
  return tokenParts.join('.');
}

// Function to create an expired token (for testing expiration handling)
export function createExpiredToken(payload = {}) {
  return createMockToken(payload, -3600); // Expired 1 hour ago
}

// Helper to set up authentication state in tests
export function setupAuthState(token = null) {
  const testToken = token || createMockToken();
  localStorage.setItem('token', testToken);
  localStorage.setItem('email', 'test@example.com');
  return testToken;
}

// Sample API responses for fetch mocks
export const apiResponses = {
  login: {
    success: {
      token: createMockToken(),
    },
    invalidCredentials: {
      message: 'Invalid credentials',
      status: 401,
    },
    serverError: {
      message: 'Server error',
      status: 500,
    },
  },
  wordSets: {
    valid: testWordPairs,
    invalid: [
      { sourceWord: 'invalid' }, // Missing required fields
      'not an object',
    ],
    empty: [],
  },
};

// Common DOM elements for auth tests
export function setupAuthTestDOM() {
  document.body.innerHTML = `
    <div id="user-status">
      <div class="user-actions">
        <button id="login-logout-btn">Login</button>
        <button id="delete-account-btn" style="display: none;">Delete</button>
      </div>
    </div>
    <form id="login-form">
      <div class="input-group"><input id="email" type="email"></div>
      <div class="input-group"><input id="password" type="password"></div>
      <div id="login-message"></div>
      <button type="submit">Login</button>
    </form>
    <div id="error-container"></div>
  `;
}