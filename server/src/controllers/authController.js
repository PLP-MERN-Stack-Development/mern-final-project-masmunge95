const asyncHandler = require('../utils/asyncHandler');

// Returns minimal info about the authenticated user
exports.whoami = asyncHandler(async (req, res) => {
  try {
    const userId = req.auth?.userId || null;
    const role = req.auth?.sessionClaims?.metadata?.role || null;
    res.status(200).json({ userId, role });
  } catch (err) {
    console.error('[Auth] whoami error', err);
    res.status(500).json({ error: 'Failed to determine user' });
  }
});
