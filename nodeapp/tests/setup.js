global.config = {
  translate: {
    supported_languages: ['en', 'sk'],
  },
};

global.logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

global.resBuilder = require('../../utils/ResponseBuilder');
