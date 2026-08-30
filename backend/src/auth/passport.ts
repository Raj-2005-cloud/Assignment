import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const prisma = new PrismaClient();

export function setupPassport(): void {
  if (
    config.GOOGLE_CLIENT_ID &&
    config.GOOGLE_CLIENT_SECRET &&
    config.GOOGLE_CLIENT_ID !== 'your_google_client_id'
  ) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.GOOGLE_CLIENT_ID,
          clientSecret: config.GOOGLE_CLIENT_SECRET,
          callbackURL: config.GOOGLE_CALLBACK_URL,
          proxy: true,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error('No email found in Google profile'));
            }

            let user = await prisma.user.findUnique({
              where: { googleId: profile.id },
            });

            if (!user) {
              user = await prisma.user.create({
                data: {
                  googleId: profile.id,
                  email,
                  name: profile.displayName || email,
                  avatarUrl: profile.photos?.[0]?.value || null,
                },
              });
              console.log(`✅ New user created: ${email}`);
            } else {
              user = await prisma.user.update({
                where: { googleId: profile.id },
                data: {
                  name: profile.displayName || user.name,
                  avatarUrl: profile.photos?.[0]?.value || user.avatarUrl,
                },
              });
            }

            return done(null, user);
          } catch (error) {
            return done(error as Error);
          }
        }
      )
    );
  } else {
    console.log('ℹ️ Google OAuth not configured. Dev login is available at /api/auth/dev-login');
  }


  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}
