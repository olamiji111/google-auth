import { Controller, Get, Req, UseGuards, Res, Param } from '@nestjs/common';
import { GoogleAuthGuard } from '../common/guards/google-auth-guard';
import type { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  private readonly verificationFailedHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Verification Failed</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: #E9EEF6;
    }

    .card {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 400px;
    }

    .logo {
      width: 48px;
      height: 48px;
      margin-bottom: 15px;
    }

    h2 {
      color: #d32f2f;
      margin-top: 0;
    }

    p {
      margin: 15px 0;
      color: #555;
    }

    a {
      display: inline-block;
      padding: 12px 24px;
      background: #4285f4;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="card">
    <img
      src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png"
      alt="Google"
      class="logo"
    />

    <h2>Verification Failed</h2>

    <p>
      Your Workspace account could not be verified Successfuly
    </p>
    <p>
         Please retry the verification process.
    </p>
    
    <a href="/auth">
      Try Again
    </a>
  </div>
</body>
</html>
`;
  private readonly verificationSuccessHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Verification Successful</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: #E9EEF6;
    }

    .card {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 400px;
    }

    .logo {
      width: 48px;
      height: 48px;
      margin-bottom: 15px;
    }

    .check {
      font-size: 56px;
      color: #34A853;
      margin-bottom: 15px;
    }

    h2 {
      color: #34A853;
      margin-top: 0;
    }

    p {
      margin: 15px 0;
      color: #555;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="card">
    <img
      src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png"
      alt="Google"
      class="logo"
    />

    <div class="check">✓</div>

    <h2>Verification Successful</h2>

    <p>
      Your Workspace account has been verified successfully.
    </p>
  </div>
</body>
</html>
`;
  @Get()
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Redirects user to Google
  }

  @Get('callback')
  @UseGuards(GoogleAuthGuard)
  googleAuthCallback(@Req() req: any, @Res() res: Response) {
    if (!req.user?.gmailConnected) {
      return res.send(this.verificationFailedHtml);
    }

    return res.send(this.verificationSuccessHtml);
  }

  @Get('attachment/:attachmentId')
  downloadAttachment(
    @Param('attachmentId')
    attachmentId: string,
    @Res() res: Response,
  ) {
    return this.authService.downloadAttachment(attachmentId, res);
  }

  @Get('outbox/attachment/:attachmentId')
  downloadOutboxAttachment(
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    return this.authService.downloadOutboxAttachment(attachmentId, res);
  }
}
