// scripts/hash.js
const bcrypt = require('bcrypt');

const passwords = {
  admin: 'admin123',
  user: 'user123',
  driver: 'driver123',
};

(async () => {
  for (const [role, pass] of Object.entries(passwords)) {
    const hash = await bcrypt.hash(pass, 10);
    console.log(`${role}: ${hash}`);
  }
})();
