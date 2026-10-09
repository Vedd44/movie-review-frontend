const { createAdminEmailHandler } = require('../server/adminEmailForwarding');

// Consume the untouched Node request stream; never read or reserialize req.body.
module.exports = createAdminEmailHandler();
