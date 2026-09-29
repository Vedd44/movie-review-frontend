import React from "react";

function CinematicAtmosphere({ active = false, loading = false }) {
  return (
    <div
      className={`page-atmosphere${active ? " is-active" : ""}${loading ? " is-loading" : ""}`}
      aria-hidden="true"
    />
  );
}

export default React.memo(CinematicAtmosphere);
