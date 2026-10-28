/**
 * Normalizes Elementor Pro form webhook payloads.
 *
 * Elementor can send two shapes:
 *  1. Advanced Data OFF (default): flat object keyed by the field LABEL,
 *     e.g. { "Name": "Jane", "Email": "jane@example.com", "No label field abc1234": "on" }
 *  2. Advanced Data ON: { form: {...}, fields: { name: { id, title, value, ... } }, meta: {...} }
 *
 * Both are turned into a flat object with predictable snake_case keys.
 */

// Common label variations -> canonical key
const ALIASES = {
  name: 'name',
  'full name': 'name',
  'your name': 'name',
  'first name': 'first_name',
  'last name': 'last_name',
  email: 'email',
  'email address': 'email',
  'your email': 'email',
  'work email': 'email',
  phone: 'phone',
  'phone number': 'phone',
  'mobile': 'phone',
  'whatsapp': 'phone',
  website: 'website',
  'website url': 'website',
  'your website': 'website',
  url: 'website',
  company: 'company',
  'business name': 'company',
  'company name': 'company',
  message: 'message',
  'your message': 'message',
  'how can we help': 'message',
};

const UNLABELED_RE = /^no label field\s+([a-z0-9]+)$/i;
const MAX_VALUE_LENGTH = 5000;

export function toSnakeCase(label) {
  return String(label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Removes control characters and trims/limits length. */
export function cleanValue(value) {
  if (Array.isArray(value)) value = value.join(', ');
  if (value === null || value === undefined) return '';
  return String(value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, MAX_VALUE_LENGTH);
}

/** Maps a single label to a canonical key. */
export function normalizeKey(label, fieldMap = {}) {
  const raw = String(label).trim();
  if (fieldMap[raw]) return fieldMap[raw];

  const unlabeled = raw.match(UNLABELED_RE);
  if (unlabeled) return `field_${unlabeled[1].toLowerCase()}`;

  const lower = raw.toLowerCase().replace(/[:*]+$/, '').trim();
  if (ALIASES[lower]) return ALIASES[lower];
  return toSnakeCase(raw);
}

/** Checkbox / acceptance values -> "Yes" | "No". */
export function toYesNo(value) {
  const v = cleanValue(value).toLowerCase();
  if (!v || ['no', 'false', '0', 'off'].includes(v)) return 'No';
  return 'Yes';
}

/** Flattens Elementor's Advanced Data shape into label -> value pairs. */
function flattenAdvanced(body) {
  const out = {};
  for (const [id, field] of Object.entries(body.fields || {})) {
    if (field && typeof field === 'object') {
      const label = field.title && String(field.title).trim() ? field.title : id;
      out[label] = field.raw_value ?? field.value ?? '';
    } else {
      out[id] = field;
    }
  }
  return out;
}

/**
 * @param {object} body  Parsed request body from Elementor
 * @param {{fieldMap?: object, booleanFields?: string[]}} options
 * @returns {{ lead: object, meta: object }}
 */
export function normalizePayload(body = {}, { fieldMap = {}, booleanFields = [] } = {}) {
  const isAdvanced = body && typeof body.fields === 'object' && body.fields !== null;
  const source = isAdvanced ? flattenAdvanced(body) : body;

  const lead = {};
  for (const [label, value] of Object.entries(source)) {
    if (['form', 'meta', 'token'].includes(label)) continue;
    const key = normalizeKey(label, fieldMap);
    if (!key) continue;
    lead[key] = cleanValue(value);
  }

  for (const field of booleanFields) {
    lead[field] = toYesNo(lead[field]);
  }

  // Split "name" into first/last for GHL's contact fields
  if (lead.name && !lead.first_name) {
    const [first, ...rest] = lead.name.split(/\s+/);
    lead.first_name = first;
    lead.last_name = rest.join(' ');
  }
  if (!lead.name && (lead.first_name || lead.last_name)) {
    lead.name = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
  }

  if (lead.email) lead.email = lead.email.toLowerCase();

  const meta = {
    form_name: cleanValue(body?.form?.name || body?.form_name || ''),
    page_url: cleanValue(body?.meta?.page_url?.value || body?.meta?.page_url || ''),
    received_at: new Date().toISOString(),
  };

  return { lead, meta };
}
