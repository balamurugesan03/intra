import { Project, WorkOrder, Task } from '../models/index.js';

const NONE = { _id: null };

/**
 * Project ids an external portal user (Client / Contractor / Worker) may see.
 * Returns `null` for internal staff, meaning "no restriction".
 */
export async function visibleProjectIds(user) {
  switch (user.role) {
    case 'Client':
      return user.client ? Project.find({ client: user.client }).distinct('_id') : [];
    case 'Contractor':
      return user.subcontractor ? WorkOrder.find({ subcontractor: user.subcontractor }).distinct('project') : [];
    case 'Worker':
      return Task.find({ assignedTo: user._id }).distinct('project');
    default:
      return null;
  }
}

/** Builds a mongo filter restricting a resource for external users. */
export const scopes = {
  projects: async (u) => {
    const ids = await visibleProjectIds(u);
    return ids ? { _id: { $in: ids } } : {};
  },
  byProject: async (u) => {
    const ids = await visibleProjectIds(u);
    return ids ? { project: { $in: ids } } : {};
  },
  quotations: async (u) => (u.role === 'Client' ? (u.client ? { client: u.client, status: { $ne: 'Draft' } } : NONE) : {}),
  tasks: async (u) => {
    if (u.role === 'Worker') return { assignedTo: u._id };
    return scopes.byProject(u);
  },
  tickets: async (u) => (u.role === 'Client' ? (u.client ? { client: u.client } : NONE) : {}),
  workOrders: async (u) => (u.role === 'Contractor' ? (u.subcontractor ? { subcontractor: u.subcontractor } : NONE) : {}),
  measurements: async (u) => {
    if (u.role === 'Contractor') return u.subcontractor ? { subcontractor: u.subcontractor } : NONE;
    if (u.role === 'Client') return { ...(await scopes.byProject(u)), measurementType: 'Client', status: { $ne: 'Draft' } };
    return {};
  },
  bills: async (u) => {
    if (u.role === 'Client') return u.client ? { client: u.client, billType: 'Client', status: { $ne: 'Draft' } } : NONE;
    if (u.role === 'Contractor') return u.subcontractor ? { subcontractor: u.subcontractor, billType: 'Contractor' } : NONE;
    return {};
  },
};
