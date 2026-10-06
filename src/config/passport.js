const passport = require('passport');
const { Strategy: GitHubStrategy } = require('passport-github2');
const User = require('../models/User');

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: `${process.env.BASE_URL}/api/v1/auth/github/callback`,
  scope: ['user:email'],
}, async (_at, _rt, profile, done) => {
  try {
    const email = (profile.emails?.[0]?.value || `${profile.username}@users.noreply.github.com`).toLowerCase();
    // Sync profile: match by githubId, else link to existing email, else create (Employee)
    let user = await User.findOne({ githubId: profile.id }) || await User.findOne({ email });
    if (!user) user = new User({ email, role: 'Employee' });
    user.githubId = profile.id;
    user.name = profile.displayName || profile.username;
    await user.save();
    done(null, user);
  } catch (e) { done(e); }
}));
module.exports = passport;
