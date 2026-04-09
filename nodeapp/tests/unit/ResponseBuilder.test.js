const resBuilder = require('../../utils/ResponseBuilder');

describe('ResponseBuilder', () => {
  describe('success()', () => {
    it('returns status "success" with provided data', () => {
      const result = resBuilder.success({ id: 1 });
      expect(result).toEqual({ status: 'success', data: { id: 1 } });
    });

    it('returns empty object as data when called without arguments', () => {
      const result = resBuilder.success();
      expect(result).toEqual({ status: 'success', data: {} });
    });

    it('handles array data', () => {
      const result = resBuilder.success([1, 2, 3]);
      expect(result).toEqual({ status: 'success', data: [1, 2, 3] });
    });
  });

  describe('error()', () => {
    it('returns status "error" with a message', () => {
      const result = resBuilder.error('Something broke');
      expect(result).toEqual({ status: 'error', data: 'Something broke' });
    });

    it('returns empty object as data when called without arguments', () => {
      const result = resBuilder.error();
      expect(result).toEqual({ status: 'error', data: {} });
    });
  });

  describe('fail()', () => {
    it('returns status "fail" with a message', () => {
      const result = resBuilder.fail('Unauthorized');
      expect(result).toEqual({ status: 'fail', data: 'Unauthorized' });
    });

    it('returns empty object as data when called without arguments', () => {
      const result = resBuilder.fail();
      expect(result).toEqual({ status: 'fail', data: {} });
    });
  });
});
