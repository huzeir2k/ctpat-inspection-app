/**
 * Inspection Routes - SQLite Implementation
 * CRUD operations for inspections stored in local SQLite database
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDatabase } = require('../config/database');
const { asyncHandler, APIError, validateRequest } = require('../middleware/errorHandler');
const { inspectionSchema, listInspectionsSchema } = require('../utils/validators');

/**
 * Helper: Get all inspections
 */
function getAllInspections(filters = {}) {
  const db = getDatabase();
  
  let query = 'SELECT * FROM inspections WHERE 1=1';
  const params = [];

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  query += ' ORDER BY createdAt DESC LIMIT 100';

  try {
    const stmt = db.prepare(query);
    return stmt.all(...params);
  } catch (error) {
    console.error('Error fetching inspections:', error);
    return [];
  }
}

/**
 * Helper: Get inspection by ID
 */
function getInspectionById(inspectionId) {
  const db = getDatabase();
  try {
    const stmt = db.prepare('SELECT * FROM inspections WHERE inspectionId = ?');
    return stmt.get(inspectionId);
  } catch (error) {
    console.error('Error fetching inspection:', error);
    return null;
  }
}

/**
 * Helper: Parse inspectionPoints JSON
 */
function parseInspectionPoints(pointsJson) {
  try {
    return typeof pointsJson === 'string' ? JSON.parse(pointsJson) : pointsJson;
  } catch {
    return [];
  }
}

/**
 * GET /api/inspections
 * List all inspections
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const inspections = getAllInspections({ status });

    // Parse inspectionPoints JSON
    const parsed = inspections.map(inspection => ({
      ...inspection,
      inspectionPoints: parseInspectionPoints(inspection.inspectionPoints),
    }));

    res.json({
      success: true,
      data: {
        inspections: parsed,
        pagination: {
          total: parsed.length,
          page: 1,
          limit: 100,
          pages: 1,
        },
      },
    });
  })
);

/**
 * GET /api/inspections/:id
 * Get a specific inspection
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const inspection = getInspectionById(req.params.id);

    if (!inspection) {
      throw new APIError('Inspection not found', 404);
    }

    // Parse inspectionPoints
    inspection.inspectionPoints = parseInspectionPoints(inspection.inspectionPoints);

    res.json({
      success: true,
      data: inspection,
    });
  })
);

/**
 * POST /api/inspections
 * Create a new inspection
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    // Validate request body
    const { error, value } = inspectionSchema.validate(req.body);
    if (error) {
      throw new APIError(`Validation error: ${error.message}`, 400);
    }

    const db = getDatabase();
    const {
      truckNumber,
      trailerNumber,
      sealNumber,
      verifiedByName,
      printName,
      date,
      time,
      securityCheckboxChecked,
      agriculturalPestCheckboxChecked,
      recipientEmail,
      inspectionPoints,
    } = value;

    const inspectionId = `inspection_${uuidv4()}`;
    const now = new Date().toISOString();
    const pointsJson = JSON.stringify(inspectionPoints);
    const completionPercentage = Math.round(
      (inspectionPoints.filter(p => p.checked).length / inspectionPoints.length) * 100
    );

    try {
      const stmt = db.prepare(`
        INSERT INTO inspections (
          inspectionId, truckNumber, trailerNumber, sealNumber,
          verifiedByName, printName, date, time,
          securityCheckboxChecked, agriculturalPestCheckboxChecked,
          recipientEmail, inspectionPoints,
          completionPercentage, status, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        inspectionId,
        truckNumber,
        trailerNumber || null,
        sealNumber || null,
        verifiedByName || null,
        printName || null,
        date || null,
        time || null,
        securityCheckboxChecked ? 1 : 0,
        agriculturalPestCheckboxChecked ? 1 : 0,
        recipientEmail || null,
        pointsJson,
        completionPercentage,
        'draft',
        now,
        now
      );

      res.status(201).json({
        success: true,
        data: {
          inspectionId,
          truckNumber,
          trailerNumber,
          completionPercentage,
          status: 'draft',
        },
      });
    } catch (error) {
      console.error('Error creating inspection:', error);
      throw new APIError('Failed to create inspection', 500);
    }
  })
);

/**
 * PUT /api/inspections/:id
 * Update an inspection
 */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const db = getDatabase();
    const inspection = getInspectionById(req.params.id);

    if (!inspection) {
      throw new APIError('Inspection not found', 404);
    }

    const { truckNumber, inspectionPoints, status } = req.body;
    const now = new Date().toISOString();
    const pointsJson = JSON.stringify(inspectionPoints);
    const completionPercentage = inspectionPoints
      ? Math.round((inspectionPoints.filter(p => p.checked).length / inspectionPoints.length) * 100)
      : inspection.completionPercentage;

    try {
      const stmt = db.prepare(`
        UPDATE inspections
        SET truckNumber = ?, inspectionPoints = ?,
            completionPercentage = ?, status = ?, updatedAt = ?
        WHERE inspectionId = ?
      `);

      stmt.run(
        truckNumber || inspection.truckNumber,
        pointsJson,
        completionPercentage,
        status || inspection.status,
        now,
        req.params.id
      );

      res.json({
        success: true,
        data: { inspectionId: req.params.id },
      });
    } catch (error) {
      console.error('Error updating inspection:', error);
      throw new APIError('Failed to update inspection', 500);
    }
  })
);

/**
 * DELETE /api/inspections/:id
 * Delete an inspection
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const db = getDatabase();
    const inspection = getInspectionById(req.params.id);

    if (!inspection) {
      throw new APIError('Inspection not found', 404);
    }

    try {
      const stmt = db.prepare('DELETE FROM inspections WHERE inspectionId = ?');
      stmt.run(req.params.id);

      res.json({
        success: true,
        message: `Inspection ${req.params.id} deleted successfully`,
      });
    } catch (error) {
      console.error('Error deleting inspection:', error);
      throw new APIError('Failed to delete inspection', 500);
    }
  })
);

/**
 * DELETE /api/inspections/clear-all/all
 * Clear all inspections (used when clearing app data)
 * NOTE: This route must come BEFORE /:id route to be matched correctly
 */
router.delete(
  '/clear-all/all',
  asyncHandler(async (req, res) => {
    try {
      const db = getDatabase();
      const getAllStmt = db.prepare('SELECT COUNT(*) as count FROM inspections');
      const result = getAllStmt.get();
      const count = result.count;

      console.log(`🗑️  Clearing ${count} inspections from database...`);

      const deleteStmt = db.prepare('DELETE FROM inspections');
      deleteStmt.run();

      console.log(`✓ Deleted ${count} inspections`);

      res.json({
        success: true,
        message: `Successfully cleared ${count} inspections`,
        data: { deletedCount: count },
      });
    } catch (error) {
      console.error('Error clearing all inspections:', error);
      throw new APIError(`Failed to clear inspections: ${error.message}`, 500);
    }
  })
);

/**
 * GET /api/inspections/stats/summary
 * Get inspection statistics
 */
router.get(
  '/stats/summary',
  asyncHandler(async (req, res) => {
    try {
      const db = getDatabase();
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const totalStmt = db.prepare('SELECT COUNT(*) as count FROM inspections');
      const monthStmt = db.prepare('SELECT COUNT(*) as count FROM inspections WHERE date >= ?');
      const weekStmt = db.prepare('SELECT COUNT(*) as count FROM inspections WHERE date >= ?');

      const totalResult = totalStmt.get();
      const monthResult = monthStmt.get(thisMonth);
      const weekResult = weekStmt.get(thisWeek);

      res.json({
        success: true,
        data: {
          total: totalResult.count,
          thisMonth: monthResult.count,
          thisWeek: weekResult.count,
        },
      });
    } catch (error) {
      console.warn('⚠️  Error getting stats:', error);
      res.json({
        success: true,
        data: {
          total: 0,
          thisMonth: 0,
          thisWeek: 0,
        },
      });
    }
  })
);

module.exports = router;
