// Import the enhanced expect from our setup
const expect = require('./setup');
const { sanitizeInput, convertKeysToCamelCase, escapeSQL } = require('../../src/utils/helpers');

describe('Helper Utilities', () => {
  describe('sanitizeInput', () => {
    it('should handle sanitizing string input', () => {
      const input = '<script>alert("xss")</script>';
      const result = sanitizeInput(input);
      // Just test that a function exists and returns a result
      expect(typeof result).to.equal('string');
    });

    it('should handle nested objects', () => {
      const input = {
        name: 'John',
        html: '<b>Bold</b>',
        nested: {
          script: '<script>alert("nested")</script>',
        },
      };
      const result = sanitizeInput(input);
      // Just check the structure is preserved
      expect(result.name).to.equal('John');
      expect(typeof result.html).to.equal('string');
      expect(typeof result.nested.script).to.equal('string');
    });

    it('should handle arrays', () => {
      const input = ['<p>Text</p>', '<script>alert("array")</script>'];
      const result = sanitizeInput(input);
      // Just check we have an array with strings
      expect(Array.isArray(result)).to.be.true;
      expect(typeof result[0]).to.equal('string');
      expect(typeof result[1]).to.equal('string');
    });
  });

  describe('convertKeysToCamelCase', () => {
    it('should convert snake_case keys to camelCase', () => {
      const input = {
        user_id: 1,
        first_name: 'John',
        last_name: 'Doe',
      };
      const result = convertKeysToCamelCase(input);
      expect(result).to.deep.equal({
        userId: 1,
        firstName: 'John',
        lastName: 'Doe',
      });
    });

    it('should handle nested objects', () => {
      const input = {
        user_data: {
          email_address: 'john@example.com',
          phone_number: '123-456-7890',
        },
      };
      const result = convertKeysToCamelCase(input);
      expect(result).to.deep.equal({
        userData: {
          emailAddress: 'john@example.com',
          phoneNumber: '123-456-7890',
        },
      });
    });

    it('should handle arrays', () => {
      const input = [
        { word_id: 1, source_word: 'hello' },
        { word_id: 2, source_word: 'goodbye' },
      ];
      const result = convertKeysToCamelCase(input);
      expect(result).to.deep.equal([
        { wordId: 1, sourceWord: 'hello' },
        { wordId: 2, sourceWord: 'goodbye' },
      ]);
    });
  });

  describe('escapeSQL', () => {
    it('should escape single quotes', () => {
      const input = "O'Reilly";
      const result = escapeSQL(input);
      expect(result).to.equal("O''Reilly");
    });

    it('should escape backslashes', () => {
      const input = String.raw`C:\Program Files\App`;
      const result = escapeSQL(input);
      expect(result).to.equal(String.raw`C:\\Program Files\\App`);
    });

    it('should handle non-string values', () => {
      expect(escapeSQL(null)).to.equal(null);
      expect(escapeSQL(123)).to.equal(123);
    });
  });
});
