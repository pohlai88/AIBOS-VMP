import express from 'express';
import { vmpAdapter } from '../adapters/supabase.js';
import { requireAuth, handleRouteError } from '../utils/route-helpers.js';

const vendorRouter = express.Router();

/**
 * Vendor Dashboard
 * Route: GET /vendor/dashboard
 *
 * Displays vendor's cases with filtering, search, and pagination
 * Anti-drift: NO business logic here; all filtering delegated to adapter
 */
vendorRouter.get('/dashboard', (req, res) => {
  // Check auth first
  if (!requireAuth(req, res)) {
    return;
  }

  const vendorId = req.user.vendorId;
  const { status, search, from_date, page = 1 } = req.query;

  (async () => {
    try {
      // Fetch vendor data, cases, and unread count in parallel
      const [vendor, cases, unreadCount] = await Promise.all([
        vmpAdapter.getVendor(vendorId),
        vmpAdapter.getCasesByVendor(vendorId, {
          status,
          search,
          from_date,
          limit: 12,
          offset: (page - 1) * 12,
        }),
        vmpAdapter.getUnreadCount(req.user.id),
      ]);

      // Render template with data
      res.render('pages/vendor-dashboard.html', {
        vendor,
        cases: cases.data,
        pagination: cases.pagination,
        filters: { status, search, from_date },
        unread_count: unreadCount,
      });
    } catch (error) {
      handleRouteError(error, req, res, 'pages/error.html');
    }
  })();
});

export default vendorRouter;
