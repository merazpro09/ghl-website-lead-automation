import { describe, it, expect } from 'vitest';
import { normalizePayload, normalizeKey, toYesNo, cleanValue } from '../src/normalize.js';

describe('normalizeKey', () => {
  it('maps common labels to canonical keys', () => {
    expect(normalizeKey('Full Name')).toBe('name');
    expect(normalizeKey('Email Address')).toBe('email');
    expect(normalizeKey('Website URL')).toBe('website');
    expect(normalizeKey('Phone Number:')).toBe('phone');
  });

  it('handles unlabeled Elementor fields', () => {
    expect(normalizeKey('No label field f00d123')).toBe('field_f00d123');
  });

  it('prefers an explicit FIELD_MAP entry', () => {
    expect(normalizeKey('No label field f00d123', { 'No label field f00d123': 'wants_short_call' })).toBe('wants_short_call');
  });

  it('snake_cases unknown labels', () => {
    expect(normalizeKey('Monthly Budget ($)')).toBe('monthly_budget');
  });
});

describe('toYesNo', () => {
  it.each([
    ['on', 'Yes'],
    ['Yes, book a short call', 'Yes'],
    ['', 'No'],
    [undefined, 'No'],
    ['false', 'No'],
  ])('%s -> %s', (input, expected) => {
    expect(toYesNo(input)).toBe(expected);
  });
});

describe('cleanValue', () => {
  it('strips control characters and joins arrays', () => {
    expect(cleanValue('  hi\u0000there ')).toBe('hithere');
    expect(cleanValue(['SEO', 'Website'])).toBe('SEO, Website');
  });
});

describe('normalizePayload', () => {
  const options = { fieldMap: { 'No label field abc1234': 'wants_short_call' }, booleanFields: ['wants_short_call'] };

  it('normalizes the flat (Advanced Data off) shape', () => {
    const { lead, meta } = normalizePayload(
      { Name: 'Jane Q Example', Email: 'Jane@Example.com', 'No label field abc1234': 'on', form_name: 'Free Audit' },
      options,
    );
    expect(lead).toMatchObject({
      name: 'Jane Q Example',
      first_name: 'Jane',
      last_name: 'Q Example',
      email: 'jane@example.com',
      wants_short_call: 'Yes',
    });
    expect(meta.form_name).toBe('Free Audit');
  });

  it('sets unchecked boolean fields to "No"', () => {
    const { lead } = normalizePayload({ Email: 'a@example.com' }, options);
    expect(lead.wants_short_call).toBe('No');
  });

  it('normalizes the Advanced Data shape', () => {
    const { lead, meta } = normalizePayload({
      form: { id: 'x1', name: 'Contact' },
      fields: {
        name: { id: 'name', title: 'Name', value: 'Sam Lee' },
        email: { id: 'email', title: 'Email', value: 'sam@example.com' },
        field_9: { id: 'field_9', title: '', value: 'Hello' },
      },
      meta: { page_url: { title: 'Page URL', value: 'https://example.com/contact/' } },
    });
    expect(lead).toMatchObject({ name: 'Sam Lee', email: 'sam@example.com', field_9: 'Hello' });
    expect(meta).toMatchObject({ form_name: 'Contact', page_url: 'https://example.com/contact/' });
  });
});
