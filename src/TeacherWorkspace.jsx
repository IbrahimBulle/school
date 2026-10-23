import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiPut } from "./api";

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
const id = (row) => {
  const value = get(row, "id", "ID");
  if (value !== "") return String(value);
  if (!row || typeof row !== "object") return `missing-${String(row)}`;
  if (!missingRowKeys.has(row))
    missingRowKeys.set(row, `missing-row-${++missingRowKeyCounter}`);
  return missingRowKeys.get(row);
};
const displayError = (error) =>
  error?.message || "Could not load teaching data.";

function useTeacherData() {
  const [assignments, setAssignments] = useState([]);
  const [term, setTerm] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      apiGet("/teachers/me/assignments"),
      apiGet("/me/active-term"),
    ])
      .then(([assigned, active]) => {
        if (!alive) return;
        if (assigned.status === "fulfilled")
          setAssignments(Array.isArray(assigned.value) ? assigned.value : []);
        else setError(displayError(assigned.reason));
        if (active.status === "fulfilled") setTerm(active.value);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);
  return { assignments, term, error, loading };
}

export function TeacherDashboard({ onOpen }) {
  const { assignments, term, error, loading } = useTeacherData();
  const [studentCount, setStudentCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const classes = [
      ...new Set(
        assignments.map((a) => get(a, "classId", "ClassID")).filter(Boolean),
      ),
    ];
    Promise.all(
      classes.map((classId) =>
        apiGet(`/teachers/me/classes/${classId}/students`).catch(() => []),
      ),
    ).then((lists) => {
      if (alive) setStudentCount(new Set(lists.flat().map(id)).size);
    });
    return () => {
      alive = false;
    };
  }, [assignments]);
  const classesCount = new Set(
    assignments.map((a) => get(a, "classId", "ClassID")),
  ).size;
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">TEACHING OVERVIEW</span>
          <h1>Your teaching dashboard</h1>
          <p>
            {get(term, "name", "Name") || "Active term"} · Your assigned classes
            and units
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => onOpen("My classes")}
        >
          View classes
        </button>
      </header>
      {error && <div className="admin-notice error">{error}</div>}
      {loading ? (
        <div className="admin-loading">Loading your teaching overview…</div>
      ) : (
        <>
          <div className="stat-grid">
            <Stat
              label="Assigned units"
              value={assignments.length}
              detail="Across your teaching assignments"
            />
            <Stat
              label="Classes"
              value={classesCount}
              detail="Classes assigned to you"
            />
            <Stat
              label="Students"
              value={studentCount}
              detail="Across your assigned classes"
            />
            <Stat
              label="Active term"
              value={get(term, "name", "Name") || "Not set"}
              detail={
                get(term, "year", "Year") ||
                "Ask an administrator to activate a term"
              }
            />
          </div>
          <section className="panel">
            <div className="panel-title">
              <div>
                <h3>Your teaching assignments</h3>
                <p>Choose an assignment to enter or review marks.</p>
              </div>
              <button
                className="button primary small"
                onClick={() => onOpen("Gradebook")}
              >
                Open gradebook
              </button>
            </div>
            <div className="class-card-grid">
              {assignments.map((a) => (
                <article className="class-card" key={id(a)}>
                  <div className="class-card-icon blue">▦</div>
                  <span className="status active">
                    <i />
                    Assigned
                  </span>
                  {get(a, "className", "ClassName")}
                  <button onClick={() => onOpen("Gradebook")}>
                    Enter marks <span>→</span>
                  </button>
                </article>
              ))}
              {!assignments.length && (
                <p className="empty-state">
                  No teaching assignments yet. Ask an administrator to assign
                  your classes and units.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}

export function TeacherClasses() {
  const { assignments, error, loading } = useTeacherData();
  const [studentsByClass, setStudentsByClass] = useState({});
  const [expanded, setExpanded] = useState("");
  const classes = useMemo(() => {
    const grouped = new Map();
    assignments.forEach((a) => {
      const classId = get(a, "classId", "ClassID");
      if (!grouped.has(classId))
        grouped.set(classId, {
          id: classId,
          name: get(a, "className", "ClassName"),
          units: [],
        });
      grouped
        .get(classId)
        .units.push({
          id: get(a, "unitId", "UnitID"),
          name: get(a, "unitName", "UnitName"),
        });
    });
    return [...grouped.values()];
  }, [assignments]);
  async function toggle(classId) {
    if (expanded === classId) {
      setExpanded("");
      return;
    }
    setExpanded(classId);
    if (!studentsByClass[classId]) {
      try {
        const rows = await apiGet(`/teachers/me/classes/${classId}/students`);
        setStudentsByClass((prev) => ({
          ...prev,
          [classId]: Array.isArray(rows) ? rows : [],
        }));
      } catch (e) {
        setStudentsByClass((prev) => ({
          ...prev,
          [classId]: { error: displayError(e) },
        }));
      }
    }
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">YOUR CLASSES</span>
          <h1>My classes</h1>
          <p>Assigned classes, units, and enrolled students.</p>
        </div>
      </header>
      {error && <div className="admin-notice error">{error}</div>}
      {loading ? (
        <div className="admin-loading">Loading classes…</div>
      ) : (
        <div className="class-card-grid">
          {classes.map((c) => {
            const students = studentsByClass[c.id];
            return (
              <article className="class-card" key={c.id}>
                <div className="class-card-icon blue">▦</div>
                <span className="status active">
                  <i />
                  Assigned
                </span>
                <h3>{c.name}</h3>
                <p>{c.units.map((u) => u.name).join(" · ")}</p>
                <div className="class-card-meta">
                  <span>
                    {students && Array.isArray(students)
                      ? students.length
                      : "—"}{" "}
                    students
                  </span>
                  <span>
                    {c.units.length} assigned unit
                    {c.units.length === 1 ? "" : "s"}
                  </span>
                </div>
                <button onClick={() => toggle(c.id)}>
                  {expanded === c.id ? "Hide students" : "View students"}{" "}
                  <span>→</span>
                </button>
                {expanded === c.id && (
                  <div className="simple-list">
                    {Array.isArray(students) ? (
                      students.map((s) => (
                        <div className="assessment-row" key={id(s)}>
                          <div className="simple-copy">
                            <strong>{get(s, "name", "Name")}</strong>
                            <span>
                              {get(s, "admissionNumber", "AdmissionNumber")}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p>{students?.error || "Loading students…"}</p>
                    )}
                    {Array.isArray(students) && !students.length && (
                      <p>No students are enrolled in this class.</p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
          {!classes.length && !loading && (
            <p className="empty-state">
              No assigned classes are available yet.
            </p>
          )}
        </div>
      )}
    </>
  );
}

export function TeacherStudents() {
  const { assignments, error, loading } = useTeacherData();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  useEffect(() => {
    let alive = true;
    const classIds = [
      ...new Set(
        assignments.map((a) => get(a, "classId", "ClassID")).filter(Boolean),
      ),
    ];
    Promise.all(
      classIds.map((classId) =>
        apiGet(`/teachers/me/classes/${classId}/students`).catch(() => []),
      ),
    ).then((lists) => {
      if (alive)
        setStudents([...new Map(lists.flat().map((s) => [id(s), s])).values()]);
    });
    return () => {
      alive = false;
    };
  }, [assignments]);
  const filtered = students.filter((s) =>
    `${get(s, "name", "Name")} ${get(s, "admissionNumber", "AdmissionNumber")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">YOUR ROSTER</span>
          <h1>My students</h1>
          <p>Students in classes assigned to you.</p>
        </div>
        <input
          className="form-input"
          placeholder="Search name or admission number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </header>
      {error && <div className="admin-notice error">{error}</div>}
      {loading ? (
        <div className="admin-loading">Loading student list…</div>
      ) : (
        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>{filtered.length} students</h3>
              <p>From your assigned classes.</p>
            </div>
          </div>
          <div className="simple-list">
            {filtered.map((s) => (
              <div className="assessment-row" key={id(s)}>
                <span className="simple-icon">♙</span>
                <div className="simple-copy">
                  <strong>{get(s, "name", "Name")}</strong>
                  <span>{get(s, "admissionNumber", "AdmissionNumber")}</span>
                </div>
                <span>{get(s, "classId", "ClassID")}</span>
              </div>
            ))}
            {!filtered.length && (
              <p className="empty-state">
                No students found in your assigned classes.
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}

export function Gradebook() {
  const { assignments, term, error: initialError, loading } = useTeacherData();
  const [classID, setClassID] = useState("");
  const [assignmentID, setAssignmentID] = useState("");
  const [students, setStudents] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [marks, setMarks] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const classes = useMemo(() => {
    const seen = new Set();
    return assignments.filter((assignment) => {
      const classId = String(get(assignment, "classId", "ClassID"));
      if (!classId || seen.has(classId)) return false;
      seen.add(classId);
      return true;
    });
  }, [assignments]);
  const classAssignments = assignments.filter(
    (assignment) => String(get(assignment, "classId", "ClassID")) === classID,
  );
  const selected = classAssignments.find((a) => id(a) === assignmentID);
  const canSubmitForStudent = (student) =>
    !marks.some(
      (mark) =>
        get(mark, "studentId", "StudentID") === id(student) &&
        String(get(mark, "status", "Status")).toLowerCase() !== "rejected",
    );
  async function refresh() {
    if (!selected || !classID) return;
    const entered = await apiGet(
      `/teachers/me/assignments/${assignmentID}/marks`,
    );
    setMarks(Array.isArray(entered) ? entered : []);
  }
  useEffect(() => {
    setError("");
    setStudents([]);
    if (!classID) {
      setRosterLoading(false);
      return undefined;
    }
    let active = true;
    setRosterLoading(true);
    apiGet(`/teachers/me/classes/${classID}/students`)
      .then((roster) => {
        if (active) setStudents(Array.isArray(roster) ? roster : []);
      })
      .catch((e) => {
        if (active) setError(displayError(e));
      })
      .finally(() => {
        if (active) setRosterLoading(false);
      });
    return () => {
      active = false;
    };
  }, [assignmentID, classID, assignments]);
  useEffect(() => {
    setMarks([]);
    if (!selected) return undefined;
    let active = true;
    apiGet(`/teachers/me/assignments/${assignmentID}/marks`)
      .then((entered) => {
        if (active) setMarks(Array.isArray(entered) ? entered : []);
      })
      .catch((e) => {
        if (active) setError(displayError(e));
      });
    return () => {
      active = false;
    };
  }, [assignmentID, selected]);
  async function submit(event) {
    event.preventDefault();
    if (!selected || !get(term, "id", "ID")) {
      setError(
        "The administrator must activate a term before marks can be entered.",
      );
      return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const studentID = String(form.get("studentId") || "");
    const score = String(form.get("score") || "");
    setBusy(true);
    setError("");
    try {
      await apiPost(`/marks/${get(selected, "unitId", "UnitID")}`, {
        studentId: studentID,
        termId: get(term, "id", "ID"),
        score,
      });
      formElement.reset();
      await refresh();
    } catch (e) {
      setError(displayError(e));
    } finally {
      setBusy(false);
    }
  }
  async function updateScore(mark, score) {
    try {
      await apiPut(`/marks/${id(mark)}`, { score });
      await refresh();
    } catch (e) {
      setError(displayError(e));
    }
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">ASSESSMENTS</span>
          <h1>Gradebook</h1>
          <p>
            Record scores for your assigned units. New marks are sent for
            administrator approval.
          </p>
        </div>
      </header>
      {(initialError || error) && (
        <div className="admin-notice error">
          {error || initialError}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {loading ? (
        <div className="admin-loading">Loading gradebook…</div>
      ) : (
        <>
          <section className="panel">
            <div className="panel-title">
              <div>
                <h3>Choose a class and unit</h3>
                <p>
                  {get(term, "name", "Name") || "No active term"}{" "}
                  {get(term, "year", "Year")}
                </p>
              </div>
            </div>
            <label className="field-label">Class</label>
            <select
              className="form-input"
              value={classID}
              onChange={(e) => {
                setClassID(e.target.value);
                setAssignmentID("");
              }}
            >
              <option value="">Select an assigned class</option>
              {classes.map((a) => (
                <option
                  key={String(get(a, "classId", "ClassID"))}
                  value={String(get(a, "classId", "ClassID"))}
                >
                  {get(a, "className", "ClassName")}
                </option>
              ))}
            </select>
            {classID && (
              <>
                <small className="teacher-roster-count">
                  {rosterLoading
                    ? "Loading students…"
                    : `${students.length} students in this class`}
                </small>
                <label className="field-label">Unit</label>
                <select
                  className="form-input"
                  value={assignmentID}
                  onChange={(e) => setAssignmentID(e.target.value)}
                >
                  <option value="">Select an assigned unit</option>
                  {classAssignments.map((a) => (
                    <option key={id(a)} value={id(a)}>
                      {get(a, "unitName", "UnitName")}
                    </option>
                  ))}
                </select>
              </>
            )}
            {selected && (
              <form className="grade-entry-form" onSubmit={submit}>
                <label className="field-label">Student</label>
                <select className="form-input" name="studentId" required>
                  <option value="">
                    {rosterLoading
                      ? "Loading students…"
                      : students.length
                        ? "Select student"
                        : "No students in this class"}
                  </option>
                  {students
                    .filter(canSubmitForStudent)
                    .map((s) => (
                      <option key={id(s)} value={id(s)}>
                        {get(s, "name", "Name")} ·{" "}
                        {get(s, "admissionNumber", "AdmissionNumber")}
                      </option>
                    ))}
                </select>
                <label className="field-label">Score</label>
                <input
                  className="form-input"
                  type="number"
                  name="score"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                />
                <button
                  className="button primary"
                  disabled={
                    busy ||
                    !students.some(canSubmitForStudent)
                  }
                >
                  {busy ? "Saving…" : "Submit mark for approval"}
                </button>
              </form>
            )}
          </section>
          {selected && (
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h3>Submitted marks</h3>
                  <p>
                    {get(selected, "className", "ClassName")} ·{" "}
                    {get(selected, "unitName", "UnitName")}
                  </p>
                </div>
                <button
                  className="button secondary small"
                  onClick={() =>
                    refresh().catch((e) => setError(displayError(e)))
                  }
                >
                  Refresh
                </button>
              </div>
              <div className="simple-list">
                {marks.map((m) => (
                  <MarkRow key={id(m)} mark={m} onSave={updateScore} />
                ))}
                {!marks.length && (
                  <p>
                    No marks have been submitted for this assignment in the
                    active term.
                  </p>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function MarkRow({ mark, onSave }) {
  const [score, setScore] = useState(get(mark, "score", "Score"));
  const pending =
    String(get(mark, "status", "Status")).toLowerCase() === "pending";
  return (
    <div className="assessment-row">
      <div className="simple-copy">
        <strong>{get(mark, "studentName", "StudentName")}</strong>
        <span>{get(mark, "admissionNumber", "AdmissionNumber")}</span>
      </div>
      {pending ? (
        <>
          <input
            className="form-input score-input"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
          <button
            className="button secondary small"
            disabled={String(score) === String(get(mark, "score", "Score"))}
            onClick={() => onSave(mark, score)}
          >
            Update
          </button>
        </>
      ) : (
        <strong>{score}</strong>
      )}
      <span className={`status ${pending ? "pending" : "active"}`}>
        <i />
        {get(mark, "status", "Status")}
      </span>
    </div>
  );
}

function Stat({ label, value, detail }) {
  return (
    <div className="stat-card">
      {" "}
      <br />
      <span>{label}</span> <br />
      <strong>{value}</strong> <br />
      <small>{detail}</small>
    </div>
  );
}
