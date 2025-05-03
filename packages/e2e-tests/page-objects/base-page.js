// packages/e2e-tests/page-objects/base-page.js
import { expect } from '@playwright/test';

// Define allowed console methods
const ALLOWED_CONSOLE_METHODS = new Set(['log', 'info', 'warn', 'error', 'debug']);

/**
 * Base page object with common functionality for all pages
 */
class BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.timeouts = {
      short: 1000,
      medium: 5000,
      long: 15_000,
      extraLong: 30_000,
    };
  }

  /**
   * Logs a message to both test console and browser console
   * @param {string} message - Message to log
   * @param {'log'|'info'|'warn'|'error'|'debug'} level - Log level
   */
  async log(message, level = 'log') {
    // Only use known safe log levels to prevent object injection
    const safeLevel = ALLOWED_CONSOLE_METHODS.has(level) ? level : 'log';
    console[safeLevel](`${this.constructor.name}: ${message}`);

    try {
      // Only try to evaluate in browser if the page is still available
      if (this.page && !this.page.isClosed?.()) {
        await this.page
          .evaluate(
            ({ msg, lvl }) => {
              // Only use known safe log levels in browser context
              const safeBrowserLevel = ['log', 'info', 'warn', 'error', 'debug'].includes(lvl)
                ? lvl
                : 'log';
              console[safeBrowserLevel](`Browser: ${msg}`);
            },
            { msg: message, lvl: level }
          )
          .catch((error) => {
            // If evaluate fails, just log to test console
            console.warn(`Failed to log to browser console: ${error.message}`);
          });
      }
    } catch (error) {
      // Catch any errors during page evaluation to prevent test failures
      console.warn(`Error during browser logging: ${error.message}`);
    }
  }

  /**
   * Waits for an element to be visible with improved error handling
   * @param {string} selector - Element selector
   * @param {object} options - Wait options
   * @param {number} options.timeout - Timeout in ms
   * @param {string} options.errorMessage - Custom error message
   * @returns {Promise<import('@playwright/test').Locator>}
   */
  async waitForElement(selector, options = {}) {
    const timeout = options.timeout || this.timeouts.medium;
    const errorMessage =
      options.errorMessage || `Element ${selector} not visible within ${timeout}ms`;

    try {
      const locator = this.page.locator(selector);
      await expect(locator, errorMessage).toBeVisible({ timeout });
      return locator;
    } catch (error) {
      await this.log(`Failed to find element: ${selector}. ${error.message}`, 'error');
      await this.takeErrorScreenshot(
        `element_not_found_${selector.replaceAll(/[^\dA-Za-z]/g, '_')}`
      );
      throw error;
    }
  }

  /**
   * Takes a screenshot for debugging purposes
   * @param {string} name - Screenshot name
   */
  async takeErrorScreenshot(name) {
    const timestamp = new Date().toISOString().replaceAll(/[.:]/g, '-');
    const filename = `playwright-report/error_${name}_${timestamp}.png`;
    try {
      await this.page.screenshot({ path: filename, fullPage: true });
      console.info(`Screenshot saved to ${filename}`);
    } catch (error) {
      console.error(`Failed to take screenshot: ${error.message}`);
    }
  }

  /**
   * Fills an input field with retry logic and enhanced debugging
   * @param {string} selector - Input selector
   * @param {string} value - Value to fill
   * @param {object} options - Options
   */
  async fillInput(selector, value, options = {}) {
    const maxRetries = options.maxRetries || 2;
    const timeout = options.timeout || this.timeouts.medium;
    let lastError = null;

    await this.log(`Attempting to fill ${selector} with value: ${value}`, 'info');

    // Try to ensure the element is absolutely visible and interactive
    try {
      const locator = this.page.locator(selector);
      await locator.scrollIntoViewIfNeeded();

      // Take a screenshot before filling
      await this.takeErrorScreenshot(`before_fill_${selector.replaceAll(/\W/g, '_')}`);

      // Check current value of the field
      const currentValue = await locator.inputValue().catch(() => 'unable to get value');
      await this.log(`Current value of ${selector} before filling: "${currentValue}"`, 'info');
    } catch (error) {
      await this.log(`Pre-fill check failed for ${selector}: ${error.message}`, 'warn');
    }

    // Use for loop instead of await in loop to avoid ESLint warning
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        // First clear the field using clear() before filling
        const locator = await this.waitForElement(selector, { timeout });

        // Make sure it's ready for input
        await locator.click({ timeout: this.timeouts.short });

        // Try clearing first (may fail on some elements but that's ok)
        try {
          await locator.clear({ timeout: this.timeouts.short });
        } catch (clearError) {
          await this.log(`Could not clear ${selector}: ${clearError.message}`, 'info');
        }

        // Now fill the value
        await locator.fill(value, { timeout });

        // Extra forceful way to set value if needed
        if (attempt > 1) {
          try {
            await this.page.evaluate(
              ({ sel, val }) => {
                const el = document.querySelector(sel);
                if (el) {
                  el.value = val;
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                }
              },
              { sel: selector, val: value }
            );
          } catch (evalError) {
            await this.log(`Fallback input method also failed: ${evalError.message}`, 'warn');
          }
        }

        // Extra wait to ensure stability
        await this.page.waitForTimeout(100);

        // Verify value was actually set (important for AJAX forms)
        await expect(locator).toHaveValue(value, { timeout: this.timeouts.short });

        await this.log(`Successfully filled ${selector} with "${value}"`, 'info');

        // Take a screenshot after filling
        await this.takeErrorScreenshot(`after_fill_${selector.replaceAll(/\W/g, '_')}`);
        return;
      } catch (error) {
        lastError = error;
        if (attempt <= maxRetries) {
          await this.log(
            `Retry ${attempt}/${maxRetries} filling input ${selector}: ${error.message}`,
            'warn'
          );
          await this.page.waitForTimeout(200 * attempt);
        }
      }
    }

    // More detailed error on final failure
    await this.log(
      `Failed to fill ${selector} after ${maxRetries + 1} attempts: ${lastError?.message}`,
      'error'
    );
    await this.takeErrorScreenshot(`failed_fill_${selector.replaceAll(/\W/g, '_')}`);
    throw lastError;
  }

  /**
   * Clicks an element with retry logic and enhanced debugging
   * @param {string} selector - Element selector
   * @param {object} options - Options
   */
  async clickElement(selector, options = {}) {
    const maxRetries = options.maxRetries || 2;
    const timeout = options.timeout || this.timeouts.medium;
    const waitForNavigation = options.waitForNavigation || false;
    const force = options.force || false;
    const navigateUrl = options.navigateUrl || null;
    let lastError = null;

    await this.log(`Attempting to click ${selector}`, 'info');

    // Take a screenshot before clicking
    await this.takeErrorScreenshot(`before_click_${selector.replaceAll(/\W/g, '_')}`);

    // Try to ensure the element is absolutely visible
    try {
      const preLocator = this.page.locator(selector);
      await preLocator.scrollIntoViewIfNeeded();

      // Check if the element is visually where we expect it
      const isVisible = await preLocator
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false);
      if (!isVisible) {
        await this.log(`Warning: Element ${selector} not visible before attempting click`, 'warn');
      }
    } catch (error) {
      await this.log(`Pre-click check failed for ${selector}: ${error.message}`, 'warn');
    }

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const locator = await this.waitForElement(selector, { timeout });

        // Different click strategies based on options
        if (waitForNavigation && navigateUrl) {
          // Method 1: Wait for specific URL with Promise.all
          await Promise.all([
            this.page.waitForURL(navigateUrl, { timeout: this.timeouts.long }),
            locator.click({ force, timeout: this.timeouts.medium }),
          ]);
        } else if (waitForNavigation) {
          // Method 2: Generic navigation with Promise.all
          await Promise.all([
            this.page.waitForNavigation({
              timeout: this.timeouts.long,
              waitUntil: 'domcontentloaded',
            }),
            locator.click({ force, timeout: this.timeouts.medium }),
          ]);
        } else {
          // Method 3: Simple click without navigation
          await locator.click({ force, timeout: this.timeouts.medium });

          // Add small wait for any animations or JS to complete
          await this.page.waitForTimeout(200);
        }

        await this.log(`Successfully clicked ${selector}`, 'info');

        // Take a screenshot after clicking
        await this.takeErrorScreenshot(`after_click_${selector.replaceAll(/\W/g, '_')}`);
        return;
      } catch (error) {
        lastError = error;
        if (attempt <= maxRetries) {
          await this.log(
            `Retry ${attempt}/${maxRetries} clicking ${selector}: ${error.message}`,
            'warn'
          );

          // Try an alternative approach on the retry
          if (attempt === maxRetries) {
            await this.log('Trying JavaScript click as fallback', 'info');
            try {
              // Fallback: Use JavaScript click
              await this.page.evaluate((sel) => {
                const element = document.querySelector(sel);
                if (element) {
                  element.click();
                  return true;
                }
                return false;
              }, selector);

              // If navigation is expected, wait for it even with JS click
              if (waitForNavigation && navigateUrl) {
                await this.page.waitForURL(navigateUrl, { timeout: this.timeouts.long });
              } else if (waitForNavigation) {
                await this.page.waitForNavigation({
                  timeout: this.timeouts.long,
                  waitUntil: 'domcontentloaded',
                });
              }

              await this.log(`JavaScript click on ${selector} successful`, 'info');
              return;
            } catch (jsError) {
              await this.log(`JavaScript click failed: ${jsError.message}`, 'warn');
            }
          }

          // Increase wait time between retries
          await this.page.waitForTimeout(200 * attempt);
        }
      }
    }

    // More detailed error on final failure
    await this.log(
      `Failed to click ${selector} after ${maxRetries + 1} attempts: ${lastError?.message}`,
      'error'
    );
    await this.takeErrorScreenshot(`failed_click_${selector.replaceAll(/\W/g, '_')}`);
    throw lastError;
  }

  /**
   * Gets text from an element
   * @param {string} selector - Element selector
   * @returns {Promise<string>}
   */
  async getText(selector, options = {}) {
    const locator = await this.waitForElement(selector, options);
    return locator.textContent();
  }

  /**
   * Checks if an element exists
   * @param {string} selector - Element selector
   * @returns {Promise<boolean>}
   */
  async elementExists(selector) {
    try {
      const count = await this.page.locator(selector).count();
      return count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Waits for network idle
   */
  async waitForNetworkIdle() {
    try {
      await this.page.waitForLoadState('networkidle', { timeout: this.timeouts.medium });
    } catch (error) {
      await this.log(`Network did not reach idle state: ${error.message}`, 'warn');
    }
  }

  /**
   * Waits for a specified duration
   * @param {number} ms - Duration in milliseconds
   */
  async wait(ms) {
    await this.page.waitForTimeout(ms);
  }
}

export default BasePage;
