import { Schema, model, Types } from 'mongoose';

/**
 * Per-project external integration record. OAuth tokens are stored as a single AES-256-GCM
 * encrypted blob — never plaintext. Decryption happens server-side via config/encryption.ts.
 */
const SiteConnectionSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, required: true },
    provider: { type: String, required: true },
    siteUrl: { type: String },
    ga4PropertyId: { type: String },

    // Encrypted JSON: { refreshToken, accessToken, accessTokenExpiresAt, scope, googleAccountEmail }.
    // Required for any provider that uses OAuth. Never returned to the frontend.
    encryptedTokens: { type: String },
    tokenEncryptionVersion: { type: Number, default: 1 },
    // Email of Google account behind the connection — non-sensitive metadata exposed in UI
    // so analyst can confirm which account they connected for GSC vs GA4.
    googleAccountEmail: { type: String },

    lastSyncedAt: { type: Date },
    status: { type: String, default: 'disconnected' },
    error: { type: String },
  },
  { collection: 'site_connections', timestamps: true },
);
SiteConnectionSchema.index({ projectId: 1, provider: 1 }, { unique: true });

export const SiteConnectionModel = model('SiteConnection', SiteConnectionSchema);
