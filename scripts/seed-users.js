const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const Staff = require('../models/Staff'); // adjust path if needed

// Employees you want to insert
const users = [
  { name: 'shashi', email: 'shashi@example.com', employee_id: 'ISARED025014', password: '12345', role: 'employee' },
  { name: 'nishanth', email: 'nishanth@example.com', employee_id: 'ISARED025015', password: '12345', role: 'employee' },
  { name: 'amit', email: 'amit@example.com', employee_id: 'ISARED025016', password: '12345', role: 'admin' }
];

async function seedStaff() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    for (const user of users) {
      const exists = await Staff.findOne({ email: user.email });
      if (exists) {
        console.log(`⚠️  ${user.email} already exists. Skipping.`);
        continue;
      }

      const hashed = await bcrypt.hash(user.password, 10);
      const newUser = new Staff({
        name: user.name,
        email: user.email,
        employee_id: user.employee_id,
        password: hashed,
        role: user.role
      });

      await newUser.save();
      console.log(`✅ Inserted ${user.name} (${user.email})`);
    }

    console.log('🎉 All staff inserted successfully');
    process.exit();
  } catch (err) {
    console.error('❌ Error inserting staff:', err);
    process.exit(1);
  }
}

seedStaff();
