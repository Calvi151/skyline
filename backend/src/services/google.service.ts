import { OAuth2Client } from 'google-auth-library'

export interface GooglePayload {
  googleId: string
  email: string
  name: string
  emailVerified: boolean
}

export class GoogleService {
  private client: OAuth2Client

  constructor() {
    this.client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  }

  async verifyIdToken(idToken: string): Promise<GooglePayload> {
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID is not configured')
    }

    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: clientId,
    })

    const payload = ticket.getPayload()
    if (!payload || !payload.sub || !payload.email) {
      throw new Error('GOOGLE_TOKEN_INVALID')
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name || payload.email.split('@')[0],
      emailVerified: Boolean(payload.email_verified),
    }
  }
}

export const googleService = new GoogleService()
