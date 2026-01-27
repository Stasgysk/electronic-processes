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
        try {
            if (message instanceof Object) {
                message = JSON.stringify(message, this.sanitizeReplacer);
            }
        } catch (e) {}

        if (typeof message === 'string') {
            message = this.maskBase64(message);
        }

        const levelIndex = this.levels.indexOf(level);
        if (levelIndex >= this.logLevelIndex) {
            const timestamp = new Date().toISOString();
            console.log(`${level.toUpperCase()}: ${timestamp}: ${message}`);
        }
    }

    sanitizeReplacer(key, value) {
        const sensitiveKeys = ['base64', 'data', 'file', 'content', 'binary', 'buffer'];

        if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
            if (typeof value === 'string' && value.length > 100) {
                return `[${value.length} chars]`;
            }
        }

        if (typeof value === 'string' && value.length > 500) {
            return value.substring(0, 100) + `... [${value.length} chars total]`;
        }

        return value;
    }

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