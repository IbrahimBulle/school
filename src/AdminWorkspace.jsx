import { useEffect, useMemo, useState } from "react";
import { apiDelete, apiDownload, apiGet, apiPost, apiPut } from "./api";
import FeeManagement from "./FeeManagement";

const read = (row, ...keys) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "object" && "Valid" in value) {
      if (!value.Valid) return "";
      if ("String" in value) return value.String;
      if ("Int64" in value) return value.Int64;
      if ("Float64" in value) return value.Float64;
      if ("Bool" in value) return value.Bool;
    }
    if (typeof value === "object" && "String" in value) return value.String;
    return value;
  }
  return "";
};
const rows = (value) => (Array.isArray(value) ? value : []);
const STUDENTS_PAGE_SIZE = 10;
const missingRowKeys = new WeakMap();
let missingRowKeyCounter = 0;
const idOf = (row) => {
  const value = read(row, "id", "ID");
  if (value !== "") return String(value);
  if (!row || typeof row !== "object") return `missing-${String(row)}`;
  if (!missingRowKeys.has(row))
    missingRowKeys.set(row, `missing-row-${++missingRowKeyCounter}`);
  return missingRowKeys.get(row);
};
const dateValue = (value) => (value ? String(value).slice(0, 10) : "");
const dateInputValue = (date) => {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
};
const currency = (amount) =>
  `KES ${Number(amount || 0).toLocaleString("en-KE")}`;

function Heading({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </div>
  );
}
function ActionButton({ children, onClick, secondary = false }) {
  return (
    <button
      className={`button ${secondary ? "secondary" : "primary"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function Notice({ children, error = false }) {
  return (
    <div className={`admin-notice ${error ? "error" : ""}`}>{children}</div>
  );
}
function StateBadge({ value }) {
  const state = String(value || "").toLowerCase();
  return (
    <span
      className={`status ${["active", "approved", "paid"].includes(state) ? "active" : ["pending", "upcoming"].includes(state) ? "pending" : ""}`}
    >
      <i />
      {value || "—"}
    </span>
  );
}

export default function AdminWorkspace({ page, search = "", onNotify }) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialog, setDialog] = useState("");
  const [selectedStructure, setSelectedStructure] = useState(null);
  const [structureItems, setStructureItems] = useState([]);
  const [structureError, setStructureError] = useState("");
  const [studentPageResult, setStudentPageResult] = useState(null);
  const [studentPage, setStudentPage] = useState(1);
  const [studentPageLoading, setStudentPageLoading] = useState(false);

  useEffect(() => {
    let current = true;
    async function load() {
      setLoading(true);
      setError("");
      const pages = {
        Overview: ["/students", "/teachers", "/classes", "/terms", "/marks"],
        Students: ["/classes"],
        Teachers: ["/teachers", "/classes", "/units", "/teaching_assignments"],
        "Classes & units": [
          "/classes",
          "/units",
          "/teachers",
          "/teaching_assignments",
        ],
        Academics: ["/terms", "/marks"],
        "Fees & payments": [],
        Reports: ["/students", "/teachers", "/classes", "/terms", "/marks"],
      };
      const paths = pages[page] || [];
      try {
        const result = await Promise.all(paths.map((path) => apiGet(path)));
        if (current)
          setData(
            Object.fromEntries(
              paths.map((path, index) => [path, rows(result[index])]),
            ),
          );
      } catch (loadError) {
        if (current)
          setError(
            loadError.message ||
              "Could not load this page. Check your connection and admin session.",
          );
      } finally {
        if (current) setLoading(false);
      }
    }
    load();
    return () => {
      current = false;
    };
  }, [page, refreshKey]);

  useEffect(() => {
    if (page !== "Students") return undefined;
    let current = true;
    const query = new URLSearchParams({
      page: String(studentPage),
      pageSize: String(STUDENTS_PAGE_SIZE),
      search,
    });
    setStudentPageLoading(true);
    apiGet(`/students/page?${query}`)
      .then((result) => {
        if (current) setStudentPageResult(result);
      })
      .catch((loadError) => {
        if (current) setError(loadError.message || "Could not load students.");
      })
      .finally(() => {
        if (current) setStudentPageLoading(false);
      });
    return () => {
      current = false;
    };
  }, [page, refreshKey, search, studentPage]);

  useEffect(() => {
    setStudentPage(1);
  }, [search]);

  const classes = rows(data["/classes"]);
  const students = rows(data["/students"]);
  const teachers = rows(data["/teachers"]);
  const units = rows(data["/units"]);
  const terms = rows(data["/terms"]);
  const marks = rows(data["/marks"]);
  const feeStructures = rows(data["/fee-structures"]);
  const assignments = rows(data["/teaching_assignments"]);
  const pagedStudents = rows(
    studentPageResult?.items ?? studentPageResult?.Items,
  );

  function refresh() {
    setRefreshKey((value) => value + 1);
  }
  async function resetStudentPassword(student) {
    if (
      !window.confirm(
        `Reset ${read(student, "studentName", "StudentName")}'s password to the school default?`,
      )
    )
      return;
    try {
      const result = await apiPost(
        `/students/${idOf(student)}/password/reset`,
        {},
      );
      onNotify(
        `Password reset. Default: ${read(result, "defaultPassword", "DefaultPassword") || "configured school default"}`,
      );
    } catch (actionError) {
      setError(actionError.message);
    }
  }
  function closeDialog(message) {
    setDialog("");
    if (message) onNotify(message);
  }
  async function submitAction(event) {
    event.preventDefault();
    setError("");
    const actionType = typeof dialog === "string" ? dialog : dialog.type;
    const form = new FormData(event.currentTarget);
    const getText = (name) => String(form.get(name) || "").trim();
    try {
      if (actionType === "student") {
        const created = await apiPost("/students", {
          name: getText("name"),
          phoneNumber: getText("phoneNumber"),
          classId: getText("classId"),
          parentNumber: getText("parentNumber"),
        });
        closeDialog(
          `Student created${read(created, "AdmissionNumber", "admissionNumber") ? ` · ${read(created, "AdmissionNumber", "admissionNumber")}` : ""}. Default password: ${created.defaultPassword}`,
        );
      } else if (actionType === "teacher") {
        const created = await apiPost("/teachers/register", {
          name: getText("name"),
          phoneNumber: getText("phoneNumber"),
          employeeNumber: getText("employeeNumber"),
        });
        closeDialog(
          `Teacher account created. Default password: ${created.defaultPassword}`,
        );
      } else if (actionType === "class") {
        await apiPost("/classes", { className: getText("name") });
        closeDialog("Class created");
      } else if (actionType === "edit-class") {
        await apiPut(`/classes/${dialog.record.id}`, {
          className: getText("name"),
        });
        closeDialog("Class updated");
      } else if (actionType === "unit") {
        await apiPost("/units", { name: getText("name") });
        closeDialog("Unit created");
      } else if (actionType === "edit-unit") {
        await apiPut(`/units/${dialog.record.id}`, { name: getText("name") });
        closeDialog("Unit updated");
      } else if (actionType === "assignment") {
        await apiPost("/teaching_assignments", {
          teacherId: getText("teacherId"),
          classId: getText("classId"),
          unitId: getText("unitId"),
        });
        closeDialog("Teaching assignment created");
      } else if (actionType === "student-status") {
        const { record } = dialog;
        await apiPut(`/students/${record.id}`, {
          classId: getText("classId"),
          status: getText("status"),
        });
        closeDialog("Student record updated");
      } else if (actionType === "teacher-status") {
        const { record } = dialog;
        await apiPut(`/teachers/${record.id}`, {
          id: record.id,
          status: getText("status"),
        });
        closeDialog("Teacher status updated");
      } else if (actionType === "term") {
        await apiPost("/terms", {
          name: getText("name"),
          year: Number(getText("year")),
          start_date: getText("startDate"),
          end_date: getText("endDate"),
        });
        closeDialog("Academic term created");
      } else if (actionType === "edit-term") {
        const { record } = dialog;
        await apiPut(`/terms/${record.id}`, {
          name: getText("name"),
          year: Number(getText("year")),
          start_date: getText("startDate"),
          end_date: getText("endDate"),
          status: getText("status"),
        });
        closeDialog("Term updated");
      } else if (actionType === "fee-structure") {
        await apiPost("/fee-structures", {
          classId: getText("classId"),
          termId: getText("termId"),
          name: getText("name"),
        });
        closeDialog("Fee structure created");
      } else if (actionType === "edit-fee-structure") {
        await apiPut(`/fee-structures/${dialog.record.id}`, {
          classId: getText("classId"),
          termId: getText("termId"),
          name: getText("name"),
        });
        closeDialog("Fee structure updated");
      } else if (actionType === "fee-item") {
        await apiPost(`/fee-structures/${dialog.record.id}/items`, {
          code: getText("code"),
          description: getText("description"),
          amount: getText("amount"),
        });
        closeDialog("Fee item added");
        await loadItems(dialog.record);
      } else if (actionType === "edit-fee-item") {
        await apiPut(`/fee-structure-items/${dialog.record.id}`, {
          code: getText("code"),
          description: getText("description"),
          amount: getText("amount"),
        });
        closeDialog("Fee item updated");
        await loadItems(selectedStructure);
      } else if (actionType === "fee-accounts") {
        await apiPost("/student-fee-accounts/bulk", {
          classId: getText("classId"),
          feeStructureId: getText("feeStructureId"),
          amountDue: getText("amountDue"),
        });
        closeDialog("Fee accounts created for this fee structure");
      } else if (actionType === "single-account") {
        await apiPost("/student-fee-accounts", {
          studentId: getText("studentId"),
          feeStructureId: getText("feeStructureId"),
        });
        closeDialog("Student fee account created");
      } else if (actionType === "account-amount") {
        await apiPut(`/student-fee-accounts/${getText("accountId")}`, {
          amountDue: getText("amountDue"),
        });
        closeDialog("Fee account amount updated");
      } else if (actionType === "payment") {
        await apiPost("/payments/admin", {
          studentFeeAccountId: getText("accountId"),
          amount: getText("amount"),
          method: getText("method"),
          transactionReference: getText("transactionReference"),
          phoneNumber: getText("phoneNumber"),
        });
        closeDialog("Payment recorded");
      } else if (actionType === "payment-status") {
        await apiPut(`/payments/${getText("paymentId")}/status`, {
          status: getText("status"),
        });
        closeDialog("Payment status updated");
      }
      refresh();
    } catch (submitError) {
      setError(submitError.message || "Could not save your changes.");
    }
  }

  async function loadItems(structure) {
    setSelectedStructure(structure);
    setStructureItems([]);
    setStructureError("");
    try {
      setStructureItems(
        rows(await apiGet(`/fee-structures/${idOf(structure)}/items`)),
      );
    } catch (loadError) {
      setStructureError(loadError.message);
    }
  }

  async function changeMarkStatus(mark, status) {
    try {
      await apiPut(`/marks/${idOf(mark)}/status`, { status });
      onNotify(`Mark ${status}`);
      refresh();
    } catch (actionError) {
      setError(actionError.message);
    }
  }
  async function removeRecord(path, label) {
    if (!window.confirm(`Delete this ${label}? This cannot be undone.`)) return;
    try {
      await apiDelete(path);
      onNotify(`${label} deleted`);
      refresh();
    } catch (actionError) {
      setError(actionError.message);
    }
  }
  async function exportReport() {
    const reportRows = students.map((student) => [
      read(student, "studentName", "StudentName"),
      read(student, "admissionNumber", "AdmissionNumber"),
      read(student, "className", "ClassName"),
      read(student, "status", "Status"),
    ]);
    const csv = [
      ["Student", "Admission number", "Class", "Status"],
      ...reportRows,
    ]
      .map((line) =>
        line
          .map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "school-students.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  let content;
  if (page === "Overview")
    content = (
      <Overview
        students={students}
        teachers={teachers}
        classes={classes}
        terms={terms}
        marks={marks}
      />
    );
  if (page === "Students")
    content = (
      <StudentsPage
        students={pagedStudents}
        total={read(studentPageResult, "total", "Total") || 0}
        page={read(studentPageResult, "page", "Page") || studentPage}
        totalPages={read(studentPageResult, "totalPages", "TotalPages") || 0}
        loading={studentPageLoading}
        onPageChange={setStudentPage}
        open={() => setDialog("student")}
        edit={(record) => setDialog({ type: "student-status", record })}
        reset={resetStudentPassword}
      />
    );
  if (page === "Teachers")
    content = (
      <TeachersPage
        teachers={teachers}
        assignments={assignments}
        open={() => setDialog("teacher")}
        edit={(record) => setDialog({ type: "teacher-status", record })}
      />
    );
  if (page === "Classes & units")
    content = (
      <ClassesPage
        classes={classes}
        units={units}
        teachers={teachers}
        assignments={assignments}
        createClass={() => setDialog("class")}
        createUnit={() => setDialog("unit")}
        createAssignment={() => setDialog("assignment")}
        editClass={(record) => setDialog({ type: "edit-class", record })}
        editUnit={(record) => setDialog({ type: "edit-unit", record })}
        remove={removeRecord}
      />
    );
  if (page === "Academics")
    content = (
      <AcademicsPage
        terms={terms}
        marks={marks}
        create={() => setDialog("term")}
        edit={(record) => setDialog({ type: "edit-term", record })}
        onStatus={changeMarkStatus}
        onDeleteMark={(id) => removeRecord(`/marks/${id}`, "mark")}
      />
    );
  if (page === "Fees & payments")
    content = <FeeManagement onNotify={onNotify} />;
  if (page === "Reports")
    content = (
      <ReportsPage
        students={students}
        teachers={teachers}
        classes={classes}
        terms={terms}
        marks={marks}
        onExport={exportReport}
      />
    );

  return (
    <>
      {error && (
        <Notice error>
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </Notice>
      )}
      {loading ? (
        <div className="admin-loading">
          <span className="spinner" />
          Loading current school records…
        </div>
      ) : error && !Object.keys(data).length ? (
        <div className="admin-error-state">
          <strong>Could not load administrator data</strong>
          <p>{error}</p>
          <button className="button secondary" onClick={refresh}>
            Try again
          </button>
        </div>
      ) : (
        content
      )}
      {dialog && (
        <AdminDialog
          dialog={dialog}
          data={{ classes, teachers, units, students, terms, feeStructures }}
          error={error}
          onSubmit={submitAction}
          onClose={() => {
            setDialog("");
            setError("");
          }}
        />
      )}
    </>
  );
}

function Overview({ students, teachers, classes, terms, marks }) {
  const activeTerm = terms.find(
    (term) => String(read(term, "status", "Status")).toLowerCase() === "active",
  );
  const pendingMarks = marks.filter(
    (mark) =>
      String(read(mark, "status", "Status")).toLowerCase() === "pending",
  );
  return (
    <>
      <Heading
        eyebrow="SCHOOL OVERVIEW"
        title="Administrator dashboard"
        subtitle="Live totals from your school records."
      />
      <div className="stat-grid">
        <LiveStat
          label="Students"
          value={students.length}
          detail="Enrolled records"
          icon="♙"
        />
        <LiveStat
          label="Teachers"
          value={teachers.length}
          detail="Teaching profiles"
          icon="♧"
        />
        <LiveStat
          label="Classes"
          value={classes.length}
          detail="Current class list"
          icon="▦"
        />
        <LiveStat
          label="Marks pending"
          value={pendingMarks.length}
          detail="Awaiting approval"
          icon="◷"
        />
      </div>
      <FinanceOverview classes={classes} />
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>Current academic term</h3>
              <p>Term dates and status from your database</p>
            </div>
          </div>
          <div className="admin-summary-card">
            {activeTerm ? (
              <>
                <strong>
                  {read(activeTerm, "name", "Name")}{" "}
                  {read(activeTerm, "year", "Year")}
                </strong>
                <span>
                  {dateValue(read(activeTerm, "startDate", "StartDate"))} to{" "}
                  {dateValue(read(activeTerm, "endDate", "EndDate"))}
                </span>
                <StateBadge value={read(activeTerm, "status", "Status")} />
              </>
            ) : (
              <span>
                No active term is set. Create or update a term under Academics.
              </span>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>Recent mark submissions</h3>
              <p>Latest assessment records</p>
            </div>
          </div>
          <div className="admin-recent-list">
            {marks.slice(0, 5).map((mark) => (
              <div key={idOf(mark)}>
                <span>
                  <strong>{read(mark, "studentName", "StudentName")}</strong>
                  <small>
                    {read(mark, "unitName", "UnitName")} ·{" "}
                    {read(mark, "termName", "TermName")}
                  </small>
                </span>
                <b>{read(mark, "score", "Score")}</b>
                <StateBadge value={read(mark, "status", "Status")} />
              </div>
            ))}
            {!marks.length && (
              <p className="empty-state">No mark records yet.</p>
            )}
          </div>
        </section>
      </div>
      <RecentPayments />
    </>
  );
}

function RecentPayments() {
  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return dateInputValue(date);
  });
  const [to, setTo] = useState(() => dateInputValue(new Date()));
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (from && to && from > to) {
      setPayments([]);
      setError("The start date must be on or before the end date.");
      setLoading(false);
      return undefined;
    }
    let current = true;
    const query = new URLSearchParams({ from, to });
    setLoading(true);
    setError("");
    apiGet(`/payments/recent?${query}`)
      .then((result) => {
        if (current) setPayments(rows(result));
      })
      .catch((loadError) => {
        if (current) {
          setPayments([]);
          setError(loadError.message || "Could not load recent payments.");
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [from, to]);

  return (
    <section className="panel recent-payments-panel">
      <div className="panel-title recent-payments-title">
        <div>
          <h3>Recent fee payments</h3>
          <p>Latest 50 completed payments in the selected date range.</p>
        </div>
        <div className="recent-payments-filters">
          <label>
            From
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
      </div>
      {error && <Notice error>{error}</Notice>}
      {loading ? (
        <p className="empty-state">Loading recent payments...</p>
      ) : !payments.length ? (
        <p className="empty-state">No payments found in this date range.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>DATE</th>
                <th>STUDENT</th>
                <th>ADMISSION NUMBER</th>
                <th>METHOD</th>
                <th>REFERENCE</th>
                <th>AMOUNT</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={idOf(payment)}>
                  <td>{new Date(read(payment, "createdAt", "CreatedAt")).toLocaleString("en-KE")}</td>
                  <td>{read(payment, "studentName", "StudentName")}</td>
                  <td>{read(payment, "admissionNumber", "AdmissionNumber")}</td>
                  <td>{read(payment, "method", "Method")}</td>
                  <td>{read(payment, "transactionReference", "TransactionReference") || "-"}</td>
                  <td>{currency(read(payment, "amount", "Amount"))}</td>
                  <td><StateBadge value={read(payment, "status", "Status")} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FinanceOverview({ classes }) {
  const [classBalances, setClassBalances] = useState([]);
  const [expandedClass, setExpandedClass] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    async function load() {
      setLoading(true);
      setError("");
      const availableClasses = classes.filter((item) => {
        const id = read(item, "id", "ID");
        return id && !String(id).startsWith("missing-");
      });
      if (!availableClasses.length) {
        if (current) {
          setClassBalances([]);
          setLoading(false);
        }
        return;
      }

      const results = await Promise.allSettled(
        availableClasses.map(async (classItem) => {
          const id = read(classItem, "id", "ID");
          const balances = rows(await apiGet(`/classes/${id}/fees/balances`));
          return {
            id: String(id),
            name: read(classItem, "name", "Name") || "Class",
            students: balances.length,
            studentBalances: balances,
            total: balances.reduce(
              (sum, row) =>
                sum + Number(read(row, "totalFees", "TotalFees") || 0),
              0,
            ),
            paid: balances.reduce(
              (sum, row) =>
                sum + Number(read(row, "amountPaid", "AmountPaid") || 0),
              0,
            ),
            remaining: balances.reduce(
              (sum, row) =>
                sum +
                Number(
                  read(row, "outstandingBalance", "OutstandingBalance") || 0,
                ),
              0,
            ),
          };
        }),
      );

      if (current) {
        const successful = results
          .filter((result) => result.status === "fulfilled")
          .map((result) => result.value);
        setClassBalances(successful);
        if (successful.length < results.length) {
          setError("Some class balances could not be loaded.");
        }
        setLoading(false);
      }
    }
    load().catch((loadError) => {
      if (current) {
        setError(loadError.message || "Could not load fee balances.");
        setLoading(false);
      }
    });
    return () => {
      current = false;
    };
  }, [classes]);

  const totals = classBalances.reduce(
    (sum, item) => ({
      billed: sum.billed + item.total,
      paid: sum.paid + item.paid,
      remaining: sum.remaining + item.remaining,
    }),
    { billed: 0, paid: 0, remaining: 0 },
  );
  const collectionRate = totals.billed
    ? Math.min(100, Math.round((totals.paid / totals.billed) * 100))
    : 0;

  return (
    <section className="panel finance-overview">
      <div className="panel-title">
        <div>
          <h3>Fee collection overview</h3>
          <p>Current outstanding balances and completed payments by class.</p>
        </div>
        <span className="finance-rate">{collectionRate}% collected</span>
      </div>
      <div className="finance-metrics">
        <div className="finance-metric collected">
          <span>Collected</span>
          <strong>{currency(totals.paid)}</strong>
        </div>
        <div className="finance-metric remaining">
          <span>Remaining</span>
          <strong>{currency(totals.remaining)}</strong>
        </div>
        <div className="finance-metric billed">
          <span>Total billed</span>
          <strong>{currency(totals.billed)}</strong>
        </div>
      </div>
      <div
        className="finance-overview-progress"
        aria-label={`${collectionRate}% of fees collected`}
      >
        <span style={{ width: `${collectionRate}%` }} />
      </div>
      {error && <p className="finance-overview-message">{error}</p>}
      {loading ? (
        <p className="finance-overview-message">Loading class balances…</p>
      ) : classBalances.length ? (
        <div className="finance-class-list">
          {classBalances.map((item) => {
            const rate = item.total
              ? Math.min(100, Math.round((item.paid / item.total) * 100))
              : 0;
            async function downloadPDF() {
              try {
                const filename = `${
                  item.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "") || "class"
                }-fee-balances.pdf`;
                await apiDownload(
                  `/classes/${item.id}/fees/balances/pdf`,
                  filename,
                );
              } catch (downloadError) {
                setError(
                  downloadError.message || "Could not download the PDF.",
                );
              }
            }
            return (
              <div className="finance-class-row" key={item.id}>
                <div className="finance-class-heading">
                  <span>
                    <button
                      type="button"
                      className="finance-class-name"
                      aria-expanded={expandedClass === item.id}
                      onClick={() =>
                        setExpandedClass((current) =>
                          current === item.id ? "" : item.id,
                        )
                      }
                    >
                      {item.name}
                      <span aria-hidden="true">
                        {expandedClass === item.id ? "−" : "+"}
                      </span>
                    </button>
                    <small>{item.students} students</small>
                  </span>
                  <b>{currency(item.remaining)} remaining</b>
                </div>
                <div
                  className="finance-class-track"
                  aria-label={`${rate}% collected for ${item.name}`}
                >
                  <span style={{ width: `${rate}%` }} />
                </div>
                <div className="finance-class-caption">
                  <span>{currency(item.paid)} collected</span>
                  <span>{rate}%</span>
                </div>
                {expandedClass === item.id && (
                  <div className="finance-student-balances">
                    <div className="finance-student-balances-toolbar">
                      <strong>{item.name} student balances</strong>
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={downloadPDF}
                      >
                        Download PDF
                      </button>
                    </div>
                    <div className="finance-student-balance-heading">
                      <span>Student</span>
                      <span>Billed</span>
                      <span>Paid</span>
                      <span>Remaining</span>
                    </div>
                    {item.studentBalances.map((student, index) => (
                      <div
                        className="finance-student-balance"
                        key={idOf(student) || `${item.id}-${index}`}
                      >
                        <span>
                          <strong>
                            {read(student, "studentName", "StudentName") ||
                              "Student"}
                          </strong>
                          <small>
                            {read(
                              student,
                              "admissionNumber",
                              "AdmissionNumber",
                            )}
                          </small>
                        </span>
                        <b>
                          {currency(read(student, "totalFees", "TotalFees"))}
                        </b>
                        <b>
                          {currency(read(student, "amountPaid", "AmountPaid"))}
                        </b>
                        <b className="student-balance-due">
                          {currency(
                            read(
                              student,
                              "outstandingBalance",
                              "OutstandingBalance",
                            ),
                          )}
                        </b>
                      </div>
                    ))}
                    {!item.studentBalances.length && (
                      <p className="finance-overview-message">
                        No student balances are available for this class.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        !loading && (
          <p className="finance-overview-message">
            Fee balances will appear here once students have term accounts.
          </p>
        )
      )}
    </section>
  );
}

function LiveStat({ label, value, detail, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <i className="stat-icon blue">{icon}</i>
      </div>
      <strong className="stat-value">{value}</strong>
      <div className="stat-bottom">{detail}</div>
    </div>
  );
}

function StudentsPage({
  students,
  total,
  page,
  totalPages,
  loading,
  onPageChange,
  open,
  edit,
  reset,
}) {
  return (
    <>
      <Heading
        eyebrow="SCHOOL DIRECTORY"
        title="Students"
        subtitle="Student records loaded from the school database."
        actions={<ActionButton onClick={open}>＋ Add student</ActionButton>}
      />
      <div className="toolbar">
        <span className="result-count">
          <strong>{total}</strong> matching records
        </span>
      </div>
      <div className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>STUDENT</th>
                <th>ADMISSION NUMBER</th>
                <th>CLASS</th>
                <th>PARENT PHONE</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={idOf(s)}>
                  <td>
                    <strong>{read(s, "studentName", "StudentName")}</strong>
                  </td>
                  <td>{read(s, "admissionNumber", "AdmissionNumber")}</td>
                  <td>{read(s, "className", "ClassName") || "Unassigned"}</td>
                  <td>{read(s, "parentPhoneNumber", "ParentPhoneNumber")}</td>
                  <td>
                    <StateBadge value={read(s, "status", "Status")} />
                  </td>
                  <td>
                    <div className="inline-actions">
                      <button
                        className="button secondary small"
                        onClick={() =>
                          edit({
                            id: idOf(s),
                            classId: read(s, "classId", "ClassID"),
                            status: read(s, "status", "Status"),
                          })
                        }
                      >
                        Update
                      </button>
                      <button
                        className="button secondary small"
                        onClick={() => reset(s)}
                      >
                        Reset password
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading ? (
            <div className="empty-state">Loading students...</div>
          ) : !students.length ? (
            <div className="empty-state">No students found.</div>
          ) : null}
        </div>
      </div>
      <div className="table-footer">
        <span>
          Showing <b>{total ? (page - 1) * STUDENTS_PAGE_SIZE + 1 : 0}-{Math.min(page * STUDENTS_PAGE_SIZE, total)}</b> of <b>{total}</b> students
        </span>
        <div>
          <button
            type="button"
            disabled={loading || page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </button>
          <span>Page {totalPages ? page : 0} of {totalPages}</span>
          <button
            type="button"
            disabled={loading || page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
      <p className="admin-footnote">
        Student accounts use the school default password and must change it at
        first sign-in. The active term invoice is created from the class fee
        template.
      </p>
    </>
  );
}

function TeachersPage({ teachers, assignments, open, edit }) {
  return (
    <>
      <Heading
        eyebrow="SCHOOL DIRECTORY"
        title="Teachers"
        subtitle="Manage staff profiles and their class and subject assignments."
        actions={<ActionButton onClick={open}>＋ Add teacher</ActionButton>}
      />
      <div className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>TEACHER</th>
                <th>PHONE NUMBER</th>
                <th>EMPLOYEE NUMBER</th>
                <th>ASSIGNMENTS</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => {
                const assigned = assignments.filter(
                  (a) =>
                    String(read(a, "teacherId", "TeacherID")) ===
                    String(idOf(teacher)),
                );
                return (
                  <tr key={idOf(teacher)}>
                    <td>
                      <strong>
                        {read(teacher, "teacherName", "TeacherName")}
                      </strong>
                    </td>
                    <td>{read(teacher, "phoneNumber", "PhoneNumber")}</td>
                    <td>{read(teacher, "employeeNumber", "EmployeeNumber")}</td>
                    <td>
                      {assigned.length} assignment
                      {assigned.length === 1 ? "" : "s"}
                    </td>
                    <td>
                      <StateBadge value={read(teacher, "status", "Status")} />
                    </td>
                    <td>
                      <button
                        className="button secondary small"
                        onClick={() =>
                          edit({
                            id: idOf(teacher),
                            status: read(teacher, "status", "Status"),
                          })
                        }
                      >
                        Set status
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!teachers.length && (
            <div className="empty-state">No teacher profiles found.</div>
          )}
        </div>
      </div>
      <p className="admin-footnote">
        The phone number is used for sign-in; the employee number is the
        teacher's separate staff identifier.
      </p>
    </>
  );
}

function ClassesPage({
  classes,
  units,
  teachers,
  assignments,
  createClass,
  createUnit,
  createAssignment,
  editClass,
  editUnit,
  remove,
}) {
  const findName = (list, recordId) =>
    list.find((entry) => String(idOf(entry)) === String(recordId));
  return (
    <>
      <Heading
        eyebrow="ACADEMIC ORGANISATION"
        title="Classes & units"
        subtitle="Maintain class groups, subjects, and teacher assignments."
        actions={
          <>
            <ActionButton secondary onClick={createUnit}>
              ＋ Add unit
            </ActionButton>
            <ActionButton secondary onClick={createAssignment}>
              Assign teacher
            </ActionButton>
            <ActionButton onClick={createClass}>＋ Create class</ActionButton>
          </>
        }
      />
      <div className="admin-split">
        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>Classes</h3>
              <p>{classes.length} records</p>
            </div>
          </div>
          <div className="admin-list">
            {classes.map((item) => (
              <div key={idOf(item)}>
                <span>
                  <strong>{read(item, "name", "Name")}</strong>
                  <small>
                    Created {dateValue(read(item, "createdAt", "CreatedAt"))}
                  </small>
                </span>
                <button
                  className="button secondary small"
                  onClick={() =>
                    editClass({
                      id: idOf(item),
                      name: read(item, "name", "Name"),
                    })
                  }
                >
                  Rename
                </button>
                <button
                  className="row-menu"
                  onClick={() => remove(`/classes/${idOf(item)}`, "class")}
                >
                  ×
                </button>
              </div>
            ))}
            {!classes.length && <p className="empty-state">No classes yet.</p>}
          </div>
        </section>
        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>Units / subjects</h3>
              <p>{units.length} records</p>
            </div>
          </div>
          <div className="admin-list">
            {units.map((item) => (
              <div key={idOf(item)}>
                <span>
                  <strong>{read(item, "name", "Name")}</strong>
                  <small>
                    {read(item, "classId", "ClassID") || "School-wide unit"}
                  </small>
                </span>
                <button
                  className="button secondary small"
                  onClick={() =>
                    editUnit({
                      id: idOf(item),
                      name: read(item, "name", "Name"),
                    })
                  }
                >
                  Rename
                </button>
                <button
                  className="row-menu"
                  onClick={() => remove(`/units/${idOf(item)}`, "unit")}
                >
                  ×
                </button>
              </div>
            ))}
            {!units.length && <p className="empty-state">No units yet.</p>}
          </div>
        </section>
      </div>
      <section className="panel assignment-panel">
        <div className="panel-title">
          <div>
            <h3>Teaching assignments</h3>
            <p>Teacher, class, and subject links</p>
          </div>
        </div>
        <div className="admin-list">
          {assignments.map((item) => {
            const teacher = findName(
              teachers,
              read(item, "teacherId", "TeacherID"),
            );
            const classItem = findName(
              classes,
              read(item, "classId", "ClassID"),
            );
            const unit = findName(units, read(item, "unitId", "UnitID"));
            return (
              <div key={idOf(item)}>
                <span>
                  <strong>
                    {read(teacher, "teacherName", "TeacherName") || "Teacher"} ·{" "}
                    {read(classItem, "name", "Name") || "Class"}
                  </strong>
                  <small>
                    {read(unit, "name", "Name") || "Assigned subject"}
                  </small>
                </span>
                <button
                  className="row-menu"
                  onClick={() =>
                    remove(
                      `/teaching_assignments/${idOf(item)}`,
                      "teaching assignment",
                    )
                  }
                >
                  ×
                </button>
              </div>
            );
          })}
          {!assignments.length && (
            <p className="empty-state">No teaching assignments found.</p>
          )}
        </div>
      </section>
      <Notice>
        The unit API does not accept `class_id`; use teaching assignments to
        link a subject to a class and teacher.
      </Notice>
    </>
  );
}

function AcademicsPage({ terms, marks, create, edit, onStatus, onDeleteMark }) {
  return (
    <>
      <Heading
        eyebrow="ACADEMIC MANAGEMENT"
        title="Academics"
        subtitle="Manage terms and review marks submitted by teachers."
        actions={<ActionButton onClick={create}>＋ Create term</ActionButton>}
      />
      <div className="panel">
        <div className="panel-title">
          <div>
            <h3>Academic terms</h3>
            <p>{terms.length} terms in the database</p>
          </div>
        </div>
        <div className="admin-list">
          {terms.map((term) => (
            <div key={idOf(term)}>
              <span>
                <strong>
                  {read(term, "name", "Name")} {read(term, "year", "Year")}
                </strong>
                <small>
                  {dateValue(read(term, "startDate", "StartDate"))} –{" "}
                  {dateValue(read(term, "endDate", "EndDate"))}
                </small>
              </span>
              <StateBadge value={read(term, "status", "Status")} />
              <button
                className="button secondary small"
                onClick={() =>
                  edit({
                    id: idOf(term),
                    name: read(term, "name", "Name"),
                    year: read(term, "year", "Year"),
                    startDate: dateValue(read(term, "startDate", "StartDate")),
                    endDate: dateValue(read(term, "endDate", "EndDate")),
                    status: read(term, "status", "Status"),
                  })
                }
              >
                Edit
              </button>
            </div>
          ))}
          {!terms.length && <p className="empty-state">No terms yet.</p>}
        </div>
      </div>
      <div className="panel review-panel">
        <div className="panel-title">
          <div>
            <h3>Marks for approval</h3>
            <p>Approve or reject submissions made by teachers.</p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>STUDENT</th>
                <th>UNIT</th>
                <th>TERM</th>
                <th>SCORE</th>
                <th>STATUS</th>
                <th>REVIEW</th>
              </tr>
            </thead>
            <tbody>
              {marks.map((mark) => {
                const status = String(
                  read(mark, "status", "Status"),
                ).toLowerCase();
                return (
                  <tr key={idOf(mark)}>
                    <td>{read(mark, "studentName", "StudentName")}</td>
                    <td>{read(mark, "unitName", "UnitName")}</td>
                    <td>{read(mark, "termName", "TermName")}</td>
                    <td>{read(mark, "score", "Score")}</td>
                    <td>
                      <StateBadge value={status} />
                    </td>
                    <td>
                      {status === "pending" ? (
                        <div className="inline-actions">
                          <button
                            className="button secondary small"
                            onClick={() => onStatus(mark, "rejected")}
                          >
                            Reject
                          </button>
                          <button
                            className="button primary small"
                            onClick={() => onStatus(mark, "approved")}
                          >
                            Approve
                          </button>
                        </div>
                      ) : (
                        <div className="inline-actions">
                          <span>Reviewed</span>
                          <button
                            className="row-menu"
                            aria-label="Delete mark"
                            onClick={() => onDeleteMark(idOf(mark))}
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!marks.length && (
            <div className="empty-state">No marks submitted yet.</div>
          )}
        </div>
      </div>
    </>
  );
}

function FeesPage({
  structures,
  classes,
  terms,
  students,
  selected,
  items,
  itemsError,
  create,
  editStructure,
  addItem,
  editItem,
  deleteItem,
  createAccounts,
  createSingleAccount,
  updateAccount,
  recordPayment,
  paymentStatus,
  onItems,
  onDelete,
  onPdf,
}) {
  return (
    <>
      <Heading
        eyebrow="SCHOOL FINANCE"
        title="Fees & payments"
        subtitle="Configure fee structures, create student accounts, and record payments."
        actions={
          <>
            <ActionButton secondary onClick={createAccounts}>
              Bulk accounts
            </ActionButton>
            <ActionButton secondary onClick={createSingleAccount}>
              Student account
            </ActionButton>
            <ActionButton secondary onClick={updateAccount}>
              Adjust account
            </ActionButton>
            <ActionButton secondary onClick={recordPayment}>
              ＋ Record payment
            </ActionButton>
            <ActionButton secondary onClick={paymentStatus}>
              Update payment status
            </ActionButton>
            <ActionButton onClick={create}>＋ Fee structure</ActionButton>
          </>
        }
      />
      <div className="panel">
        <div className="panel-title">
          <div>
            <h3>Fee structures</h3>
            <p>
              {structures.length} structures · classes {classes.length} · terms{" "}
              {terms.length}
            </p>
          </div>
        </div>
        <div className="admin-list">
          {structures.map((structure) => (
            <div key={idOf(structure)}>
              <span>
                <strong>
                  {read(structure, "name", "Name") ||
                    `${read(structure, "className", "ClassName")} · ${read(structure, "termName", "TermName")}`}
                </strong>
                <small>
                  {read(structure, "className", "ClassName")} ·{" "}
                  {read(structure, "termName", "TermName")}
                </small>
              </span>
              <button
                className="button secondary small"
                onClick={() => onItems(structure)}
              >
                Items
              </button>
              <button
                className="button secondary small"
                onClick={() => addItem({ ...structure, id: idOf(structure) })}
              >
                ＋ Item
              </button>
              <button
                className="button secondary small"
                onClick={() =>
                  editStructure({
                    id: idOf(structure),
                    classId: read(structure, "classId", "ClassID"),
                    termId: read(structure, "termId", "TermID"),
                    name: read(structure, "name", "Name"),
                  })
                }
              >
                Edit
              </button>
              <button
                className="button secondary small"
                onClick={() => onPdf(idOf(structure))}
              >
                PDF
              </button>
              <button
                className="row-menu"
                onClick={() => onDelete(idOf(structure))}
              >
                ×
              </button>
            </div>
          ))}
          {!structures.length && (
            <p className="empty-state">
              No fee structures. Create one using an existing class and term.
            </p>
          )}
        </div>
      </div>
      {selected && (
        <section className="panel fee-items-panel">
          <div className="panel-title">
            <div>
              <h3>
                Fee items ·{" "}
                {read(selected, "name", "Name") ||
                  read(selected, "className", "ClassName")}
              </h3>
              <p>Itemized charges in this structure</p>
            </div>
            <button
              className="button secondary small"
              onClick={() => addItem({ ...selected, id: idOf(selected) })}
            >
              ＋ Add item
            </button>
          </div>
          {itemsError ? (
            <p className="empty-state">{itemsError}</p>
          ) : (
            <div className="admin-list">
              {items.map((item) => (
                <div key={idOf(item)}>
                  <span>
                    <strong>
                      {read(item, "code", "Code")} ·{" "}
                      {read(item, "description", "Description")}
                    </strong>
                    <small>{currency(read(item, "amount", "Amount"))}</small>
                  </span>
                  <button
                    className="button secondary small"
                    onClick={() =>
                      editItem({
                        id: idOf(item),
                        code: read(item, "code", "Code"),
                        description: read(item, "description", "Description"),
                        amount: read(item, "amount", "Amount"),
                      })
                    }
                  >
                    Edit
                  </button>
                  <button
                    className="row-menu"
                    onClick={() => deleteItem(idOf(item))}
                  >
                    ×
                  </button>
                </div>
              ))}
              {!items.length && (
                <p className="empty-state">
                  No items in this fee structure yet.
                </p>
              )}
            </div>
          )}
        </section>
      )}
      <ClassBalancePanel classes={classes} />
      <div className="admin-split">
        <section className="panel finance-help">
          <h3>Available finance actions</h3>
          <p>
            Bulk account creation is supported by your API. To record a payment,
            choose a student who already has a fee account.
          </p>
          <div>
            <b>{students.length}</b> students available
          </div>
        </section>
        <Notice>
          The dashboard lists the latest 50 payments for the selected date
          range. Use its calendar filters to review another period.
        </Notice>
      </div>
    </>
  );
}

function ClassBalancePanel({ classes }) {
  const [classId, setClassId] = useState("");
  const [balances, setBalances] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!classId) {
      setBalances([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    apiGet(`/classes/${classId}/fees/balances`)
      .then((result) => {
        if (active) setBalances(rows(result));
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId]);
  return (
    <section className="panel class-balance-panel">
      <div className="panel-title">
        <div>
          <h3>Class fee balances</h3>
          <p>Balances calculated from fee accounts and completed payments.</p>
        </div>
        <select
          className="filter-button"
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
        >
          <option value="">Choose class</option>
          {classes.map((item) => (
            <option key={idOf(item)} value={idOf(item)}>
              {read(item, "name", "Name")}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="empty-state">{error}</p>}
      {loading && <p className="empty-state">Loading class balances…</p>}
      {classId && !loading && !error && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>STUDENT</th>
                <th>ADMISSION</th>
                <th>TOTAL FEES</th>
                <th>PAID</th>
                <th>OUTSTANDING</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((item) => (
                <tr key={idOf(item)}>
                  <td>{read(item, "studentName", "StudentName")}</td>
                  <td>{read(item, "admissionNumber", "AdmissionNumber")}</td>
                  <td>{currency(read(item, "totalFees", "TotalFees"))}</td>
                  <td>{currency(read(item, "amountPaid", "AmountPaid"))}</td>
                  <td>
                    {currency(
                      read(item, "outstandingBalance", "OutstandingBalance"),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!balances.length && (
            <p className="empty-state">No fee balance rows for this class.</p>
          )}
        </div>
      )}
    </section>
  );
}

function ReportsPage({ students, teachers, classes, terms, marks, onExport }) {
  const approved = marks.filter(
    (mark) =>
      String(read(mark, "status", "Status")).toLowerCase() === "approved",
  ).length;
  return (
    <>
      <Heading
        eyebrow="SCHOOL INSIGHTS"
        title="Reports"
        subtitle="Current totals derived from live school records."
        actions={
          <ActionButton onClick={onExport}>⇩ Export students CSV</ActionButton>
        }
      />
      <div className="stat-grid">
        <LiveStat
          label="Students"
          value={students.length}
          detail="Current records"
          icon="♙"
        />
        <LiveStat
          label="Teachers"
          value={teachers.length}
          detail="Current profiles"
          icon="♧"
        />
        <LiveStat
          label="Classes"
          value={classes.length}
          detail="Current groups"
          icon="▦"
        />
        <LiveStat
          label="Approved marks"
          value={approved}
          detail={`${marks.length} marks total`}
          icon="✓"
        />
      </div>
      <div className="panel">
        <div className="panel-title">
          <div>
            <h3>Academic terms</h3>
            <p>Terms currently recorded</p>
          </div>
        </div>
        <div className="admin-list">
          {terms.map((term) => (
            <div key={idOf(term)}>
              <span>
                <strong>
                  {read(term, "name", "Name")} {read(term, "year", "Year")}
                </strong>
                <small>
                  {dateValue(read(term, "startDate", "StartDate"))} –{" "}
                  {dateValue(read(term, "endDate", "EndDate"))}
                </small>
              </span>
              <StateBadge value={read(term, "status", "Status")} />
            </div>
          ))}
          {!terms.length && (
            <p className="empty-state">No term data available.</p>
          )}
        </div>
      </div>
      <Notice>
        Attendance, fee collection totals, and downloadable academic reports
        need reporting endpoints that are not present in the supplied backend.
      </Notice>
    </>
  );
}

function AccessPage({ users }) {
  return (
    <>
      <Heading
        eyebrow="SCHOOL SETTINGS"
        title="User access"
        subtitle="View registered accounts and their assigned roles."
      />
      <div className="access-callout">
        <span>♙</span>
        <div>
          <strong>First sign-in password change</strong>
          <p>
            New student, teacher, and admin accounts use the school default
            password and must choose a new one at their first sign-in.
          </p>
        </div>
      </div>
      <div className="panel table-panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>NAME</th>
                <th>PHONE / LOGIN</th>
                <th>ROLE</th>
                <th>USER ID</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={idOf(user)}>
                  <td>
                    <strong>{read(user, "name", "Name")}</strong>
                  </td>
                  <td>{read(user, "phoneNumber", "Phonenumber")}</td>
                  <td>
                    <span className="role-pill">
                      {read(user, "role", "Role")}
                    </span>
                  </td>
                  <td className="muted-cell">{idOf(user)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!users.length && (
            <div className="empty-state">No user accounts found.</div>
          )}
        </div>
      </div>
    </>
  );
}

function AdminDialog({ dialog, data, error, onSubmit, onClose }) {
  const type = typeof dialog === "string" ? dialog : dialog.type;
  const record = dialog.record || {};
  const title =
    {
      student: "Add student",
      teacher: "Add teacher",
      class: "Create class",
      "edit-class": "Rename class",
      unit: "Add unit",
      "edit-unit": "Rename unit",
      assignment: "Assign teacher",
      "student-status": "Update student",
      "teacher-status": "Update teacher status",
      term: "Create academic term",
      "edit-term": "Update academic term",
      "fee-structure": "Create fee structure",
      "edit-fee-structure": "Edit fee structure",
      "fee-item": "Add fee item",
      "edit-fee-item": "Edit fee item",
      "fee-accounts": "Create fee accounts",
      "single-account": "Create a student fee account",
      "account-amount": "Adjust fee account amount",
      payment: "Record payment",
      "payment-status": "Update payment status",
    }[type] || "Update record";
  const [studentAccounts, setStudentAccounts] = useState([]);
  const [studentError, setStudentError] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");

  useEffect(() => {
    if (!["payment", "account-amount"].includes(type) || !selectedStudent) {
      setStudentAccounts([]);
      return;
    }
    let active = true;
    setStudentAccounts([]);
    setStudentError("");
    apiGet(`/students/${selectedStudent}/fees`)
      .then((result) => {
        if (active) {
          setStudentAccounts(rows(result));
          setStudentError("");
        }
      })
      .catch((err) => {
        if (active) setStudentError(err.message);
      });
    return () => {
      active = false;
    };
  }, [type, selectedStudent]);

  function select(
    name,
    label,
    options,
    valueKey = "id",
    labelFn,
    defaultValue = "",
  ) {
    const upperKey =
      valueKey === "id"
        ? "ID"
        : valueKey.endsWith("Id")
          ? `${valueKey[0].toUpperCase()}${valueKey.slice(1, -2)}ID`
          : valueKey[0].toUpperCase() + valueKey.slice(1);
    return (
      <label className="admin-field">
        {label}
        <select name={name} required defaultValue={defaultValue}>
          <option value="" disabled>
            Select {label.toLowerCase()}
          </option>
          {options.map((option, index) => {
            const value = read(option, valueKey, upperKey);
            return (
              <option value={value} key={value || `option-${label}-${index}`}>
                {labelFn ? labelFn(option) : read(option, "name", "Name")}
              </option>
            );
          })}
        </select>
      </label>
    );
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="modal admin-modal" onSubmit={onSubmit}>
        <button type="button" className="modal-close" onClick={onClose}>
          ×
        </button>
        <div className="modal-icon">＋</div>
        <h2>{title}</h2>
        <p>Changes are saved to the school API.</p>
        {type === "student" && (
          <>
            <label className="admin-field">
              Student name
              <input name="name" required />
            </label>
            <label className="admin-field">
              Class
              <select name="classId" required defaultValue="">
                <option value="" disabled>
                  Select a class
                </option>
                {data.classes.map((item) => (
                  <option key={idOf(item)} value={idOf(item)}>
                    {read(item, "name", "Name")}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              Parent / guardian phone
              <input name="parentNumber" required placeholder="+254…" />
            </label>
            <label className="admin-field">
              Student phone (optional)
              <input name="phoneNumber" placeholder="+254…" />
            </label>
            <small>
              Student accounts use the school default password and must change
              it at first sign-in.
            </small>
          </>
        )}
        {type === "teacher" && (
          <>
            <label className="admin-field">
              Teacher name
              <input name="name" required />
            </label>
            <label className="admin-field">
              Phone number (login)
              <input
                name="phoneNumber"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+254..."
                required
              />
            </label>
            <label className="admin-field">
              Employee number (staff ID)
              <input name="employeeNumber" autoComplete="off" required />
            </label>
            <small>
              The phone number is the teacher's login. The employee number is a
              separate staff ID. Both must be unique; teachers must change the
              school default password at first sign-in.
            </small>
          </>
        )}
        {["class", "edit-class"].includes(type) && (
          <label className="admin-field">
            Class name
            <input name="name" required defaultValue={record.name || ""} />
          </label>
        )}
        {["unit", "edit-unit"].includes(type) && (
          <label className="admin-field">
            Unit / subject name
            <input name="name" required defaultValue={record.name || ""} />
          </label>
        )}
        {type === "assignment" && (
          <>
            {select(
              "teacherId",
              "Teacher",
              data.teachers,
              "id",
              (o) =>
                `${read(o, "teacherName", "TeacherName")} · ${read(o, "employeeNumber", "EmployeeNumber")}`,
            )}
            {select("classId", "Class", data.classes, "id", (o) =>
              read(o, "name", "Name"),
            )}
            {select("unitId", "Unit", data.units, "id", (o) =>
              read(o, "name", "Name"),
            )}
          </>
        )}
        {type === "student-status" && (
          <>
            {select(
              "classId",
              "Class",
              data.classes,
              "id",
              (o) => read(o, "name", "Name"),
              record.classId || "",
            )}
            <label className="admin-field">
              Status
              <select name="status" defaultValue={record.status || "active"}>
                {["active", "inactive", "graduated", "transferred"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <input type="hidden" name="studentID" value={record.id} />
          </>
        )}
        {type === "teacher-status" && (
          <label className="admin-field">
            Status
            <select name="status" defaultValue={record.status || "active"}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        )}
        {["term", "edit-term"].includes(type) && (
          <>
            <label className="admin-field">
              Term
              <select name="name" defaultValue={record.name || "Term 1"}>
                {["Term 1", "Term 2", "Term 3"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              Year
              <input
                name="year"
                type="number"
                min="2000"
                max="2200"
                required
                defaultValue={record.year || new Date().getFullYear()}
              />
            </label>
            <label className="admin-field">
              Start date
              <input
                name="startDate"
                type="date"
                required
                defaultValue={record.startDate || ""}
              />
            </label>
            <label className="admin-field">
              End date
              <input
                name="endDate"
                type="date"
                required
                defaultValue={record.endDate || ""}
              />
            </label>
            {type === "edit-term" && (
              <label className="admin-field">
                Status
                <select
                  name="status"
                  defaultValue={record.status || "upcoming"}
                >
                  {["upcoming", "active", "closed"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
        {["fee-structure", "edit-fee-structure"].includes(type) && (
          <>
            {select(
              "classId",
              "Class",
              data.classes,
              "id",
              (o) => read(o, "name", "Name"),
              record.classId || "",
            )}
            {select(
              "termId",
              "Term",
              data.terms,
              "id",
              (o) => `${read(o, "name", "Name")} ${read(o, "year", "Year")}`,
              record.termId || "",
            )}
            {type === "edit-fee-structure" && (
              <input
                name="name"
                type="hidden"
                value={record.name || ""}
                readOnly
              />
            )}
            <small className="admin-help">
              The API names a structure from its class and term.
            </small>
          </>
        )}
        {["fee-item", "edit-fee-item"].includes(type) && (
          <>
            <label className="admin-field">
              Code
              <input
                name="code"
                required
                placeholder="TUITION"
                defaultValue={record.code || ""}
              />
            </label>
            <label className="admin-field">
              Description
              <input
                name="description"
                required
                placeholder="Tuition fee"
                defaultValue={record.description || ""}
              />
            </label>
            <label className="admin-field">
              Amount (KES)
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={record.amount || ""}
              />
            </label>
          </>
        )}
        {type === "fee-accounts" && (
          <>
            {select(
              "feeStructureId",
              "Fee structure",
              data.feeStructures,
              "id",
              (o) =>
                `${read(o, "className", "ClassName")} · ${read(o, "termName", "TermName")}`,
            )}
            <small className="admin-help">
              Creates one fee account for each active student in the structure’s
              class. The amount is calculated from the fee items.
            </small>
          </>
        )}
        {type === "single-account" && (
          <>
            {select(
              "studentId",
              "Student",
              data.students,
              "id",
              (o) =>
                `${read(o, "studentName", "StudentName")} · ${read(o, "admissionNumber", "AdmissionNumber")}`,
            )}
            {select(
              "feeStructureId",
              "Fee structure",
              data.feeStructures,
              "id",
              (o) =>
                `${read(o, "className", "ClassName")} · ${read(o, "termName", "TermName")}`,
            )}
            <small className="admin-help">
              The API calculates the amount from the fee structure items.
            </small>
          </>
        )}
        {["payment", "account-amount"].includes(type) && (
          <label className="admin-field">
            Student
            <select
              required
              value={selectedStudent}
              onChange={(event) => setSelectedStudent(event.target.value)}
            >
              <option value="">Select a student</option>
              {data.students.map((s) => (
                <option key={idOf(s)} value={idOf(s)}>
                  {read(s, "studentName", "StudentName")} ·{" "}
                  {read(s, "admissionNumber", "AdmissionNumber")}
                </option>
              ))}
            </select>
          </label>
        )}
        {type === "account-amount" && selectedStudent && (
          <>
            <label className="admin-field">
              Fee account
              <select name="accountId" required defaultValue="">
                <option value="" disabled>
                  Select an account
                </option>
                {studentAccounts.map((a) => (
                  <option key={idOf(a)} value={idOf(a)}>
                    {read(a, "feeStructureName", "FeeStructureName")} · current
                    due {currency(read(a, "amountDue", "AmountDue"))}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              New amount due (KES)
              <input
                name="amountDue"
                type="number"
                min="0"
                step="0.01"
                required
              />
            </label>
          </>
        )}
        {type === "payment" && (
          <>
            {selectedStudent && (
              <label className="admin-field">
                Fee account
                <select name="accountId" required defaultValue="">
                  <option value="" disabled>
                    Select an account
                  </option>
                  {studentAccounts.map((a) => (
                    <option key={idOf(a)} value={idOf(a)}>
                      {read(a, "feeStructureName", "FeeStructureName")} · due{" "}
                      {currency(read(a, "amountDue", "AmountDue"))}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {studentError && <Notice error>{studentError}</Notice>}
            {selectedStudent && !studentAccounts.length && !studentError && (
              <small className="admin-help">
                No fee accounts found for this student yet.
              </small>
            )}
            <label className="admin-field">
              Amount (KES)
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
              />
            </label>
            <label className="admin-field">
              Method
              <select name="method">
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="bank">Bank</option>
              </select>
            </label>
            <label className="admin-field">
              Transaction reference
              <input name="transactionReference" />
            </label>
            <label className="admin-field">
              Phone number
              <input name="phoneNumber" />
            </label>
          </>
        )}
        {type === "payment-status" && (
          <>
            <label className="admin-field">
              Payment ID
              <input
                name="paymentId"
                required
                placeholder="Paste payment UUID"
              />
            </label>
            <label className="admin-field">
              New status
              <select name="status">
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <small className="admin-help">
              The backend accepts payment IDs but does not provide a payment
              list to select from.
            </small>
          </>
        )}
        {error && <div className="modal-note error-text">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
