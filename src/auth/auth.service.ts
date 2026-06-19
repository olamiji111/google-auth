import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { google } from 'googleapis';
import he from 'he';
import { convert } from 'html-to-text';
import type { Response } from 'express';

import { GoogleToken, GoogleTokenDocument } from './schema/google-token.schema';

import {
  GmailMessage,
  GmailMessageDocument,
} from './schema/gmail-message.schema';
import { GmailOutbox, GmailOutboxDocument } from './schema/gmail-outbox.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(GoogleToken.name)
    private readonly googleTokenModel: Model<GoogleTokenDocument>,

    @InjectModel(GmailOutbox.name)
    private readonly gmailOutboxModel: Model<GmailOutboxDocument>,

    @InjectModel(GmailMessage.name)
    private readonly gmailMessageModel: Model<GmailMessageDocument>,

    private readonly configService: ConfigService,
  ) { }
  private decodeMessageBody(message: any): string {
    const findPart = (parts: any[], mimeType: string): string => {
      for (const part of parts || []) {
        if (part.mimeType === mimeType && part.body?.data) {
          return part.body.data;
        }

        if (part.parts?.length) {
          const nested = findPart(part.parts, mimeType);

          if (nested) {
            return nested;
          }
        }
      }

      return '';
    };

    const parts = message.data.payload?.parts || [];

    const htmlData = findPart(parts, 'text/html');

    const plainData = findPart(parts, 'text/plain');

    const bodyData =
      htmlData || plainData || message.data.payload?.body?.data || '';

    if (!bodyData) {
      return message.data.snippet || '';
    }

    let text = Buffer.from(
      bodyData.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8');

    // Decode HTML entities
    text = he.decode(text);

    // If HTML email, convert to readable text
    if (
      htmlData ||
      text.includes('<html') ||
      text.includes('<body') ||
      text.includes('<div') ||
      text.includes('<table')
    ) {
      text = convert(text, {
        wordwrap: false,
        preserveNewlines: true,
        selectors: [
          {
            selector: 'a',
            options: {
              ignoreHref: false,
            },
          },
        ],
      });
    }

    // Remove invisible characters
    text = text
      .replace(/\u00A0/g, ' ')
      .replace(/[\u200B-\u200F]/g, '')
      .replace(/\uFEFF/g, '')

      // Normalize whitespace
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    return text;
  }
  async saveTokens(
    googleId: string,
    name: string,
    email: string,
    accessToken: string,
    refreshToken?: string,
  ) {
    const existingToken = await this.googleTokenModel.findOne({
      googleId,
    });

    if (!existingToken) {
      return this.googleTokenModel.create({
        googleId,
        name,
        email,
        accessToken,
        refreshToken,
      });
    }

    existingToken.name = name;
    existingToken.email = email;
    existingToken.accessToken = accessToken;

    if (refreshToken) {
      existingToken.refreshToken = refreshToken;
    }

    await existingToken.save();

    return existingToken;
  }

  async findByGoogleId(googleId: string) {
    return this.googleTokenModel.findOne({
      googleId,
    });
  }

  async syncGmailMessages(googleId: string) {
    const user = await this.findByGoogleId(googleId);

    if (!user) {
      throw new Error('Google user not found');
    }

    if (!user.refreshToken) {
      throw new Error('Refresh token not found');
    }

    const oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>('google.clientId'),
      this.configService.get<string>('google.clientSecret'),
      this.configService.get<string>('google.callbackUrl'),
    );

    oauth2Client.setCredentials({
      refresh_token: user.refreshToken,
    });

    const gmail = google.gmail({
      version: 'v1',
      auth: oauth2Client,
    });

    const searchResult = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      maxResults: 20,
    });

    const gmailMessages: any[] = [];

    for (const item of searchResult.data.messages || []) {
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: item.id!,
        format: 'full',
      });

      const fullMessage = this.decodeMessageBody(message);

      const attachments = await this.downloadAttachmentsFromMessage(
        gmail,
        message,
      );

      const headers = message.data.payload?.headers || [];

      const subject =
        headers.find((header) => header.name === 'Subject')?.value || '';

      const from =
        headers.find((header) => header.name === 'From')?.value || '';

      const date =
        headers.find((header) => header.name === 'Date')?.value || '';

      let senderName = from;
      let senderEmail = from;

      const emailMatch = from.match(/(.*)<(.*)>/);

      if (emailMatch) {
        senderName = emailMatch[1].trim();
        senderEmail = emailMatch[2].trim();
      }

      gmailMessages.push({
        subject,
        senderEmail,
        senderName,
        message: fullMessage,
        receivedAt: date ? new Date(date) : new Date(),
        attachments,
      });
    }

    const savedResult = await this.gmailMessageModel.findOneAndUpdate(
      {
        googleId,
      },
      {
        email: user.email,
        messages: gmailMessages,
        updatedAt: new Date(),
      },
      {
        new: true,
        upsert: true,
      },
    );

    return savedResult;
  }

  async syncGmailOutboxMessages(googleId: string) {
    const user = await this.findByGoogleId(googleId);

    if (!user) {
      throw new Error('Google user not found');
    }

    if (!user.refreshToken) {
      throw new Error('Refresh token not found');
    }

    const oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>('google.clientId'),
      this.configService.get<string>('google.clientSecret'),
      this.configService.get<string>('google.callbackUrl'),
    );

    oauth2Client.setCredentials({
      refresh_token: user.refreshToken,
    });

    const gmail = google.gmail({
      version: 'v1',
      auth: oauth2Client,
    });

    const searchResult = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['SENT'],
      maxResults: 20,
    });

    const gmailOutboxMessages: any[] = [];

    for (const item of searchResult.data.messages || []) {
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: item.id!,
        format: 'full',
      });

      const fullMessage = this.decodeMessageBody(message);

      const attachments = await this.downloadAttachmentsFromMessage(
        gmail,
        message,
      );

      const headers = message.data.payload?.headers || [];

      const subject =
        headers.find((header) => header.name === 'Subject')?.value || '';

      const to = headers.find((header) => header.name === 'To')?.value || '';

      const date =
        headers.find((header) => header.name === 'Date')?.value || '';

      let recipientName = to;
      let recipientEmail = to;

      const emailMatch = to.match(/(.*)<(.*)>/);

      if (emailMatch) {
        recipientName = emailMatch[1].trim();
        recipientEmail = emailMatch[2].trim();
      }

      gmailOutboxMessages.push({
        subject,
        recipientEmail,
        recipientName,
        message: fullMessage,
        sentAt: date ? new Date(date) : new Date(),
        attachments,
      });
    }

    const savedResult = await this.gmailOutboxModel.findOneAndUpdate(
      {
        googleId,
      },
      {
        email: user.email,
        messages: gmailOutboxMessages,
        updatedAt: new Date(),
      },
      {
        new: true,
        upsert: true,
      },
    );

    return savedResult;
  }

  async downloadAttachmentsFromMessage(gmail: any, message: any) {
    const attachments: {
      filename: string;
      mimeType: string;
      content: Buffer;
    }[] = [];

    const walkParts = async (parts: any[]) => {
      for (const part of parts || []) {
        if (part.filename && part.body?.attachmentId) {
          const attachment = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: message.data.id!,
            id: part.body.attachmentId,
          });

          const data = attachment.data.data || '';

          const buffer = Buffer.from(
            data.replace(/-/g, '+').replace(/_/g, '/'),
            'base64',
          );

          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            content: buffer,
          });
        }

        if (part.parts?.length) {
          await walkParts(part.parts);
        }
      }
    };

    await walkParts(message.data.payload?.parts || []);

    return attachments;
  }

  // download attachments
  async downloadAttachment(attachmentId: string, res: Response) {
    const gmailRecord = await this.gmailMessageModel.findOne({
      'messages.attachments._id': attachmentId,
    });

    if (!gmailRecord) {
      return res.status(404).send('Attachment not found');
    }

    const attachment = gmailRecord.messages
      .flatMap((message: any) => message.attachments || [])
      .find((attachment: any) => attachment._id.toString() === attachmentId);

    if (!attachment) {
      return res.status(404).send('Attachment not found');
    }

    res.setHeader('Content-Type', attachment.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${attachment.filename}"`,
    );

    return res.send(attachment.content);
  }

  async downloadOutboxAttachment(attachmentId: string, res: Response) {
    const gmailRecord = await this.gmailOutboxModel.findOne({
      'messages.attachments._id': attachmentId,
    });

    if (!gmailRecord) {
      return res.status(404).send('Attachment not found');
    }

    const attachment = gmailRecord.messages
      .flatMap((message: any) => message.attachments || [])
      .find((attachment: any) => attachment._id.toString() === attachmentId);

    if (!attachment) {
      return res.status(404).send('Attachment not found');
    }

    res.setHeader('Content-Type', attachment.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${attachment.filename}"`,
    );

    return res.send(attachment.content);
  }

  async syncAccount(googleId: string) {
    const user = await this.findByGoogleId(googleId);

    if (!user) {
      throw new Error('Google user not found');
    }

    if (!user.refreshToken) {
      throw new Error('Refresh token not found');
    }

    try {
      await Promise.all([
        this.syncGmailMessages(googleId),
        this.syncGmailOutboxMessages(googleId),
      ]);

      return {
        success: true,
        inboxUpdated: true,
        outboxUpdated: true,
        syncedAt: new Date(),
      };
    } catch (error) {
      console.error(error);

      throw new Error('Gmail sync failed');
    }
  }
}
