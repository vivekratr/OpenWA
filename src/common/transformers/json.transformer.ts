import { ValueTransformer } from 'typeorm';

/** Parses JSON stored in text columns (Postgres migrations used text before jsonb). */
export const JsonTransformer: ValueTransformer = {
  to: (value: unknown) => value,
  from: (value: unknown) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  },
};
