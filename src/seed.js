require('dns').setServers(['8.8.8.8','1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const users = [
  { name: 'Super Admin', email: 'superadmin@test.com', role: 'SuperAdmin' },
  { name: 'Manager One', email: 'manager@test.com', role: 'Manager' },
  { name: 'Employee One', email: 'employee@test.com', role: 'Employee' },
];
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  for (const u of users) {
    await User.findOneAndUpdate({ email: u.email }, { ...u, passwordHash: await bcrypt.hash('Test@12345', 12), failedAttempts: 0, lockUntil: null }, { upsert: true });
  }
  console.log('Seeded 3 users'); process.exit(0);
})();
