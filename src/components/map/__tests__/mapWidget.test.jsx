import { describe, it, expect } from 'vitest';
import { _test as mapTest } from '@/components/map/MapWidget';

describe('MapWidget helpers', () => {
  it('creates stable marker positions', () => {
    const posA = mapTest.getMarkerPosition('seed', 1);
    const posB = mapTest.getMarkerPosition('seed', 1);
    expect(posA).toEqual(posB);
  });

  it('formats receipt titles with fallbacks', () => {
    expect(mapTest.getReceiptTitle({ merchant: 'Cafe' })).toBe('Cafe');
    expect(mapTest.getReceiptTitle({ place: { display_name: 'Place' } })).toBe('Place');
    expect(mapTest.getReceiptTitle({})).toBe('Unknown');
  });

  it('formats receipt date with time', () => {
    const receipt = { date: '2026-01-02T12:00:00Z' };
    const label = mapTest.formatReceiptDateTime(receipt);
    expect(label).not.toBe('Unknown date');
  });
});
