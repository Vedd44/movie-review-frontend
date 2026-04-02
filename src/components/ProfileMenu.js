import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProfileMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleWindowClick = () => setOpen(false);
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, [open]);

  const initial = useMemo(() => {
    const source = user?.user_metadata?.display_name || user?.email || "R";
    return String(source).trim().charAt(0).toUpperCase();
  }, [user?.email, user?.user_metadata?.display_name]);

  if (!user) {
    return null;
  }

  return (
    <div className="profile-menu-shell" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="profile-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="profile-menu-avatar" aria-hidden="true">{initial}</span>
      </button>
      {open ? (
        <div className="profile-menu-dropdown" role="menu">
          <Link to="/my-movies" className="profile-menu-link" role="menuitem" onClick={() => setOpen(false)}>
            Your Movies
          </Link>
          <Link to="/account" className="profile-menu-link" role="menuitem" onClick={() => setOpen(false)}>
            Account settings
          </Link>
          <button
            type="button"
            className="profile-menu-link profile-menu-link--button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              try {
                await signOut();
              } catch (error) {
                console.error("Error logging out of ReelBot:", error);
              }
            }}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default ProfileMenu;
