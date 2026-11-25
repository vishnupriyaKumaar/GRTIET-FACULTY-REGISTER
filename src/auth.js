// Login is checked by the SERVER.  The password is never kept in the browser; the server hands out a signed
// token that lasts 12 hours for this tab.  Admin = full access, Teacher = Add Teacher only.
import { api, setToken } from './api.js';

export async function login(role, password) {
  const r = await api('login', { role, password });
  setToken(r.token); setRole(r.role);
  return r.role;
}
export async function changePassword(current, next) { await api('changePassword', { current, next }); }

export const getRole = () => { try { const r = sessionStorage.getItem('grt_role'); return r === 'admin' || r === 'teacher' ? r : ''; } catch { return ''; } };
export function setRole(role) { try { role ? sessionStorage.setItem('grt_role', role) : sessionStorage.removeItem('grt_role'); } catch { /* ignore */ } if (!role) setToken(''); }
