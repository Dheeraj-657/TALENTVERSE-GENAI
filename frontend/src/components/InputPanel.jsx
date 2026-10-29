import { useEffect, useRef, useState } from "react";

const ACCEPT = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,audio/*";
const MIN_CHARS = 30;

export function InputPanel({ feature, profiles, busy, onSubmit }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [profileId, setProfileId] = useState("");
  const [recording, setRecording] = useState(false);
  const [localError, setLocalError] = useState("");
  const recorder = useRef(null);
  const fileInput = useRef(null);

  useEffect(() => {
    setText("");
    setFile(null);
    setLocalError("");
    setProfileId(feature.key === "job-matches" && profiles[0] ? profiles[0].id : "");
  }, [feature.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const needsProfile = feature.key === "job-matches";
  const usesProfile = feature.key !== "profiles";

  async function toggleRecording() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        setFile(new File([blob], `recording-${Date.now()}.webm`, { type: blob.type.split(";")[0] }));
        setRecording(false);
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      setLocalError("Microphone access was denied or is unavailable.");
    }
  }

  function submit(e) {
    e.preventDefault();
    setLocalError("");
    // Client-side checks mirror the server's; the server still validates everything.
    if (!file && text.trim().length < MIN_CHARS) return setLocalError(`Enter at least ${MIN_CHARS} characters, or attach a file.`);
    if (needsProfile && !profileId) return setLocalError("Save a profile first (Volume I), then select it here.");
    onSubmit({ text, file, profileId });
  }

  return (
    <form className="panel input-panel" onSubmit={submit}>
      <p className="eyebrow">Step 1 · Input</p>
      <p className="hint">{feature.inputHint}</p>

      {usesProfile && (
        <label className="field">
          <span>Saved profile {needsProfile ? "(required)" : "(optional context)"}</span>
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            {!needsProfile && <option value="">None</option>}
            {needsProfile && !profiles.length && <option value="">No saved profiles yet</option>}
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
                {p.headline ? ` — ${p.headline}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        <span>Text</span>
        <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or paste here…" disabled={Boolean(file)} />
      </label>

      <div className="attach-row">
        <input ref={fileInput} type="file" accept={ACCEPT} hidden onChange={(e) => setFile(e.target.files[0] || null)} />
        <button type="button" className="text-btn" onClick={() => fileInput.current.click()} disabled={busy || recording}>
          Attach file
        </button>
        <button type="button" className={`text-btn${recording ? " is-live" : ""}`} onClick={toggleRecording} disabled={busy}>
          {recording ? "● Stop recording" : "Record audio"}
        </button>
        <button type="button" className="link-btn" onClick={() => { setFile(null); setText(feature.sample); }} disabled={busy}>
          Use sample
        </button>
      </div>

      {file && (
        <p className="file-chip">
          {file.name} · {(file.size / 1024).toFixed(0)} KB
          <button type="button" className="link-btn" onClick={() => { setFile(null); fileInput.current.value = ""; }}>
            remove
          </button>
        </p>
      )}

      {localError && <p className="error-line">{localError}</p>}

      <button type="submit" className="primary-btn" disabled={busy || recording}>
        {busy ? "Reading with AI…" : "Extract with AI"}
      </button>
    </form>
  );
}
