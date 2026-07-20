import * as authActions from "./actions";
import { authAPI, apiClient } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { User, Session } from "@supabase/supabase-js";
import { type UserProfile } from "@/api/userProfiles";
import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { DEFAULT_PROFILE_PROGRESS, type ProfileProgress } from "@/utils/profileCompletion";

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
  profileProgress: ProfileProgress;
  profileCompletion: number;
  profileReady: boolean;
  setUserImg: (img: string | null) => void;
  setUserName: (name: string | null) => void;
  setProfileProgress: (progress: ProfileProgress) => void;
  setProfileCompletion: (completion: number) => void;
  hasNewMessage: boolean;
  setHasNewMessage: (hasNew: boolean) => void;
  isProfileComplete: boolean;
  loading: boolean;
  initialCheckComplete: boolean;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: any }>;
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
  const [profileProgress, setProfileProgress] = useState<ProfileProgress>(DEFAULT_PROFILE_PROGRESS);

  const setProfileCompletion = useCallback((completion: number) => {
    setProfileProgress((prev) => ({ ...prev, completion }));
  }, []);

  const profileCompletion = profileProgress.completion;

  const [userImg, setUserImg] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  const [hasNewMessage, setHasNewMessage] = useState(false);
  const { toast } = useToast();
  const initialCheckDone = useRef(false);
  const lastProfileFetch = useRef<number>(0);
  const previousUserIdRef = useRef<string | null>(null);
  const lastSessionRefresh = useRef<number>(0);

  useEffect(() => {
    // Set up auth state listener using Supabase directly (for real-time updates)
    const {
      data: { subscription },
    } = apiClient
      .getSupabaseClient()
      .auth.onAuthStateChange((event, session) => {
        (async () => {
          // Handle explicit sign out event
          if (event === 'SIGNED_OUT') {
            setLoading(false);
            setProfileReady(true);
            setSession(null);
            setUser(null);
            setUserProfile(null);
            previousUserIdRef.current = null;
            return;
          }

          setLoading(true);
          setProfileReady(false);
          setSession(session);
          const nextUserId = session?.user?.id ?? null;
          setUser(session?.user ?? null);

          const previousUserId = previousUserIdRef.current;
          previousUserIdRef.current = nextUserId;

          // Only fetch user profile for actual auth events (not window focus)
          // and only if not fetched recently (within last 2 minutes) unless the user changed
          const now = Date.now();
          const userChanged = Boolean(nextUserId && nextUserId !== previousUserId);
          const shouldFetchProfile =
            nextUserId &&
            initialCheckDone.current &&
            (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
            (userChanged || now - lastProfileFetch.current > 120000); // 2 minutes

          try {
            if (shouldFetchProfile) {
              await authActions.fetchUserProfile(nextUserId, setUserProfile);
              lastProfileFetch.current = now;
            } else if (!session?.user?.id) {
              setUserProfile(null);
            }
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
        setSession(response.data);
        setUser(response.data.user ?? null);

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
        setSession(data.session);
        setUser(data.user ?? data.session.user ?? null);
        if (data.session.user?.id) {
          await authActions.fetchUserProfile(data.session.user.id, setUserProfile);
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

  const signUp = async (email: string, password: string, name?: string) => {
    return authActions.signUp(email, password, toast, name);
  };

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
      setProfileProgress,
      setProfileCompletion
    );

    // Reset profile fetch timer so next login always fetches fresh data
    lastProfileFetch.current = 0;
    return result;
  };

  const requestPasswordReset = async (email: string) => {
    return authActions.requestPasswordReset(email, toast);
  };

  const updatePassword = async (newPassword: string) => {
    return authActions.updatePassword(newPassword, toast);
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
        signUp,
        userImg,
        setUserImg,
        userName,
        setUserName,
        profileProgress,
        profileCompletion,
        setProfileProgress,
        setProfileCompletion,
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
