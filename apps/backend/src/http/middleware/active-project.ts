import type { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { ProjectModel } from '../../db';

/**
 * Express middleware: reject manual crawl/audit/sync/report/render requests for archived
 * projects. Doc 10 §"Expected Archive Behavior". Restore re-enables these endpoints. Read-only
 * GETs and analyst-edit endpoints (status changes, notes, etc.) are intentionally allowed so
 * historical data stays usable.
 */
export async function requireActiveProject(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const id = String(req.params.id ?? '');
  if (!id || !Types.ObjectId.isValid(id)) {
    next();
    return;
  }
  try {
    const p = await ProjectModel.findById(id).select({ status: 1 }).lean();
    if (!p) {
      res.status(404).json({ error: 'project not found' });
      return;
    }
    if (p.status === 'archived') {
      res.status(409).json({
        error:
          'Project is archived. Restore it from Project Settings → Danger Zone before running new crawls, audits, syncs, reports, or renders.',
        code: 'project_archived',
      });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
