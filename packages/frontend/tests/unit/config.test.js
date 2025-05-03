describe('Frontend Config', () => {
  let originalApiUrl; // Store original window value
  let originalLocation; // Store original window.location

  beforeEach(() => {
    // Reset modules before each test to ensure config.js is re-evaluated
    jest.resetModules();

    // Store original values before mocking
    originalApiUrl = window.linguaQuizApiUrl;
    originalLocation = window.location;

    // Create a proper location mock
    delete window.location;
    window.location = {
      hostname: 'localhost',
      port: '8080',
      href: 'http://localhost:8080/',
      pathname: '/',
      origin: 'http://localhost:8080',
      search: '',
      hash: '',
    };

    // Clear window.linguaQuizApiUrl before each test
    delete window.linguaQuizApiUrl;
  });

  afterEach(() => {
    // Restore original values after each test
    window.linguaQuizApiUrl = originalApiUrl;
    window.location = originalLocation;
  });

  test('should use injected API URL when available', async () => {
    const expectedUrl = 'https://injected.example.com/api';
    window.linguaQuizApiUrl = expectedUrl; // Set the global variable *before* importing

    const config = await import('../../src/js/config.js');
    expect(config.default).toBe(expectedUrl);
  });

  test('should use fallback for localhost:8080 when injected URL is placeholder', async () => {
    window.linguaQuizApiUrl = '${API_URL}'; // Simulate placeholder remaining

    // Location already set in beforeEach

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const config = await import('../../src/js/config.js');

    expect(config.default).toBe('http://localhost:9000');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Falling back to hostname/port detection')
    );

    consoleWarnSpy.mockRestore();
  });

  test('should use fallback for test domain when injected URL is undefined', async () => {
    delete window.linguaQuizApiUrl; // Ensure undefined

    // Update location mock for test domain
    window.location.hostname = 'test-lingua-quiz.nikolay-eremeev.com';
    window.location.port = '443';

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const config = await import('../../src/js/config.js');

    expect(config.default).toBe('https://test-api-lingua-quiz.nikolay-eremeev.com');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Falling back to hostname/port detection')
    );

    consoleWarnSpy.mockRestore();
  });

  test('should use fallback for prod domain when injected URL is undefined', async () => {
    delete window.linguaQuizApiUrl; // Ensure undefined

    // Update location mock for prod domain
    window.location.hostname = 'lingua-quiz.nikolay-eremeev.com';
    window.location.port = '443';

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const config = await import('../../src/js/config.js');

    expect(config.default).toBe('https://api-lingua-quiz.nikolay-eremeev.com');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Falling back to hostname/port detection')
    );

    consoleWarnSpy.mockRestore();
  });

  test('should use final fallback when injection fails and hostname is unknown', async () => {
    delete window.linguaQuizApiUrl; // Ensure undefined

    // Update location mock for unknown domain
    window.location.hostname = 'unknown.host';
    window.location.port = '80';

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const config = await import('../../src/js/config.js');

    expect(config.default).toBe('http://localhost:9000'); // The final fallback
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Falling back to hostname/port detection')
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Fallback: Could not determine API URL')
    );

    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('should handle case where window.linguaQuizApiUrl is explicitly null', async () => {
    window.linguaQuizApiUrl = null;

    // Update location mock for unknown domain
    window.location.hostname = 'unknown.host';
    window.location.port = '80';

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    const config = await import('../../src/js/config.js');

    expect(config.default).toBe('http://localhost:9000'); // Should use fallback
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Falling back to hostname/port detection')
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Fallback: Could not determine API URL')
    );

    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
