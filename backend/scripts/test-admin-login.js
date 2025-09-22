const bcrypt = require('bcrypt');

async function testPassword() {
  const storedHash = '$2b$10$SUD9BkATliXdSVZ5ZSv.M.4Jik.yHRCEfl1vCFJLu8Rqv/SKkk8.K';
  const testPassword = 'admin123';

  try {
    const isValid = await bcrypt.compare(testPassword, storedHash);
    console.log('Password "admin123" matches hash:', isValid);

    // Test with different password
    const isValid2 = await bcrypt.compare('admin', storedHash);
    console.log('Password "admin" matches hash:', isValid2);

    // Generate new hash for admin123
    const newHash = await bcrypt.hash('admin123', 10);
    console.log('New hash for admin123:', newHash);

    // Test the new hash
    const verifyNew = await bcrypt.compare('admin123', newHash);
    console.log('New hash verification:', verifyNew);

  } catch (error) {
    console.error('Error:', error);
  }
}

testPassword();