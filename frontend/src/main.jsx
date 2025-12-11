import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/Root.css";
import "./styles/Messages.css";
import "./styles/Friends.css";
import "./styles/Form.css";
import "./styles/TypewriterEffect.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
