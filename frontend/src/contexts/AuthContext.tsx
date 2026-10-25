import * as authActions from "./actions";
import { authAPI, apiClient } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { User, Session } from "@supabase/supabase-js";
import { type UserProfile } from "@/api/userProfiles";
import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { planAuthEvent } from "@/utils/authEvents";
import { campsAPI } from "@/api/camps";

// Helper to check if profile is complete based on required fields
const isProfileCompleteHelper = (userProfile: UserProfile | null): boolean => {
  if (!userProfile) return false;
  return userProfile.is_profile_completed === true;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  userImg: string | null;
  userName: string | null;
  profileReady: boolean;
  setUserImg: (img: string | null) => void;
  setUserName: (name: string | null) => void;
  hasNewMessage: boolean;
  setHasNewMessage: (hasNew: boolean) => void;
  isProfileComplete: boolean;
  loading: boolean;
  initialCheckComplete: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  requestPasswordReset: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: any }>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  const [userImg, setUserImg] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  const [hasNewMessage, setHasNewMessage] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initialCheckDone = useRef(false);
  const lastProfileFetch = useRef<number>(0);
  const previousUserIdRef = useRef<string | null>(null);
  const lastSessionRefresh = useRef<number>(0);

  useEffect(() => {
    // Keep the same user object when only the token changed, so pages that depend on `user`
    // don't re-run their effects on every refresh.
    const applySession = (next: Session | null) => {
      setSession(next);
      const nextUser = next?.user ?? null;
      setUser((prev) =>
        prev && nextUser && prev.id === nextUser.id && prev.updated_at === nextUser.updated_at ? prev : nextUser
      );
    };

    // Set up auth state listener using Supabase directly (for real-time updates)
    const {
      data: { subscription },
    } = apiClient
      .getSupabaseClient()
      .auth.onAuthStateChange((event, session) => {
        (async () => {
          const nextUserId = session?.user?.id ?? null;
          const previousUserId = previousUserIdRef.current;
          const plan = planAuthEvent(event, previousUserId, nextUserId, initialCheckDone.current);

          if (plan.clear) {
            authActions.clearAllUserProfileCaches();
            previousUserIdRef.current = null;
            setSession(null);
            setUser(null);
            setUserProfile(null);
            setProfileReady(true);
            setLoading(false);
            return;
          }

          if (session) applySession(session);
          if (!plan.fetchProfile || !nextUserId) return;
          previousUserIdRef.current = nextUserId;

          // Only a different signed-in user blocks the app. Everything else refreshes quietly.
          if (!plan.blocking) {
            await authActions.fetchUserProfile(nextUserId, setUserProfile, { quiet: true });
            lastProfileFetch.current = Date.now();
            return;
          }

          setLoading(true);
          setProfileReady(false);
          try {
            await authActions.fetchUserProfile(nextUserId, setUserProfile);
            lastProfileFetch.current = Date.now();
          } finally {
            setProfileReady(true);
            setLoading(false);
          }
        })();
      });

    // Check for existing session using API layer
    const checkSession = async () => {
      setLoading(true);
      setProfileReady(false);
      const response = await authAPI.getSession();
      if (!response.error && response.data) {
        applySession(response.data);
        previousUserIdRef.current = response.data.user?.id ?? null;

        // Fetch user profile if session exists
        if (response.data.user?.id) {
          await authActions.fetchUserProfile(response.data.user.id, setUserProfile);
          lastProfileFetch.current = Date.now();
        }
      } else {
        // No session - clear profile
        setUserProfile(null);
      }
      initialCheckDone.current = true;
      setInitialCheckComplete(true);
      setProfileReady(true);
      setLoading(false);
    };

    checkSession();

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Back on the tab: refresh the session and profile quietly, never behind a spinner.
    const refreshIfNeeded = async () => {
      if (!initialCheckDone.current) return;
      const now = Date.now();
      if (now - lastSessionRefresh.current < 60000) return; // avoid rapid refreshes
      lastSessionRefresh.current = now;

      try {
        const { data, error } = await apiClient.getSupabaseClient().auth.refreshSession();
        if (error || !data.session) {
          return;
        }
        // The TOKEN_REFRESHED event updates the session. Only the profile is refreshed here.
        const userId = data.session.user?.id;
        if (userId && now - lastProfileFetch.current > 60000) {
          await authActions.fetchUserProfile(userId, setUserProfile, { quiet: true });
          lastProfileFetch.current = Date.now();
        }
      } catch (err) {
        console.error("Session refresh failed", err);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshIfNeeded();
      }
    };

    const handleFocus = () => {
      void refreshIfNeeded();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);
  
  // Sync userName and userImg from userProfile whenever it changes
  useEffect(() => {
    if (userProfile) {
      if (userProfile.name && userProfile.name !== userName) {
        setUserName(userProfile.name);
      }
      if (userProfile.image_url !== userImg) {
        // Set userImg even if image_url is null to override Google photo with database value
        setUserImg(userProfile.image_url);
      }
    }
  }, [userProfile, userName, userImg]);

  // Camp sign-ups made with this email before the account existed: link them to the account
  // once per session, in the background. A finished family account with a confirmed email only.
  const claimUserId = user?.id ?? null;
  const emailConfirmed = Boolean(user?.email_confirmed_at);
  const familyReady =
    profileReady && userProfile?.is_profile_completed === true && userProfile.persona_type !== "coach" && !userProfile.coach_id;
  useEffect(() => {
    if (!claimUserId || !emailConfirmed || !familyReady) return;
    const key = `athanext:camp-claim:${claimUserId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // No storage: claim anyway, it is safe to repeat.
    }
    campsAPI
      .claim()
      .then((result) => {
        if (result.claimed > 0 || result.athletes_created > 0 || (result.athletes_merged ?? 0) > 0) void queryClient.invalidateQueries({ queryKey: ["my-camps"] });
      })
      .catch((err) => console.warn("Linking camp sign-ups failed", err));
  }, [claimUserId, emailConfirmed, familyReady, queryClient]);

  const signIn = async (email: string, password: string) => {
    return authActions.signIn(email, password, toast);
  };

  const signOut = async () => {
    const result = await authActions.signOut(
      user,
      toast,
      setUser,
      setSession,
      setUserProfile,
      setUserImg,
      setUserName,
      queryClient
    );

    // Reset profile fetch timer so next login always fetches fresh data
    lastProfileFetch.current = 0;
    return result;
  };

  const requestPasswordReset = async (email: string) => {
    return authActions.requestPasswordReset(email);
  };

  const updatePassword = async (newPassword: string) => {
    return authActions.updatePassword(newPassword);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    return authActions.changePassword(user, currentPassword, newPassword, toast);
  };

  const refreshUserProfile = async () => {
    return authActions.refreshUserProfile(user, setUserProfile);
  };

  // Compute profile completion status based on current userProfile
  const isProfileComplete = isProfileCompleteHelper(userProfile);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userProfile,
        loading,
        profileReady,
        initialCheckComplete,
        userImg,
        setUserImg,
        userName,
        setUserName,
          hasNewMessage,
          setHasNewMessage,
          isProfileComplete,
        signIn,
        signOut,
        requestPasswordReset,
        updatePassword,
        changePassword,
        refreshUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
