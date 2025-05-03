// Import the enhanced expect from our setup
const expect = require('./setup');
const { validateEnvironment, STATUS } = require('../../src/config');

describe('Config Module', () => {
  describe('STATUS constants', () => {
    it('should define learning status constants', () => {
      expect(STATUS.LEVEL_0).to.equal('LEVEL_0');
      expect(STATUS.LEVEL_1).to.equal('LEVEL_1');
      expect(STATUS.LEVEL_2).to.equal('LEVEL_2');
      expect(STATUS.LEVEL_3).to.equal('LEVEL_3');
      expect(STATUS.LEVEL_4).to.equal('LEVEL_4');
      expect(STATUS.LEVEL_5).to.equal('LEVEL_5');
    });

    it('should define mastery status constants', () => {
      expect(STATUS.LEARNING).to.equal('learning');
      expect(STATUS.LEARNED).to.equal('learned');
      expect(STATUS.REFRESHING).to.equal('refreshing');
    });
  });

  describe('validateEnvironment', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      // Set test environment to bypass validation
      process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
      // Restore original environment variables
      process.env = { ...originalEnv };
    });

    it('should not throw an error in test environment', () => {
      expect(() => validateEnvironment()).not.to.throw();
    });

    it('should not throw in test mode regardless of env variables', () => {
      process.env.NODE_ENV = 'test';
      // Clear required environment variables
      delete process.env.PORT;
      delete process.env.DB_HOST;
      delete process.env.POSTGRES_DB;

      // This should not throw in test mode
      expect(() => validateEnvironment()).not.to.throw();
    });
  });
});
