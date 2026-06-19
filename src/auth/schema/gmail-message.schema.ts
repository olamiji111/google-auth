import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GmailMessageDocument = HydratedDocument<GmailMessage>;

@Schema({
  timestamps: true,
})
export class GmailMessage {
  @Prop({
    required: true,
  })
  googleId: string;

  @Prop({
    required: true,
  })
  email: string;

  @Prop({
    type: [
      {
        subject: String,
        senderEmail: String,
        senderName: String,
        message: String,
        receivedAt: Date,

        attachments: [
          {
            filename: String,
            mimeType: String,
            content: Buffer,
          },
        ],
      },
    ],
    default: [],
  })
  messages: {
    subject: string;
    senderEmail: string;
    senderName: string;
    message: string;
    receivedAt: Date;

    attachments: {
      filename: string;
      mimeType: string;
      content: Buffer;
    }[];
  }[];
}

export const GmailMessageSchema = SchemaFactory.createForClass(GmailMessage);
