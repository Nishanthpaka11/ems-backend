require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Staff = require("./models/staff");

// Connect to MongoDB (Clean version - no deprecated options)
mongoose
  .connect(process.env.MONGO_URI)  // ✅ Removed useNewUrlParser & useUnifiedTopology
  .then(async () => {
    console.log("✅ MongoDB connected for seeding...");
    console.log("📍 Database:", mongoose.connection.name); // ✅ Shows which DB you're using

    // Optional: clear old records before seeding new ones
    await Staff.deleteMany();

    // Hash passwords
    const adminHashedPassword = await bcrypt.hash("1122", 10);
    const employeeHashedPassword = await bcrypt.hash("1234", 10);

    // Create staff data
    const staffData = [
      {
        employee_id: "Admin1122",
        name: "Aditya (Admin)",
        email: "admin@example.com",
        phone: "9999999999",
        password: adminHashedPassword,
        role: "admin",
        position: "HR Manager",
        leave_quota: 30,
      },
      {
        employee_id: "ISARED025014",
        name: "Shashi",
        email: "employee@example.com",
        phone: "8888888888",
        password: employeeHashedPassword,
        role: "employee",
        position: "Software Engineer",
        leave_quota: 12,
      },
    ];

    // Insert into database
    await Staff.insertMany(staffData);

    console.log("🎉 Seed data inserted successfully!");
    console.log("➡ Admin Login:");
    console.log("   ID: Admin1122 | Password: 1122 | Email: admin@example.com");
    console.log("➡ Employee Login:");
    console.log("   ID: ISARED025014 | Password: 1234 | Email: employee@example.com");

    mongoose.connection.close();
  })
  .catch((err) => {
    console.error("❌ MongoDB seed error:", err.message);
    mongoose.connection.close();
  });
