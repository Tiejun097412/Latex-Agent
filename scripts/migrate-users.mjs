import fs from 'node:fs';
import { scryptSync, randomBytes } from 'node:crypto';

const path = new URL('../local_data/users/users.json', import.meta.url);
const users = JSON.parse(fs.readFileSync(path, 'utf8'));
for (const user of users) {
  if (user.password && !user.passwordHash) {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(user.password, salt, 64).toString('hex');
    user.passwordHash = `scrypt:${salt}:${hash}`;
    delete user.password;
  }
}
fs.writeFileSync(path, JSON.stringify(users, null, 2));
console.log('migrated');
