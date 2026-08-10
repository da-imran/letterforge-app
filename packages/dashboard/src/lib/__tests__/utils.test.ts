import { describe, it, expect } from 'vitest';
import { cn, isValidEmail } from '@/lib/utils';

describe('isValidEmail', () => {
  it('accepts a valid email', () => {
    expect(isValidEmail('player@letterforge.app')).toBe(true);
  });

  it('accepts an email with surrounding whitespace', () => {
    expect(isValidEmail('  player@letterforge.app  ')).toBe(true);
  });

  it('rejects missing @ symbol', () => {
    expect(isValidEmail('playerletterforge.app')).toBe(false);
  });

  it('rejects missing domain', () => {
    expect(isValidEmail('player@')).toBe(false);
  });

  it('rejects spaces inside the address', () => {
    expect(isValidEmail('pla yer@letterforge.app')).toBe(false);
  });
});

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('filters falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });

  it('resolves tailwind conflicts via twMerge', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});
