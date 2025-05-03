// Import the enhanced expect from our setup
const expect = require('./setup');
const {
  DatabaseError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError
} = require('../../src/utils/errors');

describe('Error Classes', () => {
  describe('DatabaseError', () => {
    it('should have correct name and status code', () => {
      const error = new DatabaseError('Database connection failed');
      expect(error.name).to.equal('DatabaseError');
      expect(error.message).to.equal('Database connection failed');
      expect(error.statusCode).to.equal(500);
    });

    it('should store original error', () => {
      const originalError = new Error('Original error');
      const dbError = new DatabaseError('Wrapper message', originalError);
      expect(dbError.originalError).to.equal(originalError);
    });
  });

  describe('AuthenticationError', () => {
    it('should have correct name and status code', () => {
      const error = new AuthenticationError('Invalid credentials');
      expect(error.name).to.equal('AuthenticationError');
      expect(error.message).to.equal('Invalid credentials');
      expect(error.statusCode).to.equal(401);
    });
  });

  describe('AuthorizationError', () => {
    it('should have correct name and status code', () => {
      const error = new AuthorizationError('Insufficient permissions');
      expect(error.name).to.equal('AuthorizationError');
      expect(error.message).to.equal('Insufficient permissions');
      expect(error.statusCode).to.equal(403);
    });
  });

  describe('ValidationError', () => {
    it('should have correct name and status code', () => {
      const validationErrors = [
        { field: 'email', message: 'Email is required' }
      ];
      const error = new ValidationError('Validation failed', validationErrors);
      expect(error.name).to.equal('ValidationError');
      expect(error.message).to.equal('Validation failed');
      expect(error.statusCode).to.equal(400);
      expect(error.errors).to.deep.equal(validationErrors);
    });
  });

  describe('NotFoundError', () => {
    it('should have correct name and status code', () => {
      const error = new NotFoundError('User not found');
      expect(error.name).to.equal('NotFoundError');
      expect(error.message).to.equal('User not found');
      expect(error.statusCode).to.equal(404);
    });
  });

  describe('ConflictError', () => {
    it('should have correct name and status code', () => {
      const error = new ConflictError('Email already exists');
      expect(error.name).to.equal('ConflictError');
      expect(error.message).to.equal('Email already exists');
      expect(error.statusCode).to.equal(409);
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should have correct name and status code', () => {
      const error = new ServiceUnavailableError('Service is down for maintenance');
      expect(error.name).to.equal('ServiceUnavailableError');
      expect(error.message).to.equal('Service is down for maintenance');
      expect(error.statusCode).to.equal(503);
    });

    it('should store original error', () => {
      const originalError = new Error('Original error');
      const serviceError = new ServiceUnavailableError('Service unavailable', originalError);
      expect(serviceError.originalError).to.equal(originalError);
    });
  });
});