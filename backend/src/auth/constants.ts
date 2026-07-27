// src/auth/constants.ts
export const jwtConstants = {
  secret: process.env.JWT_SECRET || 'your-strong-secret-key-here-min-32-chars',
};