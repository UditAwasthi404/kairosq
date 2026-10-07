/**
 * Normalize extracted document text without rewriting meaning.
 */
export function normalizeDocumentText(text: string | null): string | null {
  if (text == null) return null;

  let value = text.normalize('NFKC');
  value = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Strip most control chars except newline/tab
  // eslint-disable-next-line no-control-regex -- intentional cleanup of extraction artifacts
  value = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  value = value.replace(/[ \t]+\n/g, '\n');
  value = value.replace(/\n{3,}/g, '\n\n');
  value = value.replace(/[ \t]{2,}/g, ' ');
  // Common PDF extraction artifacts
  value = value.replace(/(\w)-\n(\w)/g, '$1$2');
  value = value.trim();

  return value.length > 0 ? value : null;
}
