/**
 * Middleware to check for a specific user role from Clerk's session claims.
 * @param {string|string[]} requiredRoles - The role(s) required to access the route (e.g., 'seller' or ['seller', 'admin']).
 */
exports.requireRole = (requiredRoles) => {
  return (req, res, next) => {
    // ClerkExpressRequireAuth middleware should have already run and populated req.auth
    if (!req.auth || !req.auth.sessionClaims) {
      console.log('[Auth] No auth or sessionClaims found');
      return res.status(401).json({ message: 'Authentication required.' });
    }
    
    // Check both metadata and publicMetadata locations
    const userRole = req.auth.sessionClaims.metadata?.role || req.auth.sessionClaims.public_metadata?.role;
    const rolesToCheck = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    console.log('[Auth] Session claims:', JSON.stringify(req.auth.sessionClaims, null, 2));
    console.log('[Auth] User role:', userRole);
    console.log('[Auth] Required roles:', rolesToCheck);
    
    if (!userRole) {
      console.log('[Auth] No role found in session claims');
      return res.status(403).json({ 
        message: 'Forbidden: Role information is missing from your session token. Please sign out and sign back in.',
        debug: {
          metadata: req.auth.sessionClaims.metadata,
          public_metadata: req.auth.sessionClaims.public_metadata
        }
      });
    }
    
    if (!rolesToCheck.includes(userRole)) {
      console.log('[Auth] Role mismatch - User has:', userRole, 'Required:', rolesToCheck);
      return res.status(403).json({ message: `Forbidden: Your role ('${userRole}') does not have permission. Required: '${rolesToCheck.join(' or ')}'.` });
    }
    
    console.log('[Auth] Role check passed:', userRole);
    next();
  };
};