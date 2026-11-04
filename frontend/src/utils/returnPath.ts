/**
 * Where to go after signing in or signing up, kept in this tab. The router's location state
 * carries it for email sign-in, but Google sign-in leaves the site and comes back without it,
 * and a new account finishes the sign-up flow first. Used for shared session links
 * (/coach/<slug>?session=…) and any page that needs an account.
 */
const KEY = "athanext:return-path";

/** Only paths on this site: "/x", never "//other.site" or a full URL. */
const isLocalPath = (path: string) => path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/auth");

export const rememberReturnPath = (path: string) => {
  if (!isLocalPath(path)) return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // Storage blocked: email sign-in still returns through the router state.
  }
};

/** Reads and forgets the saved path, so it's used once. */
export const takeReturnPath = (): string | null => {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return path && isLocalPath(path) ? path : null;
  } catch {
    return null;
  }
};

export const forgetReturnPath = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
};
