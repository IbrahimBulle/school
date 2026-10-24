import { useEffect, useMemo, useState } from "react";
import { FiBookOpen, FiShield, FiStar, FiX } from "react-icons/fi";
import { apiGet, apiPut } from "./api";
import { printBrandedReport } from "./brandedReport";

const get = (row, ...keys) => {
  for (const key of keys) {
    let value = row?.[key];
    if (value && typeof value === "object" && "Valid" in value)
      value = value.Valid
        ? (value.String ?? value.Int64 ?? value.Float64 ?? "")
        : "";
    if (value !== undefined && value !== null) return value;
  }
  return "";
};
const missingRowKeys = new WeakMap();
let missingRowKeyCounter = 0;
const rowKey = (row) => {
  const value = get(row, "id", "ID");
  if (value !== "") return String(value);
  if (!row || typeof row !== "object") return `missing-${String(row)}`;
  if (!missingRowKeys.has(row))
    missingRowKeys.set(row, `missing-row-${++missingRowKeyCounter}`);
  return missingRowKeys.get(row);
};
const money = (value) =>
                  <strong>{value || "-"}</strong>
const message = (error) =>
  error?.message || "Could not load your school information.";

function useStudentOverview() {
  const [profile, setProfile] = useState(null);
  const [units, setUnits] = useState([]);
  const [results, setResults] = useState([]);
  const [fees, setFees] = useState([]);
  const [term, setTerm] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      apiGet("/me"),
      apiGet("/me/units"),
      apiGet("/me/results"),
      apiGet("/me/fees/summary"),
      apiGet("/me/active-term"),
    ])
      .then((results) => {
        if (!alive) return;
        const setters = [setProfile, setUnits, setResults, setFees, setTerm];
        results.forEach((result, index) => {
          if (result.status === "fulfilled")
            setters[index](
              index === 0 || index === 4
                ? result.value
                : Array.isArray(result.value)
                  ? result.value
                  : [],
            );
          else setError((current) => current || message(result.reason));
        });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  return { profile, units, results, fees, term, error, loading };
}

export function StudentDashboard({ onOpen }) {
  const { profile, units, results, fees, term, error, loading } =
    useStudentOverview();

  const name =
    get(profile, "name", "Name", "studentName", "StudentName") || "Student";

  const totalDue = fees.reduce(
    (sum, item) => sum + Number(get(item, "amountDue", "AmountDue") || 0),
    0,
  );

  const totalPaid = fees.reduce(
    (sum, item) => sum + Number(get(item, "amountPaid", "AmountPaid") || 0),
    0,
  );

  const balance = fees.reduce(
    (sum, item) => sum + Number(get(item, "balance", "Balance") || 0),
    0,
  );

  const average = results.length
    ? (
        results.reduce(
          (sum, row) => sum + Number(get(row, "score", "Score") || 0),
          0,
        ) / results.length
      ).toFixed(1)
    : "-";

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">STUDENT OVERVIEW</span>
          <h1>Habari, {name}</h1>
          <p>
            {get(term, "name", "Name") || "Your school"}{" "}
            {get(term, "year", "Year")} - Your learning and school account.
          </p>
        </div>

        <button
          className="button secondary"
          onClick={() => onOpen("My profile")}
        >
          My profile
        </button>
      </header>

      {error && <div className="admin-notice error">{error}</div>}

      {loading ? (
        <div className="admin-loading">Loading your school dashboard...</div>
      ) : (
        <>
          <div className="stat-grid">
            <Metric
              label="Term average"
              value={average === "-" ? average : `${average}%`}
              detail="Approved results this term"
              br
            />

            <Metric
              label="My subjects"
              value={units.length}
              detail="Units currently assigned"
              br
            />

            <Metric
              label="Fee balance"
              value={money(balance)}
              detail="Across your invoices"
              br
            />

            <Metric
              label="Fees paid"
              value={money(totalPaid)}
              detail={`Of ${money(totalDue)} invoiced`}
              br
            />
          </div>

          <div className="dashboard-grid student-grid">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h3>Recent approved results</h3>
                  <p>Only marks approved by your school are shown.</p>
                </div>

                <button
                  className="button secondary small"
                  onClick={() => onOpen("My results")}
                >
                  All results
                </button>
              </div>

              <div className="simple-list">
                {results.slice(0, 5).map((row) => (
                  <div className="assessment-row" key={rowKey(row)}>
                    <span className="simple-icon"><FiBookOpen aria-hidden="true" /></span>

                    <div className="simple-copy">
                      <strong>{get(row, "unitName", "UnitName")}</strong>
                      <span>{get(term, "name", "Name")}</span>
                    </div>

                    <strong>{get(row, "score", "Score")}%</strong>
                  </div>
                ))}

                {!results.length && (
                  <p>No approved results are available for this term yet.</p>
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">
                <div>
                  <h3>My subjects</h3>
                  <p>Units assigned to your student account.</p>
                </div>

                <button
                  className="button secondary small"
                  onClick={() => onOpen("My profile")}
                >
                  My profile
                </button>
              </div>

              <div className="simple-list">
                {units.map((unit) => (
                  <div className="assessment-row" key={get(unit, "id", "ID")}>
                    <span className="simple-icon"><FiBookOpen aria-hidden="true" /></span>

                    <div className="simple-copy">
                      <strong>{get(unit, "name", "Name")}</strong>
                    </div>
                  </div>
                ))}

                {!units.length && (
                  <p>No units are linked to your account yet.</p>
                )}
              </div>
            </section>
          </div>

          <div className="info-note">
            <span>i</span> Payment history and invoices are available in{" "}
            <button className="text-button" onClick={() => onOpen("My fees")}>
              My fees
            </button>
            .
          </div>
        </>
      )}
    </>
  );
}

export function StudentResults({ school }) {
  const [profile, setProfile] = useState(null);
  const [terms, setTerms] = useState([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedTermID, setSelectedTermID] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [termsLoading, setTermsLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([apiGet("/me/terms"), apiGet("/me/active-term"), apiGet("/me")])
      .then(([termResponse, activeResponse, profileResponse]) => {
        if (!alive) return;
        if (profileResponse.status === "fulfilled") setProfile(profileResponse.value);
        const available =
          termResponse.status === "fulfilled" &&
          Array.isArray(termResponse.value)
            ? termResponse.value
            : [];
        setTerms(available);
        if (termResponse.status === "rejected")
          setError(message(termResponse.reason));
        const active =
          activeResponse.status === "fulfilled" ? activeResponse.value : null;
        const activeID = String(get(active, "id", "ID"));
        const initial =
          available.find(
            (item) => String(get(item, "id", "ID")) === activeID,
          ) || available[0];
        if (initial) {
          setSelectedYear(String(get(initial, "year", "Year")));
          setSelectedTermID(String(get(initial, "id", "ID")));
        }
      })
      .finally(() => {
        if (alive) setTermsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const years = useMemo(
    () =>
      [
        ...new Set(
          terms
            .map((item) => String(get(item, "year", "Year")))
            .filter(Boolean),
        ),
      ].sort((a, b) => Number(b) - Number(a)),
    [terms],
  );
  const yearTerms = useMemo(
    () =>
      terms.filter(
        (item) => String(get(item, "year", "Year")) === selectedYear,
      ),
    [terms, selectedYear],
  );
  const selectedTerm = terms.find(
    (item) => String(get(item, "id", "ID")) === selectedTermID,
  );

  useEffect(() => {
    if (!selectedTermID) {
      setResults([]);
      return;
    }
    let alive = true;
    setResultsLoading(true);
    setError("");
    const termYear = get(selectedTerm, "year", "Year");
    apiGet(
      "/me/results?termid=" +
        encodeURIComponent(selectedTermID) +
        "&year=" +
        encodeURIComponent(termYear),
    )
      .then((data) => {
        if (alive) setResults(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (alive) {
          setResults([]);
          setError(message(e));
        }
      })
      .finally(() => {
        if (alive) setResultsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedTermID, selectedTerm]);

  function chooseYear(year) {
    setSelectedYear(year);
    const first = terms.find(
      (item) => String(get(item, "year", "Year")) === year,
    );
    setSelectedTermID(String(get(first, "id", "ID")));
  }

  async function downloadResultSlip() {
    if (!selectedTermID || !selectedTerm) return;
    setError("");
    try {
      printBrandedReport({
        school,
        title: "Student result slip",
        subtitle: `${get(selectedTerm, "name", "Name")} ${get(selectedTerm, "year", "Year")} · ${get(profile, "name", "Name") || "Student"}${get(profile, "admissionNumber", "AdmissionNumber") ? ` · Admission ${get(profile, "admissionNumber", "AdmissionNumber")}` : ""}`,
        columns: ["Unit", "Term", "Score", "Status"],
        rows: results.map((row) => [
          get(row, "unitName", "UnitName"),
          `${get(selectedTerm, "name", "Name")} ${get(selectedTerm, "year", "Year")}`,
          `${get(row, "score", "Score")}%`,
          "Approved",
        ]),
        footer: "Unofficial results statement. An official record requires the school stamp and an authorised school official’s signature.",
      });
    } catch (e) {
      setError(message(e));
    }
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">ACADEMIC PROGRESS</span>
          <h1>My results</h1>
          <p>
            {selectedTerm
              ? get(selectedTerm, "name", "Name") +
                " " +
                get(selectedTerm, "year", "Year")
              : "Choose an academic term"}{" "}
            | Approved marks only.
          </p>
        </div>
      </header>
      {error && <div className="admin-notice error">{error}</div>}
      {termsLoading ? (
        <div className="admin-loading">Loading academic terms...</div>
      ) : (
        <section className="panel">
          <div className="result-school-brand">
            {school?.logo ? <img src={school.logo} alt={`${school.name} logo`} /> : <span>{String(school?.name || "S").slice(0, 1).toUpperCase()}</span>}
            <div><strong>{school?.name || "Your school"}</strong><small>{school?.level || school?.location || "Official school results"}</small></div>
          </div>
          <div className="panel-title">
            <div>
              <h3>Approved results</h3>
              <p>
                {results.length} result{results.length === 1 ? "" : "s"} for the
                selected term
              </p>
            </div>
            <div className="results-filters">
              <button
                className="button primary small"
                disabled={!selectedTermID || resultsLoading}
                onClick={downloadResultSlip}
              >
                Print / save result PDF
              </button>
              <label>
                Year{" "}
                <select
                  value={selectedYear}
                  onChange={(event) => chooseYear(event.target.value)}
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Term{" "}
                <select
                  value={selectedTermID}
                  onChange={(event) => setSelectedTermID(event.target.value)}
                >
                  {yearTerms.map((term) => (
                    <option
                      key={get(term, "id", "ID")}
                      value={get(term, "id", "ID")}
                    >
                      {get(term, "name", "Name")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="results-table">
            <div className="result-header">
              <span>UNIT</span>
              <span>TERM</span>
              <span>SCORE</span>
              <span>STATUS</span>
            </div>
            {resultsLoading ? (
              <p className="empty-state">Loading results...</p>
            ) : (
              results.map((row) => (
                <div className="result-table-row" key={rowKey(row)}>
                  <span>{get(row, "unitName", "UnitName")}</span>
                  <span>
                    {get(selectedTerm, "name", "Name")}{" "}
                    {get(selectedTerm, "year", "Year")}
                  </span>
                  <span>{get(row, "score", "Score")}%</span>
                  <span className="status active">
                    <i />
                    Approved
                  </span>
                </div>
              ))
            )}
            {!resultsLoading && !results.length && (
              <p className="empty-state">
                No approved marks for this student in the selected term yet.
                Units appear here when a mark has been recorded and approved.
              </p>
            )}
          </div>
        </section>
      )}
      <aside className="results-disclaimer" aria-label="Results disclaimer">
        <strong>Important notice</strong>
        <p>
          Grades are reported using the school grading scale from A to E;
          Grades use the school scale from A to E; "Repeat" means the student must repeat the unit.
          An asterisk (*) indicates that a mark is missing or has not yet been
          recorded.
        </p>
        <p>
          This results statement is issued for information purposes only. It is
          unofficial and is not valid as an official school record unless it
          bears the school stamp and the signature of an authorised school
          official.
        </p>
      </aside>
    </>
  );
}
export function StudentProfile({ onNotify }) {
  const { profile, units, term, error, loading } = useStudentOverview();
  const [changing, setChanging] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [saving, setSaving] = useState(false);
  async function changePassword(event) {
    event.preventDefault();
    setSaving(true);
    setPasswordError("");
    const form = new FormData(event.currentTarget);
    try {
      await apiPut("/me/password", {
        currentPassword: form.get("currentPassword"),
        newPassword: form.get("newPassword"),
      });
      setChanging(false);
      onNotify("Password updated");
    } catch (e) {
      setPasswordError(message(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">MY ACCOUNT</span>
          <h1>My profile</h1>
          <p>Your student details and account settings.</p>
        </div>
      </header>
      {error && <div className="admin-notice error">{error}</div>}
      {loading ? (
        <div className="admin-loading">Loading your profile...</div>
      ) : (
        <div className="profile-layout">
          <section className="panel student-profile-card">
            <div className="student-profile-head">
              <div className="avatar avatar-peach large-avatar">
                {String(get(profile, "name", "Name") || "S")
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </div>
              <div>
                <h2>{get(profile, "name", "Name") || "Student"}</h2>
                <span className="status active">
                  <i />
                  {get(profile, "status", "Status") || "Active"}
                </span>
              </div>
            </div>
            <div className="profile-details">
              {[
                [
                  "Admission number",
                  get(profile, "admissionNumber", "AdmissionNumber"),
                ],
                [
                  "Class",
                  get(profile, "className", "ClassName") || "Not assigned",
                ],
                [
                  "Parent / guardian",
                  get(profile, "parentPhoneNumber", "ParentPhoneNumber"),
                ],
                [
                  "Current term",
                  `${get(term, "name", "Name")} ${get(term, "year", "Year")}`,
                ],
                [
                  "Subjects",
                  units.map((unit) => get(unit, "name", "Name")).join(", ") ||
                    "No units assigned",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value || "-"}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="panel account-security">
            <h3>Account security</h3>
            <p>Keep your account secure by using a password only you know.</p>
            <div className="security-row">
              <span className="security-icon"><FiShield aria-hidden="true" /></span>
              <span>
                <strong>Password</strong>
                <small>Change your password regularly</small>
              </span>
              <button
                className="button secondary small"
                onClick={() => setChanging(true)}
              >
                Change
              </button>
            </div>
            <div className="security-tip">
              <span><FiStar aria-hidden="true" /></span>
              <p>
                If you forget your password, ask the school administrator to
                reset it. Your school records will stay safe.
              </p>
            </div>
          </section>
        </div>
      )}
      {changing && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={changePassword}>
            <button
              type="button"
              className="modal-close"
              onClick={() => setChanging(false)}
            >
              <FiX aria-hidden="true" />
            </button>
            <h2>Change password</h2>
            <label className="field-label">Current password</label>
            <input
              className="form-input"
              type="password"
              name="currentPassword"
              required
              autoComplete="current-password"
            />
            <label className="field-label">New password</label>
            <input
              className="form-input"
              type="password"
              name="newPassword"
              required
              minLength="8"
              autoComplete="new-password"
            />
            <small>
              Use at least 8 characters with uppercase, lowercase, number, and
              special character.
            </small>
            {passwordError && (
              <div className="login-error">{passwordError}</div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setChanging(false)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={saving}>
                {saving ? "Saving..." : "Save password"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function Metric({ label, value, detail, br = false }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      {br && <br />}

      <strong>{value}</strong>
      {br && <br />}

      <small>{detail}</small>
    </div>
  );
}
