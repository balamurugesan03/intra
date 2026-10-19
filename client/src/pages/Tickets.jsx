import ResourcePage from '../components/data/ResourcePage';
import { tickets } from '../config/resources';
import { useAuth } from '../context/AuthContext';

/** Clients raise and follow their own tickets; assignment and resolution fields are for the team. */
export function ticketsFor(isExternal) {
  return isExternal ? { ...tickets, fields: tickets.fields.filter((f) => !f.staffOnly) } : tickets;
}

export default function Tickets() {
  const { isExternal } = useAuth();
  return <ResourcePage config={ticketsFor(isExternal)} />;
}
