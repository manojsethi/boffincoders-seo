import { Router } from 'express';
import { Types } from 'mongoose';
import { WebsiteProfileModel } from '../../db';
import { WebsiteProfileInput } from '@boffin/schemas';
import { approveProfile } from '../../domain';

export const profileRouter = Router();

profileRouter.get('/projects/:id/profile', async (req, res, next) => {
  try {
    const pid = new Types.ObjectId(req.params.id);
    const profile = await WebsiteProfileModel.findOne({ projectId: pid }).lean();
    if (!profile) {
      res.status(404).json({ error: 'no profile yet' });
      return;
    }
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

profileRouter.post('/projects/:id/profile/approve', async (req, res, next) => {
  try {
    const body = WebsiteProfileInput.partial().parse(req.body ?? {});
    await approveProfile({ projectId: req.params.id, approvedBy: 'analyst', edits: body });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
