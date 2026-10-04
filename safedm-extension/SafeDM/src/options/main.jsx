import React from "react";
import { createRoot } from "react-dom/client";
import Options from "./Options.jsx";
import "../index.css";

document.body.classList.add("options-document");
createRoot(document.getElementById("options-root")).render(<Options />);
