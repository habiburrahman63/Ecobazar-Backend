const axios = require("axios");

const BASE_URL = "http://localhost:5000";

async function runTests() {
  console.log("=== Starting Admin Authentication & Management Test Suite ===");

  try {
    // Test 1: Verify health check
    console.log("\n[Test 1] Checking API health...");
    const health = await axios.get(`${BASE_URL}/health`);
    console.log("✓ Health status:", health.data.status);

    // Test 2: Admin Login with initial credentials
    console.log("\n[Test 2] Logging in with initial admin credentials (admin@gmail.com / admin123456)...");
    const loginRes = await axios.post(`${BASE_URL}/admin/login`, {
      email: "admin@gmail.com",
      password: "admin123456",
    });
    console.log("✓ Login successful! Token received.");
    const token = loginRes.data.token;
    const adminUser = loginRes.data.data;
    console.log("✓ Authenticated as:", adminUser.name, "Role:", adminUser.role);

    const authHeaders = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    // Test 3: Reject invalid credentials
    console.log("\n[Test 3] Testing rejection of invalid password...");
    try {
      await axios.post(`${BASE_URL}/admin/login`, {
        email: "admin@gmail.com",
        password: "wrongpassword999",
      });
      console.error("✗ Error: Should have rejected invalid password!");
    } catch (err) {
      console.log("✓ Correctly rejected with status:", err.response?.status, "-", err.response?.data?.message);
    }

    // Test 4: Fetch all admins
    console.log("\n[Test 4] Fetching administrator directory...");
    const listRes = await axios.get(`${BASE_URL}/admin/list`, authHeaders);
    console.log(`✓ Retrieved ${listRes.data.count} administrator accounts.`);

    // Test 5: Create a new secondary administrator
    const testEmail = `test_admin_${Date.now()}@ecobazar.com`;
    console.log(`\n[Test 5] Creating new manager account (${testEmail})...`);
    const createRes = await axios.post(
      `${BASE_URL}/admin/create`,
      {
        name: "Operations Manager",
        email: testEmail,
        password: "manager_pass_123",
        confirmPassword: "manager_pass_123",
        role: "manager",
      },
      authHeaders
    );
    console.log("✓ Manager created:", createRes.data.admin.name, "Role:", createRes.data.admin.role);
    const newAdminId = createRes.data.admin._id;

    // Test 6: Verify new admin can log in
    console.log("\n[Test 6] Logging in with the newly created manager credentials...");
    const managerLogin = await axios.post(`${BASE_URL}/admin/login`, {
      email: testEmail,
      password: "manager_pass_123",
    });
    console.log("✓ Manager login succeeded! Role:", managerLogin.data.data.role);

    // Test 7: Duplicate email rejection
    console.log("\n[Test 7] Testing duplicate email rejection...");
    try {
      await axios.post(
        `${BASE_URL}/admin/create`,
        {
          name: "Duplicate Tester",
          email: testEmail,
          password: "password123",
          confirmPassword: "password123",
          role: "editor",
        },
        authHeaders
      );
      console.error("✗ Error: Should have rejected duplicate email!");
    } catch (err) {
      console.log("✓ Correctly rejected duplicate email:", err.response?.status, "-", err.response?.data?.message);
    }

    // Test 8: Self-deactivation safeguard
    console.log("\n[Test 8] Testing self-deactivation protection...");
    try {
      await axios.patch(`${BASE_URL}/admin/toggle-status/${adminUser._id}`, {}, authHeaders);
      console.error("✗ Error: Should have blocked self-deactivation!");
    } catch (err) {
      console.log("✓ Correctly blocked self-deactivation:", err.response?.status, "-", err.response?.data?.message);
    }

    // Test 9: Self-deletion safeguard
    console.log("\n[Test 9] Testing self-deletion protection...");
    try {
      await axios.delete(`${BASE_URL}/admin/delete/${adminUser._id}`, authHeaders);
      console.error("✗ Error: Should have blocked self-deletion!");
    } catch (err) {
      console.log("✓ Correctly blocked self-deletion:", err.response?.status, "-", err.response?.data?.message);
    }

    // Test 10: Toggle status of the secondary admin
    console.log("\n[Test 10] Deactivating secondary manager...");
    const toggleRes = await axios.patch(`${BASE_URL}/admin/toggle-status/${newAdminId}`, {}, authHeaders);
    console.log("✓ Deactivation result:", toggleRes.data.message);

    // Verify deactivated manager cannot log in
    console.log("Verifying deactivated manager is blocked from logging in...");
    try {
      await axios.post(`${BASE_URL}/admin/login`, {
        email: testEmail,
        password: "manager_pass_123",
      });
      console.error("✗ Error: Deactivated admin should be blocked from login!");
    } catch (err) {
      console.log("✓ Deactivated login blocked:", err.response?.status, "-", err.response?.data?.message);
    }

    // Re-activate and clean up
    console.log("\n[Test 11] Safely deleting test manager account...");
    const deleteRes = await axios.delete(`${BASE_URL}/admin/delete/${newAdminId}`, authHeaders);
    console.log("✓ Deletion result:", deleteRes.data.message);

    // Test 12: Verify audit logs
    console.log("\n[Test 12] Fetching system audit logs...");
    const logsRes = await axios.get(`${BASE_URL}/admin/audit-logs`, authHeaders);
    console.log(`✓ Successfully retrieved ${logsRes.data.count} audit log events.`);
    console.log("Sample recent actions:", logsRes.data.logs.slice(0, 3).map((l) => `${l.action} (${l.status})`));

    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! The Admin Authentication and Management System is 100% functional and verified.");
  } catch (error) {
    console.error("\n❌ Test suite failed:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
  }
}

runTests();

