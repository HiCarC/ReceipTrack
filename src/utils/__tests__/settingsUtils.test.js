import { describe, it, expect, beforeEach } from 'vitest';
import { loadSettings, saveSettings, updateSettings } from '@/utils/settingsUtils';

describe('settingsUtils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads defaults when nothing saved', () => {
    const settings = loadSettings();
    expect(settings).toBeTruthy();
    expect(settings.baseCurrency).toBeDefined();
  });

  it('saves and loads settings', () => {
    const saved = { baseCurrency: 'USD', appearance: 'dark' };
    saveSettings(saved);
    const loaded = loadSettings();
    expect(loaded.baseCurrency).toBe('USD');
    expect(loaded.appearance).toBe('dark');
  });

  it('updates settings by merging with existing', () => {
    saveSettings({ baseCurrency: 'EUR', appearance: 'light' });
    const updated = updateSettings({ baseCurrency: 'USD' });
    expect(updated.baseCurrency).toBe('USD');
    expect(updated.appearance).toBe('light');
  });
});
