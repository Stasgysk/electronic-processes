global.config = {
  translate: {
    supported_languages: ['en', 'sk'],
  },
};

const { getDefaultRequestParams } = require('../../utils/RoutesUtils');

function makeReq(query = {}, body = {}) {
  return { query, body };
}

describe('getDefaultRequestParams()', () => {
  describe('eager', () => {
    it('returns true when query eager is "true"', () => {
      const { eager } = getDefaultRequestParams(makeReq({ eager: 'true' }));
      expect(eager).toBe(true);
    });

    it('returns false when query eager is "false"', () => {
      const { eager } = getDefaultRequestParams(makeReq({ eager: 'false' }));
      expect(eager).toBe(false);
    });

    it('reads eager from body when not in query', () => {
      const { eager } = getDefaultRequestParams(makeReq({}, { eager: 'true' }));
      expect(eager).toBe(true);
    });

    it('defaults eager to false when absent', () => {
      const { eager } = getDefaultRequestParams(makeReq());
      expect(eager).toBe(false);
    });
  });

  describe('length', () => {
    it('returns numeric string as-is when valid', () => {
      const { length } = getDefaultRequestParams(makeReq({ length: '20' }));
      expect(length).toBe('20');
    });

    it('returns false for non-numeric length', () => {
      const { length } = getDefaultRequestParams(makeReq({ length: 'abc' }));
      expect(length).toBe(false);
    });

    it('defaults length to false when absent', () => {
      const { length } = getDefaultRequestParams(makeReq());
      expect(length).toBe(false);
    });
  });

  describe('offset', () => {
    it('returns numeric string offset', () => {
      const { offset } = getDefaultRequestParams(makeReq({ offset: '10' }));
      expect(offset).toBe('10');
    });

    it('defaults offset to 0 when absent', () => {
      const { offset } = getDefaultRequestParams(makeReq());
      expect(offset).toBe(0);
    });

    it('defaults offset to 0 for non-numeric value', () => {
      const { offset } = getDefaultRequestParams(makeReq({ offset: 'bad' }));
      expect(offset).toBe(0);
    });
  });

  describe('language', () => {
    it('returns "sk" for supported language', () => {
      const { lan } = getDefaultRequestParams(makeReq({ lan: 'sk' }));
      expect(lan).toBe('sk');
    });

    it('defaults to "en" for unsupported language', () => {
      const { lan } = getDefaultRequestParams(makeReq({ lan: 'de' }));
      expect(lan).toBe('en');
    });

    it('defaults to "en" when lan is absent', () => {
      const { lan } = getDefaultRequestParams(makeReq());
      expect(lan).toBe('en');
    });

    it('reads lan from body when not in query', () => {
      const { lan } = getDefaultRequestParams(makeReq({}, { lan: 'sk' }));
      expect(lan).toBe('sk');
    });
  });
});
