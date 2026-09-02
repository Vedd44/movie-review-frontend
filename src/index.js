import React from "react";
import ReactDOM from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { trackProductEvent } from "./analytics";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
    <Analytics />
    <SpeedInsights />
  </React.StrictMode>
);

reportWebVitals((metric) => {
  trackProductEvent("web_vital", {
    metric: metric.name,
    value: Math.round(metric.value),
    rating: metric.rating || "unknown",
  });
});
