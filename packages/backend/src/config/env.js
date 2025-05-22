/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/config/env.js
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Environment variable schema validator and parser
 */
class EnvironmentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.values = {};
  }

  /**
   * Validate a required environment variable
   */
  required(name, parser = (val) => val) {
    const value = process.env[name];

    if (value === undefined || value === '') {
      this.errors.push(`Missing required environment variable: ${name}`);
      return this;
    }

    try {
      this.values[name] = parser(value);
    } catch (error) {
      this.errors.push(`Invalid value for ${name}: ${error.message}`);
    }

    return this;
  }

  /**
   * Validate an optional environment variable with default value
   */
  optional(name, defaultValue, parser = (val) => val) {
    const value = process.env[name];

    if (value === undefined || value === '') {
      this.values[name] = defaultValue;
      return this;
    }

    try {
      this.values[name] = parser(value);
    } catch (error) {
      this.warnings.push(`Invalid value for ${name}, using default: ${error.message}`);
      this.values[name] = defaultValue;
    }

    return this;
  }

  /**
   * Validate a number environment variable
   */
  number(name, defaultValue, min, max) {
    const parser = (val) => {
      const num = Number(val);

      if (Number.isNaN(num)) {
        throw new TypeError(`${val} is not a number`);
      }

      if (min !== undefined && num < min) {
        throw new Error(`${num} is less than minimum value ${min}`);
      }

      if (max !== undefined && num > max) {
        throw new Error(`${num} is greater than maximum value ${max}`);
      }

      return num;
    };

    return defaultValue === undefined ? this.required(name, parser) : this.optional(name, defaultValue, parser);
  }

  /**
   * Validate an enum environment variable
   */
  enum(name, allowedValues, defaultValue) {
    const parser = (val) => {
      if (!allowedValues.includes(val)) {
        throw new Error(`${val} is not one of the allowed values: ${allowedValues.join(', ')}`);
      }
      return val;
    };

    return defaultValue === undefined ? this.required(name, parser) : this.optional(name, defaultValue, parser);
  }

  /**
   * Validate a boolean environment variable
   */
  boolean(name, defaultValue) {
    const parser = (val) => {
      const normalized = val.toLowerCase();
      if (['true', 't', 'yes', 'y', '1'].includes(normalized)) {
        return true;
      }
      if (['false', 'f', 'no', 'n', '0'].includes(normalized)) {
        return false;
      }
      throw new Error(`${val} is not a valid boolean value`);
    };

    return defaultValue === undefined ? this.required(name, parser) : this.optional(name, defaultValue, parser);
  }

  /**
   * Validate a URL environment variable
   */
  url(name, defaultValue) {
    const parser = (val) => {
      try {
        // Use the constructor without assigning to a variable
        URL.prototype.constructor.call(Object.create(URL.prototype), val);
        return val;
      } catch {
        throw new Error(`${val} is not a valid URL`);
      }
    };

    return defaultValue === undefined ? this.required(name, parser) : this.optional(name, defaultValue, parser);
  }

  /**
   * Get the final environment configuration
   */
  validate(throwOnError = true) {
    if (throwOnError && this.errors.length > 0) {
      throw new Error(`Environment validation failed:\n  - ${this.errors.join('\n  - ')}`);
    }

    return {
      errors: this.errors,
      values: this.values,
      warnings: this.warnings,
    };
  }
}

// Skip validation in test mode
const isTestMode = process.env.NODE_ENV === 'test';

// Create and configure environment validator
const validator = new EnvironmentValidator();

// Server configuration
validator
  .optional('NODE_ENV', 'development', (val) => val)
  .number('PORT', 3000, 1, 65_535)
  .optional('LOG_LEVEL', 'info')
  .optional('CORS_ALLOWED_ORIGINS', 'http://localhost:8080', (val) => val.split(',').map((origin) => origin.trim()));

// Database configuration
if (!isTestMode) {
  validator.required('DB_HOST').required('POSTGRES_DB').required('POSTGRES_USER').required('POSTGRES_PASSWORD');
}

validator
  .number('DB_PORT', 5432, 1, 65_535)
  .number('DB_POOL_MAX', 10, 1, 100)
  .number('DB_POOL_CONN_TIMEOUT', 2000, 100, 60_000)
  .number('DB_POOL_IDLE_TIMEOUT', 30_000, 1000, 3_600_000);

// Authentication
if (!isTestMode) {
  validator.required('JWT_SECRET', (val) => {
    // Always enforce minimum JWT secret length for security
    // Short JWT secrets are vulnerable to brute force attacks
    if (val.length < 32) {
      if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
        throw new Error(`JWT_SECRET is too short (${val.length} chars). Must be at least 32 characters long for security.`);
      } else {
        // In development, allow weak secrets but show warning
        validator.warnings.push('JWT_SECRET should be at least 32 characters long for security');
      }
    }

    // Check for use of default/placeholder values
    if (val === '<JWT_SECRET>' || val === 'your_jwt_secret_here' || val === 'secret' || val === 'changeme') {
      throw new Error('JWT_SECRET is using a default or placeholder value. Please set a secure random value.');
    }

    return val;
  });
}

validator.optional('JWT_EXPIRES_IN', '1h').number('BCRYPT_SALT_ROUNDS', 10, 4, 16);

// Validate environment
const envConfig = validator.validate(!isTestMode);

// Log warnings in non-production environments
if (envConfig.warnings.length > 0 && process.env.NODE_ENV !== 'production') {
  console.warn('Environment configuration warnings:');

  envConfig.warnings.forEach((warning) => console.warn(`  - ${warning}`));
}

// Export all environment values
export const {
  BCRYPT_SALT_ROUNDS,
  CORS_ALLOWED_ORIGINS,
  DB_HOST,
  DB_POOL_CONN_TIMEOUT,
  DB_POOL_IDLE_TIMEOUT,
  DB_POOL_MAX,
  DB_PORT,
  JWT_EXPIRES_IN,
  JWT_SECRET,
  LOG_LEVEL,
  NODE_ENV,
  PORT,
  POSTGRES_DB,
  POSTGRES_PASSWORD,
  POSTGRES_USER,
} = envConfig.values;

// Export a function to validate the environment
export function validateEnvironment() {
  const result = validator.validate(!isTestMode);

  if (result.errors && result.errors.length > 0) {
    throw new Error(`Environment validation failed:\n  - ${result.errors.join('\n  - ')}`);
  }

  if (result.warnings && result.warnings.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn('Environment configuration warnings:');
    result.warnings.forEach((warning) => console.warn(`  - ${warning}`));
  }

  return result.values;
}
