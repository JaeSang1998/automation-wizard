import React, { useState } from "react";
import ReactDOM from "react-dom/client";

function PopupApp() {
  const [statusMessage, setStatusMessage] = useState("");
  const [sidePanelOpen, setSidePanelOpen] = useState(false);

  const handleToggleSidePanel = async () => {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;

    try {
      await browser.sidePanel.open({ tabId: tab.id });
      setSidePanelOpen(true);
      setStatusMessage("Side panel opened");
      setTimeout(() => setStatusMessage(""), 2000);
    } catch (error) {
      console.error("Failed to open side panel:", error);
      setStatusMessage("Failed to open side panel");
      setTimeout(() => setStatusMessage(""), 2000);
    }
  };

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "8px",
        minHeight: "auto",
        background: "#f9fafb",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        width: "300px",
      }}
    >
      <h2
        style={{
          fontSize: "14px",
          fontWeight: 700,
          marginBottom: "2px",
          color: "#111827",
        }}
      >
        🧙‍♂️ Automation Wizard
      </h2>

      {statusMessage && (
        <div
          style={{
            padding: "8px 12px",
            background: "#dbeafe",
            border: "1px solid #3b82f6",
            borderRadius: "6px",
            fontSize: "13px",
            color: "#1e40af",
          }}
        >
          {statusMessage}
        </div>
      )}

      <button
        onClick={handleToggleSidePanel}
        style={{
          padding: "6px 10px",
          background: sidePanelOpen ? "#10b981" : "#6b7280",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "12px",
          fontWeight: 600,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        {sidePanelOpen ? "📱 Side Panel ON" : "📱 Open Side Panel"}
      </button>
    </div>
  );
}

// DOM이 로드된 후 실행
function init() {
  const root = document.getElementById("root");
  if (root) {
    console.log("Mounting React app to popup");
    const reactRoot = ReactDOM.createRoot(root);
    reactRoot.render(<PopupApp />);
  } else {
    console.error("Root element not found");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
