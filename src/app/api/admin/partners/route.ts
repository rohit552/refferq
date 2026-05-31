// Forward to /api/admin/affiliates for backward compatibility
// This route mirrors all functionality of the affiliates endpoint
// but uses the new "partners" naming convention for SkillHeed NEP

export { GET, POST, PUT, DELETE, PATCH } from '../affiliates/route';
