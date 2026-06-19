import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GmailOutboxDocument = HydratedDocument<GmailOutbox>;

@Schema({
    timestamps: true,
})
export class GmailOutbox {
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

                recipientEmail: String,
                recipientName: String,

                message: String,

                sentAt: Date,

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

        recipientEmail: string;
        recipientName: string;

        message: string;

        sentAt: Date;

        attachments: {
            filename: string;
            mimeType: string;
            content: Buffer;
        }[];
    }[];
}

export const GmailOutboxSchema = SchemaFactory.createForClass(GmailOutbox);
