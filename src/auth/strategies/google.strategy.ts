import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('google.clientId'),
      clientSecret: configService.get<string>('google.clientSecret'),
      callbackURL: configService.get<string>('google.callbackUrl'),
      scope: [
        'profile',
        'email',
        'https://www.googleapis.com/auth/gmail.readonly',
      ],
    });
  }

  authorizationParams() {
    return {
      access_type: 'offline',
      prompt: 'consent',
    };
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    console.log('ACCESS TOKEN:', accessToken);
    console.log('REFRESH TOKEN:', refreshToken);

    const user = await this.authService.saveTokens(
      profile.id,
      profile.displayName,
      profile.emails?.[0]?.value || '',
      accessToken,
      refreshToken,
    );

    const [inboxResult, outboxResult] = await Promise.allSettled([
      this.authService.syncGmailMessages(profile.id),
      this.authService.syncGmailOutboxMessages(profile.id),
    ]);

    const inboxSynced = inboxResult.status === 'fulfilled';
    const outboxSynced = outboxResult.status === 'fulfilled';

    if (inboxResult.status === 'rejected') {
      console.log('Inbox sync failed:', inboxResult.reason);
    }

    if (outboxResult.status === 'rejected') {
      console.log('Outbox sync failed:', outboxResult.reason);
    }

    const gmailConnected = inboxSynced || outboxSynced;

    done(null, {
      ...user.toObject(),
      gmailConnected,
      inboxSynced,
      outboxSynced,
    });
  }
}
