import { BadRequestException } from '@nestjs/common';

export function normalizeRecipient(recipient: string): string {
  const trimmed = recipient.trim();
  if (!trimmed) {
    throw new BadRequestException('Recipient cannot be empty');
  }
  if (trimmed.includes('@')) {
    return trimmed;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10) {
    throw new BadRequestException(`Invalid phone number: ${trimmed}`);
  }
  return `${digits}@c.us`;
}

export function normalizeRecipients(recipients: string[]): string[] {
  const normalized = recipients.map(normalizeRecipient);
  return [...new Set(normalized)];
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
