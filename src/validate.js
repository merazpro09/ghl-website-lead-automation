const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9 ()\-.]{7,20}$/;

/**
 * Validates a normalized lead. Returns a list of error messages (empty = valid).
 */
export function validateLead(lead) {
  const errors = [];

  if (!lead.email && !lead.phone) {
    errors.push('Either email or phone is required.');
  }
  if (lead.email && !EMAIL_RE.test(lead.email)) {
    errors.push('Email address is not valid.');
  }
  if (lead.phone && !PHONE_RE.test(lead.phone)) {
    errors.push('Phone number is not valid.');
  }
  if (lead.website) {
    try {
      const url = new URL(/^https?:\/\//i.test(lead.website) ? lead.website : `https://${lead.website}`);
      if (!url.hostname.includes('.')) throw new Error('no tld');
    } catch {
      errors.push('Website URL is not valid.');
    }
  }
  if (lead.name && lead.name.length > 120) {
    errors.push('Name is too long.');
  }

  return errors;
}
