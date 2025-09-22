const bcrypt = require('bcryptjs');
const { ApiKey } = require('./backend/models');

async function createApiKey() {
  const keyValue = 't0bAXxyETOitEfEWuU37sWSqwJrE';
  const hashedKey = await bcrypt.hash(keyValue, 10);
  
  const apiKey = await ApiKey.create({
    name: 'OneAPI Key',
    key: hashedKey,
    description: 'API Key for OneAPI integration',
    permissions: JSON.stringify(['execute:commands', 'read:all', 'write:all']),
    created_by: 'admin',
    is_active: true,
    rate_limit: 1000
  });
  
  console.log('API Key created:', keyValue);
  console.log('Name:', apiKey.name);
}

createApiKey().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
