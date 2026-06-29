import { createContext, useContext } from 'react';
import type { Session } from '@/lib/types';

type Ctx = {
  session: Session | null;
  setSession: (s: Session | null) => void;
  /**
   * True once the boot-time session check has completed (whether or not
   * a session was found). Use this to gate UI that depends on knowing
   * whether the user is signed in — checking `session === null` while
   * `authChecked` is still false gives a misleading "not signed in" read.
   */
  authChecked: boolean;
};

export const SessionContext = createContext<Ctx>({
  session: null,
  setSession: () => {},
  authChecked: false,
});

export function useSession(): Ctx {
  return useContext(SessionContext);
}
