import type { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { Types } from 'mongoose';
import { SiteConnectionModel } from '../../db';
import { decryptTokens, encryptTokens } from '../../config/encryption';
import { getLogger } from '../../config/logger';
import type { GoogleProvider } from './oauth';

const log = getLogger('integrations:account');

/**
 * Backfill `googleAccountEmail` on a SiteConnection when missing. Called from sync handlers so
 * connections created before the email-extraction fix still surface the connected Google account.
 */
export async function backfillGoogleAccountEmail(opts: {
  projectId: string;
  provider: GoogleProvider;
  oauth: OAuth2Client;
}): Promise<string | null> {
  try {
    const conn = await SiteConnectionModel.findOne({
      projectId: new Types.ObjectId(opts.projectId),
      provider: opts.provider,
    }).lean();
    if (!conn) return null;
    if ((conn as { googleAccountEmail?: string }).googleAccountEmail) {
      return (conn as { googleAccountEmail?: string }).googleAccountEmail ?? null;
    }

    const oauth2 = google.oauth2({ version: 'v2', auth: opts.oauth });
    const me = await oauth2.userinfo.get({});
    const email = me.data.email ?? undefined;
    if (!email) return null;

    // Update denormalized field + re-encrypt token payload to include email.
    let payload = conn.encryptedTokens ? decryptTokens(conn.encryptedTokens) : {};
    payload = { ...payload, googleAccountEmail: email };
    await SiteConnectionModel.updateOne(
      { _id: conn._id },
      {
        $set: {
          googleAccountEmail: email,
          encryptedTokens: encryptTokens(payload),
        },
      },
    );
    return email;
  } catch (err) {
    log.warn(
      { projectId: opts.projectId, provider: opts.provider, err: (err as Error).message },
      'googleAccountEmail backfill failed',
    );
    return null;
  }
}
