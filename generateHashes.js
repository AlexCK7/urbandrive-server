// generateHashes.js
const bcrypt = require('bcrypt');

const users = [
  { name: 'Taiga', email: 'taiga@example.com', password: 'admin123', role: 'admin' },
  { name: 'John Doe', email: 'user@example.com', password: 'user123', role: 'user' },
  { name: 'Jane Driver', email: 'driver@example.com', password: 'driver123', role: 'driver' },
];

(async () => {
  for (const user of users) {
    const hash = await bcrypt.hash(user.password, 10);
    console.log(
      `INSERT INTO users (name, email, password, role) VALUES ('${user.name}', '${user.email}', '${hash}', '${user.role}');`
    );
  }
})();
