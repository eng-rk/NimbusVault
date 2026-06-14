const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

module.exports = function (passport) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID || "placeholder_id",
                clientSecret: process.env.GOOGLE_CLIENT_SECRET || "placeholder_secret",
                callbackURL: (process.env.BACKEND_URL || "http://localhost:5000") + "/api/auth/google/callback",
                proxy: true,
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    // get data from profile
                    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
                    const googleId = profile.id;
                    const userName = profile.displayName || "Google User";
                    const avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

                    if (!email) {
                        return done(null, false, { message: "No email associated with Google account" });
                    }

                    // check if user already exists
                    let user = await User.findOne({ googleId });
                    if (!user) {
                        // try to find by email if it's their first time using Google but already registered
                        user = await User.findOne({ email });
                        if (user) {
                            // link accounts
                            user.googleId = googleId;
                            if (!user.avatar && avatar) {
                                user.avatar = avatar;
                            }
                            await user.save();
                        } else {
                            // create new user
                            user = await User.create({
                                userName,
                                email,
                                googleId,
                                avatar,
                                role: "user",
                            });
                        }
                    }

                    return done(null, user);
                } catch (error) {
                    return done(error, null);
                }
            }
        )
    );

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });
};
