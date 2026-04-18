import React from "react";
import { createRoot } from "react-dom/client";
import { SidePanelPage } from "./pages/SidePanelPage";

const container = document.createElement("div");
document.body.appendChild(container);
createRoot(container).render(<SidePanelPage />);
