import db from './server/db/database.js';
import { createVault } from './server/controllers/vaultController.js';
const req = { body: { category: 'Birthday', title: 'Test', wish: 'Happy BDay' } };
const res = { status: (c) => ({ json: (d) => console.log(c, d) }) };
createVault(req, res).then(() => process.exit(0)).catch(console.error);
