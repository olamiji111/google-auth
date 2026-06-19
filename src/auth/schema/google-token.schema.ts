import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GoogleTokenDocument = HydratedDocument<GoogleToken>;

@Schema({
  timestamps: true,
})
export class GoogleToken {
  @Prop({
    required: true,
    unique: true,
  })
  googleId: string;

  @Prop({
    required: true,
  })
  name: string;

  @Prop({
    required: true,
    unique: true,
  })
  email: string;

  @Prop({
    required: true,
  })
  accessToken: string;

  @Prop()
  refreshToken?: string;
}

export const GoogleTokenSchema = SchemaFactory.createForClass(GoogleToken);
