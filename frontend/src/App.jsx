import { useEffect, useState } from "react";
import { CompleteShelfLandingPage } from "@designcodeio/threeui";
import "@designcodeio/threeui/style.css";
import { api } from "./api.js";
import { FEATURES, featureByKey } from "./features.js";
import { Workspace } from "./components/Workspace.jsx";

// The ThreeUI shelf, configured exactly as the template's usage instructions.
export function Scene() {
  return (
    <div className="shader-frame">
      <CompleteShelfLandingPage
        headingFont="iowan-old-style"
        bodyFont="inter"
        headingWeight="400"
        bodyWeight="400"
        primaryColor="#c87046"
        headingSize={60}
        bodySize={12}
        headingLetterSpacing={-0.055}
      />
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState(null);
  const [health, setHealth] = useState({ state: "checking" });

  useEffect(() => {
    api
      .health()
      .then((h) => setHealth({ state: "ok", db: h.db.status }))
      .catch(() => setHealth({ state: "down" }));
  }, []);

  // The shelf runs inside an iframe; its "Start" buttons post the chosen volume to us.
  useEffect(() => {
    function onMessage(event) {
      if (event.origin !== window.location.origin || event.data?.type !== "talentverse:open") return;
      if (featureByKey[event.data.feature]) setActive(event.data.feature);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setActive(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const feature = active ? featureByKey[active] : null;

  return (
    <>
      <Scene />

      <nav className="quick-nav" aria-label="TalentVerse tools">
        <span className={`health health-${health.state}`} title="Backend status">
          {health.state === "ok" ? "API online" : health.state === "down" ? "API offline" : "Connecting…"}
        </span>
        {FEATURES.map((f) => (
          <button key={f.key} type="button" className={active === f.key ? "is-active" : ""} onClick={() => setActive(f.key)}>
            <span>{f.roman}</span> {f.title}
          </button>
        ))}
      </nav>

      {feature && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label={feature.label}>
          <Workspace key={feature.key} feature={feature} onClose={() => setActive(null)} />
        </div>
      )}
    </>
  );
}
