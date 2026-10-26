import { useEffect, useState } from "react";
import { FiBookOpen, FiImage, FiUpload, FiX } from "react-icons/fi";

const emptySchool = { name: "", level: "", location: "", contact: "", logo: "" };

export function readSchoolSetup() {
  try {
    const stored = JSON.parse(localStorage.getItem("schoolmanagement.school") || "null");
    return stored?.name ? { ...emptySchool, ...stored } : null;
  } catch {
    return null;
  }
}

export default function SchoolSetup({ initialSchool, onSave, onCancel, firstRun = false, embedded = false }) {
  const [school, setSchool] = useState(() => ({ ...emptySchool, ...(initialSchool || {}) }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setSchool({ ...emptySchool, ...(initialSchool || {}) }), [initialSchool]);

  function update(field, value) {
    setSchool((current) => ({ ...current, [field]: value }));
  }

  function chooseLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for the school logo.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setError("The logo must be 1 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      update("logo", String(reader.result));
      setError("");
    };
    reader.onerror = () => setError("Could not read that image. Try another file.");
    reader.readAsDataURL(file);
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave({ ...school, name: school.name.trim(), level: school.level.trim(), location: school.location.trim(), contact: school.contact.trim() });
    } catch (saveError) {
      setError(saveError.message || "Could not save school details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={`school-setup-screen ${embedded ? "school-setup-embedded" : ""}`}>
      <form className="school-setup-card" onSubmit={submit}>
        <div className="school-setup-brand"><span><FiBookOpen /></span><b>School workspace</b></div>
        <div className="eyebrow">{firstRun ? "GETTING STARTED" : "SCHOOL PROFILE"}</div>
        <h1>{firstRun ? "Set up your school" : "Update school details"}</h1>
        <p className="school-setup-intro">Add the details that staff and students will see when they use this workspace.</p>

        <label className="school-logo-upload">
          <span className="school-logo-preview">{school.logo ? <img src={school.logo} alt="School logo preview" /> : <FiImage />}</span>
          <span><b>{school.logo ? "Change school logo" : "Add a school logo"}</b><small>PNG, JPG or SVG · up to 1 MB</small></span>
          <span className="button secondary small"><FiUpload /> Upload</span>
          <input id="school-logo-file" name="schoolLogo" type="file" accept="image/*" onChange={chooseLogo} />
        </label>
        {school.logo && <button className="school-logo-remove" type="button" onClick={() => update("logo", "")}><FiX /> Remove logo</button>}

        <div className="school-setup-fields">
          <label className="field-label" htmlFor="school-name">School name <em>*</em></label>
          <input id="school-name" className="form-input" value={school.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Green Valley School" required maxLength={100} />
          <label className="field-label" htmlFor="school-level">School level or type</label>
          <input id="school-level" className="form-input" value={school.level} onChange={(e) => update("level", e.target.value)} placeholder="e.g. Primary & Junior" maxLength={80} />
          <div className="school-setup-row">
            <div><label className="field-label" htmlFor="school-location">Location</label><input id="school-location" className="form-input" value={school.location} onChange={(e) => update("location", e.target.value)} placeholder="Town or county" maxLength={100} /></div>
            <div><label className="field-label" htmlFor="school-contact">Contact</label><input id="school-contact" className="form-input" value={school.contact} onChange={(e) => update("contact", e.target.value)} placeholder="Phone or email" maxLength={100} /></div>
          </div>
        </div>
        {error && <div className="login-error" role="alert">{error}</div>}
        <button className="button primary school-setup-submit" type="submit" disabled={saving}>{saving ? "Saving..." : firstRun ? "Save and continue" : "Save school details"}</button>
        {!firstRun && <button className="help-login" type="button" onClick={onCancel}>Cancel</button>}
        <small className="school-setup-footnote">You can update these details later from the school panel.</small>
      </form>
    </main>
  );
}
