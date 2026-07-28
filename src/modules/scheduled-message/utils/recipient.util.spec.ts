import { BadRequestException } from '@nestjs/common';
import { normalizeRecipient, normalizeRecipients, chunkArray } from './recipient.util';

describe('recipient.util', () => {
  describe('normalizeRecipient', () => {
    it('converts phone to chat id', () => {
      expect(normalizeRecipient('919820229230')).toBe('919820229230@c.us');
    });

    it('passes through chat ids', () => {
      expect(normalizeRecipient('120363123456789@g.us')).toBe('120363123456789@g.us');
    });

    it('strips formatting from phone numbers', () => {
      expect(normalizeRecipient('+91 98202 29230')).toBe('919820229230@c.us');
    });

    it('throws for invalid phone', () => {
      expect(() => normalizeRecipient('123')).toThrow(BadRequestException);
    });
  });

  describe('normalizeRecipients', () => {
    it('deduplicates recipients', () => {
      expect(normalizeRecipients(['919820229230', '919820229230'])).toEqual(['919820229230@c.us']);
    });
  });

  describe('chunkArray', () => {
    it('chunks arrays', () => {
      expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });
  });
});
