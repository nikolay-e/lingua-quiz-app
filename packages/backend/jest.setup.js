const path = require('node:path');

const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, 'tests', '.test.env') });
