import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

document.documentElement.style.backgroundColor = '#0a0a0f';
document.body.style.backgroundColor = '#0a0a0f';

createRoot(document.getElementById("root")!).render(<App />);
