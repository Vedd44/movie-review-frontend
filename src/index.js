import React from "react";
import ReactDOM from "react-dom/client";
import ConsentAnalytics from "./components/ConsentAnalytics";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { trackProductEvent } from "./analytics";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
    <ConsentAnalytics />
  </React.StrictMode>
);

reportWebVitals((metric) => {
  trackProductEvent("web_vital", {
    metric: metric.name,
    value: Math.round(metric.value),
    rating: metric.rating || "unknown",
  });
});
