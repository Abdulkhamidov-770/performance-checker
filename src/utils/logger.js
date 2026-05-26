/**
 * Markaziy logger — verbose flag bilan boshqariladi.
 * Foydalanish: import { logger } from './utils/logger.js';
 *              logger.setLevel('debug' | 'info' | 'warn' | 'error' | 'silent');
 */

const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  red: '\x1b[31m', yellow: '\x1b[33m', blue: '\x1b[34m',
  green: '\x1b[32m', cyan: '\x1b[36m', gray: '\x1b[90m',
};

class Logger {
  constructor() {
    this.level = LEVELS.info;
  }

  setLevel(name) {
    if (name in LEVELS) this.level = LEVELS[name];
  }

  setVerbose(verbose) {
    this.level = verbose ? LEVELS.debug : LEVELS.info;
  }

  debug(...args) {
    if (this.level >= LEVELS.debug) console.log(`${C.gray}[debug]${C.reset}`, ...args);
  }

  info(...args) {
    if (this.level >= LEVELS.info) console.log(...args);
  }

  warn(...args) {
    if (this.level >= LEVELS.warn) console.warn(`${C.yellow}⚠ ${C.reset}`, ...args);
  }

  error(...args) {
    if (this.level >= LEVELS.error) console.error(`${C.red}✗ ${C.reset}`, ...args);
  }

  success(...args) {
    if (this.level >= LEVELS.info) console.log(`${C.green}✓${C.reset}`, ...args);
  }
}

export const logger = new Logger();
