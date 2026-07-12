import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
// Engraved academy capitals for headers, warm humanist sans for everything else.
import "@fontsource/cinzel/600.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/alegreya-sans/400.css";
import "@fontsource/alegreya-sans/500.css";
import "@fontsource/alegreya-sans/700.css";
import "./styles.css";

// NOTE: no <React.StrictMode> — its dev-only double-mount detaches
// react-draggable's event handlers, which silently breaks drag/resize on the
// dashboard grid (react-grid-layout). StrictMode has no effect in production;
// dropping it only changes dev behavior, and keeps the dashboard usable.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
