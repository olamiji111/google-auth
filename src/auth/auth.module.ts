import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';

import { GoogleToken, GoogleTokenSchema } from './schema/google-token.schema';

import {
  GmailMessage,
  GmailMessageSchema,
} from './schema/gmail-message.schema';

import { GmailOutbox, GmailOutboxSchema } from './schema/gmail-outbox.schema';

@Module({
  imports: [
    PassportModule.register({
      session: false,
    }),

    MongooseModule.forFeature([
      {
        name: GoogleToken.name,
        schema: GoogleTokenSchema,
      },
      {
        name: GmailMessage.name,
        schema: GmailMessageSchema,
      },
      {
        name: GmailOutbox.name,
        schema: GmailOutboxSchema,
      },
    ]),
  ],

  controllers: [AuthController],

  providers: [AuthService, GoogleStrategy],

  exports: [AuthService],
})
export class AuthModule { }
