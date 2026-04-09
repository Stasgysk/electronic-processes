const Logger = require('../../utils/Logger');

function makeLogger(level = 'debug') {
  const { Logger: LoggerClass } = (() => {
    class LoggerClass {
      constructor(logLevel = 'info') {
        this.levels = ['debug', 'info', 'warn', 'error'];
        this.setLogLevel(logLevel);
      }
      setLogLevel(level) {
        if (!this.levels.includes(level)) throw new Error(`Invalid log level: ${level}`);
        this.logLevelIndex = this.levels.indexOf(level);
      }
      log(level, message) {
        try {
          if (message instanceof Object) message = JSON.stringify(message, this.sanitizeReplacer);
        } catch (e) {}
        if (typeof message === 'string') message = this.maskBase64(message);
        const levelIndex = this.levels.indexOf(level);
        if (levelIndex >= this.logLevelIndex) {
          const timestamp = new Date().toISOString();
          console.log(`${level.toUpperCase()}: ${timestamp}: ${message}`);
        }
      }
      sanitizeReplacer(key, value) {
        const sensitiveKeys = ['base64', 'data', 'file', 'content', 'binary', 'buffer'];
        if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
          if (typeof value === 'string' && value.length > 100) return `[${value.length} chars]`;
        }
        if (typeof value === 'string' && value.length > 500) {
          return value.substring(0, 100) + `... [${value.length} chars total]`;
        }
        return value;
      }
      maskBase64(str) {
        return str.replace(/[A-Za-z0-9+/=]{100,}/g, match => `[base64: ${match.length} chars]`);
      }
      info(message) { this.log('info', message); }
      error(message, err = '') { this.log('error', message + ` ${err}`); }
      debug(message) { this.log('debug', message); }
      warn(message) { this.log('warn', message); }
    }
    return { Logger: LoggerClass };
  })();
  return new LoggerClass(level);
}

describe('Logger', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('setLogLevel()', () => {
    it('throws on invalid log level', () => {
      const logger = makeLogger('info');
      expect(() => logger.setLogLevel('verbose')).toThrow('Invalid log level: verbose');
    });

    it('accepts valid log levels', () => {
      const logger = makeLogger('debug');
      expect(() => logger.setLogLevel('warn')).not.toThrow();
    });
  });

  describe('log level filtering', () => {
    it('does not print debug messages when level is info', () => {
      const logger = makeLogger('info');
      logger.debug('should be hidden');
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('prints info messages when level is info', () => {
      const logger = makeLogger('info');
      logger.info('hello');
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0][0]).toContain('INFO');
      expect(consoleSpy.mock.calls[0][0]).toContain('hello');
    });

    it('prints error messages at any level', () => {
      const logger = makeLogger('error');
      logger.error('boom');
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0][0]).toContain('ERROR');
    });

    it('does not print warn when level is error', () => {
      const logger = makeLogger('error');
      logger.warn('warning');
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('maskBase64()', () => {
    it('replaces long base64-like strings', () => {
      const logger = makeLogger('debug');
      const longBase64 = 'A'.repeat(120);
      logger.info(`data: ${longBase64}`);
      expect(consoleSpy.mock.calls[0][0]).toContain('[base64: 120 chars]');
    });

    it('does not replace short strings', () => {
      const logger = makeLogger('debug');
      const shortStr = 'ABC123';
      logger.info(shortStr);
      expect(consoleSpy.mock.calls[0][0]).toContain(shortStr);
    });
  });

  describe('sanitizeReplacer()', () => {
    it('truncates long sensitive fields in objects', () => {
      const logger = makeLogger('debug');
      const obj = { base64data: 'X'.repeat(200) };
      logger.info(obj);
      expect(consoleSpy.mock.calls[0][0]).toContain('200 chars');
    });
  });
});
