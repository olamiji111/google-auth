import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { mongooseConfig } from './config/mongoose';
import { googleConfig } from './config/google.config';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Connection } from 'mongoose';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    AuthModule,

    ConfigModule.forRoot({
      isGlobal: true,
      load: [mongooseConfig, googleConfig],
    }),

    // MongoDB Database Connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('mongoose.uri'),
        onConnectionCreate: (connection: Connection) => {
          connection.on('connected', () => {
            console.log('Database connected successfully');
          });
          connection.on('error', (err) => {
            console.error('Database connection error:', err);
          });
          connection.on('disconnected', () => {
            console.log('Database disconnected');
          });
          return connection;
        },
      }),
    }),
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
