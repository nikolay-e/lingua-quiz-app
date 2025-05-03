// Import the enhanced expect from our setup
const expect = require('../setup');
const errorHandler = require('../../../src/middleware/errorHandler');
const {
  DatabaseError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError,
} = require('../../../src/utils/errors');

describe('Error Handler Middleware', () => {
  let req, res, jsonSpy, statusSpy, nextSpy;

  beforeEach(() => {
    // Create mock request and response objects
    req = {
      originalUrl: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
    };

    // Create mock functions manually instead of using jest.fn()
    jsonSpy = function mockJsonFn() {
      mockJsonFn.mock.calls.push(Array.from(arguments));
      return mockJsonFn.mockReturnValue;
    };
    jsonSpy.mock = { calls: [] };
    jsonSpy.mockReturnValue = undefined;

    statusSpy = function mockStatusFn() {
      mockStatusFn.mock.calls.push(Array.from(arguments));
      return { json: jsonSpy };
    };
    statusSpy.mock = { calls: [] };

    res = {
      status: statusSpy,
      json: jsonSpy,
    };

    nextSpy = function mockNextFn() {
      mockNextFn.mock.calls.push(Array.from(arguments));
    };
    nextSpy.mock = { calls: [] };

    // Store original NODE_ENV
    process.env.originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = process.env.originalNodeEnv;
    delete process.env.originalNodeEnv;
  });

  it('should handle ValidationError with 400 status code', () => {
    const validationErrors = [{ field: 'email', message: 'Invalid email' }];
    const error = new ValidationError('Validation failed', validationErrors);
    
    errorHandler(error, req, res, nextSpy);
    
    // Verify status was called with 400
    expect(statusSpy.mock.calls.length).to.equal(1);
    expect(statusSpy.mock.calls[0][0]).to.equal(400);
    
    // Verify json was called with expected structure
    expect(jsonSpy.mock.calls.length).to.be.at.least(1);
    const jsonArg = jsonSpy.mock.calls[0][0];
    expect(jsonArg.message).to.equal('Invalid request data.');
    expect(jsonArg.error.message).to.equal('Validation failed');
    expect(jsonArg.error.errors).to.deep.equal(validationErrors);
  });

  it('should handle AuthenticationError with 401 status code', () => {
    const error = new AuthenticationError('Invalid token');
    
    errorHandler(error, req, res, nextSpy);
    
    // Verify status was called with 401
    expect(statusSpy.mock.calls.length).to.equal(1);
    expect(statusSpy.mock.calls[0][0]).to.equal(401);
    
    // Verify json was called with expected structure
    expect(jsonSpy.mock.calls.length).to.be.at.least(1);
    const jsonArg = jsonSpy.mock.calls[0][0];
    expect(jsonArg.message).to.equal('Authentication failed.');
    expect(jsonArg.error.message).to.equal('Invalid token');
  });

  it('should handle NotFoundError with 404 status code', () => {
    const error = new NotFoundError('User not found');
    
    errorHandler(error, req, res, nextSpy);
    
    // Verify status was called with 404
    expect(statusSpy.mock.calls.length).to.equal(1);
    expect(statusSpy.mock.calls[0][0]).to.equal(404);
    
    // Verify json was called with expected structure
    expect(jsonSpy.mock.calls.length).to.be.at.least(1);
    const jsonArg = jsonSpy.mock.calls[0][0];
    expect(jsonArg.message).to.equal('The requested resource was not found.');
    expect(jsonArg.error.message).to.equal('User not found');
  });

  it('should handle generic errors with 500 status code', () => {
    const error = new Error('Unexpected error');
    
    errorHandler(error, req, res, nextSpy);
    
    // Verify status was called with 500
    expect(statusSpy.mock.calls.length).to.equal(1);
    expect(statusSpy.mock.calls[0][0]).to.equal(500);
    
    // Verify json was called with expected structure
    expect(jsonSpy.mock.calls.length).to.be.at.least(1);
    const jsonArg = jsonSpy.mock.calls[0][0];
    expect(jsonArg.message).to.equal('An internal server error occurred.');
    expect(jsonArg.error.message).to.equal('Unexpected error');
  });
});