// Set up Jest mock functions to work with Chai expect
const chai = require('chai');

// Add Jest mock function compatibility to Chai
chai.use(function (_chai) {
  const Assertion = _chai.Assertion;

  Assertion.addMethod('called', function () {
    const obj = this._obj;
    this.assert(
      obj.mock.calls.length > 0,
      'expected function to have been called at least once',
      'expected function to not have been called'
    );
  });

  Assertion.addMethod('calledOnce', function () {
    const obj = this._obj;
    this.assert(
      obj.mock.calls.length === 1,
      'expected function to have been called exactly once but was called #{act} times',
      'expected function to not have been called exactly once',
      1,
      obj.mock.calls.length
    );
  });

  Assertion.addMethod('calledWith', function (...expectedArgs) {
    const obj = this._obj;
    let foundMatchingCall = false;

    // Check each call's arguments
    for (const callArgs of obj.mock.calls) {
      if (callArgs.length !== expectedArgs.length) continue;
      
      const allArgsMatch = expectedArgs.every((expectedArg, index) => {
        if (expectedArg && typeof expectedArg === 'object' && expectedArg.asymmetricMatch) {
          // Handle Jest's expect.anything(), expect.any(), etc.
          return expectedArg.asymmetricMatch(callArgs[index]);
        }
        return expectedArg === callArgs[index];
      });

      if (allArgsMatch) {
        foundMatchingCall = true;
        break;
      }
    }

    this.assert(
      foundMatchingCall,
      'expected function to have been called with #{exp}',
      'expected function to not have been called with #{exp}',
      expectedArgs,
      obj.mock.calls
    );
  });
});

// Mock utilities similar to Jest
global.jest = {
  fn: () => {
    const mockFn = function(...args) {
      mockFn.mock.calls.push(args);
      mockFn.mock.instances.push(this);
      return mockFn.mockReturnValue;
    };
    
    mockFn.mock = {
      calls: [],
      instances: [],
      invocationCallOrder: [],
    };
    
    mockFn.mockReset = () => {
      mockFn.mock.calls = [];
      mockFn.mock.instances = [];
      mockFn.mockReturnValue = undefined;
    };
    
    mockFn.mockReturnValue = (val) => {
      mockFn.mockReturnValue = val;
      return mockFn;
    };
    
    mockFn.mockImplementation = (fn) => {
      mockFn.mockImplementationValue = fn;
      mockFn.mockReturnValue = undefined;
      
      return mockFn;
    };
    
    // Override function implementation
    const originalFn = mockFn;
    return new Proxy(mockFn, {
      apply(target, thisArg, args) {
        if (mockFn.mockImplementationValue) {
          return mockFn.mockImplementationValue.apply(thisArg, args);
        }
        return originalFn.apply(thisArg, args);
      }
    });
  },
  
  mock: (moduleName) => {
    jest.mock[moduleName] = {};
    return jest.mock[moduleName];
  }
};

// Add expect.anything() and similar matchers
global.expect = {
  ...chai.expect,
  anything: () => ({
    asymmetricMatch: (actual) => actual !== null && actual !== undefined
  }),
  any: (constructor) => ({
    asymmetricMatch: (actual) => actual instanceof constructor
  })
};

// Export chai expect for ease of use
module.exports = chai.expect;