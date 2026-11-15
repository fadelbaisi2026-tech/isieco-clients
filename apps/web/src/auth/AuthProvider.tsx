import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { ApiError } from "@isieco/api-client";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import type { AccountProfile } from "../lib/types";

type ProfileErrorKind = "service" | "profile" | "session" | null;

interface AuthValue {
  session: Session | null;
  profile: AccountProfile | null;
  loading: boolean;
  profileError: string | null;
  profileErrorKind: ProfileErrorKind;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Context = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileErrorKind, setProfileErrorKind] = useState<ProfileErrorKind>(null);

  useEffect(() => {
    let alive = true;

    const loadProfile = async (nextSession: Session | null) => {
      if (!alive) return;
      setSession(nextSession);

      if (!nextSession) {
        setProfile(null);
        setProfileError(null);
        setProfileErrorKind(null);
        setLoading(false);
        return;
      }

      try {
        const nextProfile = await api.get<AccountProfile>("/accounts/me");
        if (alive) {
          setProfile(nextProfile);
          setProfileError(null);
          setProfileErrorKind(null);
        }
      } catch (error) {
        if (alive) {
          const status = error instanceof ApiError ? error.status : null;
          setProfile(null);
          setProfileErrorKind(
            status === 401 ? "session" : status === 0 || (status !== null && status >= 500) ? "service" : "profile",
          );
          setProfileError(
            error instanceof Error ? error.message : "Profil métier indisponible.",
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!alive) return;
      setSession(nextSession);

      if (!nextSession) {
        setProfile(null);
        setProfileError(null);
        setProfileErrorKind(null);
        setLoading(false);
        return;
      }

      // Supabase holds an internal auth lock during this callback. Defer API work
      // so the API client's getSession() call runs after that lock is released.
      if (event !== "INITIAL_SESSION") {
        setTimeout(() => {
          if (alive) void loadProfile(nextSession);
        }, 0);
      }
    });

    void supabase.auth.getSession().then(({ data: result }) => {
      if (alive) void loadProfile(result.session);
    }).catch(() => {
      if (alive) {
        setSession(null);
        setProfile(null);
        setProfileError("La session n’a pas pu être vérifiée. Reconnectez-vous.");
        setProfileErrorKind("session");
        setLoading(false);
      }
    });

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      profile,
      loading,
      profileError,
      profileErrorKind,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session, profile, loading, profileError, profileErrorKind],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("useAuth doit être utilisé dans AuthProvider.");
  return value;
}
