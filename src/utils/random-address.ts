/**
 * Human-like random email local-part generator.
 * Combines two Indonesian-ish word lists + optional number suffix.
 * Ported from the original tempmail VPS project.
 */

const FIRST = [
  'langit', 'senja', 'pagi', 'malam', 'kopi', 'hujan', 'bulan', 'bintang', 'angin', 'awan',
  'nusa', 'rasa', 'jalan', 'teman', 'cerita', 'warna', 'nadi', 'cahya', 'putra', 'putri',
  'bagas', 'adit', 'arya', 'dimas', 'fajar', 'rizky', 'galih', 'bayu', 'bima', 'nanda'
];

const SECOND = [
  'biru', 'pagi', 'malam', 'manis', 'tenang', 'laut', 'hutan', 'cerah', 'jingga', 'ungu',
  'indah', 'muda', 'asri', 'utama', 'jaya', 'kecil', 'besar', 'lucu', 'syahdu', 'harum',
  'aji', 'wira', 'ayu', 'sari', 'utama', 'rama', 'nugraha', 'permata', 'lestari', 'mahesa'
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomLocalPart(): string {
  const useNumber = Math.random() < 0.8;
  const suffix = useNumber ? String(Math.floor(Math.random() * 90) + 10) : '';
  return `${pick(FIRST)}${pick(SECOND)}${suffix}`;
}

export function generateUniqueAddress(
  exists: (addr: string) => boolean,
  domain: string
): string {
  for (let i = 0; i < 50; i++) {
    const address = `${randomLocalPart()}@${domain}`;
    if (!exists(address)) {
      return address;
    }
  }

  // Fallback: add timestamp suffix for uniqueness
  const fallback = `${randomLocalPart()}${Date.now().toString().slice(-4)}@${domain}`;
  if (!exists(fallback)) {
    return fallback;
  }

  throw new Error('Failed to generate unique inbox address');
}
