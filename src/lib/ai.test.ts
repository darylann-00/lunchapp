import { describe, it, expect } from 'vitest';
import { safeParseJson } from './ai';

describe('safeParseJson', () => {
  it('parses valid JSON', () => {
    const result = safeParseJson<{ foo: string }>('{"foo":"bar"}');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('parses JSON wrapped in markdown fences', () => {
    const result = safeParseJson<{ foo: string }>('```json\n{"foo":"bar"}\n```');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('parses JSON with trailing commas and // comments', () => {
    const input = `{
      "foo": "bar", // this is a comment
      "baz": 42,
    }`;
    const result = safeParseJson<{ foo: string; baz: number }>(input);
    expect(result).toEqual({ foo: 'bar', baz: 42 });
  });

  it('returns null on unrecoverable garbage', () => {
    const result = safeParseJson('this is not json at all }{');
    expect(result).toBeNull();
  });
});
