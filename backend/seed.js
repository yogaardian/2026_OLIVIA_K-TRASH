const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const bcrypt = require('bcryptjs');
const db = require('./src/db');

const SALT_ROUNDS = 10;

async function seedDefaultAccounts() {
  const users = [
    {
      nama: 'Petugas Demo',
      email: 'petugas@test.com',
      password: await bcrypt.hash('123456', SALT_ROUNDS),
      role: 'driver',
      nomor_hp: '081234567890',
    },
    {
      nama: 'User Demo',
      email: 'user@test.com',
      password: await bcrypt.hash('123456', SALT_ROUNDS),
      role: 'user',
      nomor_hp: '081234567891',
    },
    {
      nama: 'Admin Demo',
      email: 'admin@test.com',
      password: await bcrypt.hash('123456', SALT_ROUNDS),
      role: 'admin',
      nomor_hp: '081234567892',
    },
  ];

  for (const u of users) {
    try {
      const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [u.email]);
      if (existing.length === 0) {
        await db.query(
          'INSERT INTO users (nama,email,password,role,nomor_hp, saldo, saldo_hold) VALUES (?,?,?,?,?,0,0)',
          [u.nama, u.email, u.password, u.role, u.nomor_hp],
        );
        console.log(`Seeded demo account: ${u.email}`);
      } else {
        console.log(`Demo account already exists: ${u.email}`);
      }
    } catch (err) {
      console.error('Seed error for user', u.email, err);
    }
  }
}

(async () => {
  try {
    await seedDefaultAccounts();
    console.log('Seed script completed.');
    process.exit(0);
  } catch (err) {
    console.error('Seed script failed:', err);
    process.exit(1);
  }
})();