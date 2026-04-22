class Logger {
    constructor(logLevel = 'info') {
        this.levels = ['debug', 'info', 'warn', 'error'];
        this.setLogLevel(logLevel);
    }

    setLogLevel(level) {
        if (!this.levels.includes(level)) {
            throw new Error(`Invalid log level: ${level}`);
        }
        this.logLevelIndex = this.levels.indexOf(level);
    }

    log(level, message) {
        // stringify objects so they show up nicely in the log
        try {
            if (message instanceof Object) {
                message = JSON.stringify(message, this.sanitizeReplacer);
            }
        } catch (e) {}

        // mask any base64 blobs that ended up in the message
        if (typeof message === 'string') {
            message = this.maskBase64(message);
        }

        // only print if this level is at or above the configured minimum
        const levelIndex = this.levels.indexOf(level);
        if (levelIndex >= this.logLevelIndex) {
            const timestamp = new Date().toISOString();
            console.log(`${level.toUpperCase()}: ${timestamp}: ${message}`);
        }
    }

    // JSON replacer that shortens large blobs so they don't flood the log
    sanitizeReplacer(key, value) {
        const sensitiveKeys = ['base64', 'data', 'file', 'content', 'binary', 'buffer'];

        if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
            if (typeof value === 'string' && value.length > 100) {
                return `[${value.length} chars]`;
            }
        }

        // truncate any unexpectedly long string
        if (typeof value === 'string' && value.length > 500) {
            return value.substring(0, 100) + `... [${value.length} chars total]`;
        }

        return value;
    }

    // replaces long base64-looking strings in log messages with a placeholder
    maskBase64(str) {
        return str.replace(
            /[A-Za-z0-9+/=]{100,}/g,
            match => `[base64: ${match.length} chars]`
        );
    }

    info(message) {
        this.log('info', message);
    }

    error(message, err = '') {
        this.log('error', message + ` ${err}`);
    }

    debug(message) {
        this.log('debug', message);
    }

    warn(message) {
        this.log('warn', message);
    }
}

module.exports = new Logger(process.env.LOG_LEVEL);
