import { describe, it, expect } from 'vitest';
import {
  normalizeBrand,
  brandMatchesSelection,
  operatorMatchesSelection,
} from './brandNormalization';

describe('normalizeBrand', () => {
  it('merges Flock typos into Flock Safety', () => {
    expect(normalizeBrand('Flock Safety')).toBe('Flock Safety');
    expect(normalizeBrand('floc')).toBe('Flock Safety');
    expect(normalizeBrand('Flock Saftey')).toBe('Flock Safety');
    expect(normalizeBrand('flow safety')).toBe('Flock Safety');
  });

  it('maps sub-brands to parent companies', () => {
    expect(normalizeBrand('Vigilant')).toBe('Motorola Solutions');
    expect(normalizeBrand('AutoVu')).toBe('Genetec');
    expect(normalizeBrand('ELSAG')).toBe('Leonardo');
    expect(normalizeBrand('PIPS')).toBe('Neology');
  });

  it('returns null for garbage values', () => {
    expect(normalizeBrand('unknown')).toBeNull();
    expect(normalizeBrand('Unk')).toBeNull();
    expect(normalizeBrand('generic')).toBeNull();
    expect(normalizeBrand('x')).toBeNull();
    expect(normalizeBrand('wikidata:Q123')).toBeNull();
  });

  it('keeps unrecognized brands as trimmed raw strings', () => {
    expect(normalizeBrand('  SomeNewVendor  ')).toBe('SomeNewVendor');
  });
});

describe('brandMatchesSelection', () => {
  it('matches raw label directly', () => {
    expect(brandMatchesSelection('Flock Safety', ['Flock Safety'])).toBe(true);
  });
  it('matches typo via canonical form', () => {
    expect(brandMatchesSelection('Flock Saftey', ['Flock Safety'])).toBe(true);
  });
  it('rejects missing brand', () => {
    expect(brandMatchesSelection(undefined, ['Flock Safety'])).toBe(false);
  });
  it('rejects non-selected brand', () => {
    expect(brandMatchesSelection('Genetec', ['Flock Safety'])).toBe(false);
  });
});

describe('operatorMatchesSelection', () => {
  it('matches case-insensitively with trimming', () => {
    expect(operatorMatchesSelection(' city of Atlanta ', ['City of Atlanta'])).toBe(true);
  });
  it('rejects missing operator', () => {
    expect(operatorMatchesSelection(undefined, ['City of Atlanta'])).toBe(false);
  });
});
