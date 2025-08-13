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
            if(message instanceof Object) {
                message = JSON.stringify(message);
            }
        } catch (e) {

        }
        const levelIndex = this.levels.indexOf(level);
        if (levelIndex >= this.logLevelIndex) {
            const timestamp = new Date().toISOString();
            console.log(`${level.toUpperCase()}: ${timestamp}: ${message}`);
        }
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