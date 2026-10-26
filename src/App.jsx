import { useEffect, useRef, useState } from "react";
import {
  FiArrowRight, FiAward, FiBell, FiBookOpen, FiCheck, FiDatabase, FiDollarSign,
  FiFileText, FiGrid, FiMenu, FiMoreHorizontal, FiSearch, FiSettings,
  FiFeather, FiStar, FiSun,
  FiUser, FiUsers, FiX,
} from "react-icons/fi";
import {
  AppShellSkeleton,
  FeeSkeleton,
} from "./Skeleton";
import {
  login as loginRequest,
  logout as logoutRequest,
  apiGet,
  apiPost,
  apiPut,
} from "./api";
import AdminWorkspace from "./AdminWorkspace";
import { TeacherDashboard as LiveTeacherDashboard, TeacherClasses as LiveTeacherClasses, TeacherStudents as LiveTeacherStudents, Gradebook as LiveGradebook } from "./TeacherWorkspace";
import { StudentDashboard as LiveStudentDashboard, StudentResults as LiveStudentResults, StudentProfile as LiveStudentProfile } from "./StudentWorkspace";
import { readSchoolSetup } from "./SchoolSetup";

const navByRole = {
  admin: [
    {
      group: "OVERVIEW",
      items: [
        ["Overview", FiGrid],
        ["Students", FiUsers],
        ["Teachers", FiUser],
        ["Classes & units", FiBookOpen],
        ["Grading system", FiAward],
      ],
    },
    {
      group: "SCHOOL",
      items: [
        ["Academics", FiBookOpen],
        ["Fees & payments", FiDollarSign],
        ["Reports", FiFileText],
        ["Data backup", FiDatabase],
      ],
    },
  ],
  teacher: [
    {
      group: "TEACHING",
      items: [
        ["Overview", FiGrid],
        ["My classes", FiBookOpen],
        ["Gradebook", FiFileText],
        ["Students", FiUsers],
      ],
    },
  ],
  student: [
    {
      group: "MY SCHOOL",
      items: [
        ["Overview", FiGrid],
        ["My results", FiFileText],
        ["My fees", FiDollarSign],
        ["My profile", FiUser],
      ],
    },
  ],
};

const roleLabels = {
  admin: "School administrator",
  teacher: "Teacher",
  student: "Student",
};

function Icon({ children, className = "" }) {
  return (
    <span className={`icon ${className}`} aria-hidden="true">
      {children}
    </span>
  );
}

function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div className={`toast ${toast.type === "error" ? "toast-error" : ""}`} role={toast.type === "error" ? "alert" : "status"} aria-live={toast.type === "error" ? "assertive" : "polite"}>
          <span>{toast.type === "error" ? "!" : <FiCheck />}</span>
      {toast.message}
      <button type="button" aria-label="Dismiss notification" onClick={onDismiss}><FiX /></button>
    </div>
  );
}

function App() {
  const [role, setRole] = useState("admin");
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 850);
  const [accountName, setAccountName] = useState("");
  const [page, setPage] = useState("Overview");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState("");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [login, setLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [school] = useState(
  () =>
    readSchoolSetup() || {
      name: "Mwangaza Academy",
      level: "Primary & Junior",
      location: "Garissa,Kenya",
      logo: "./logo.png",
    },
);
  const [sessionLoading, setSessionLoading] = useState(true);
  useEffect(() => {
    let current = true;
    const sessionKey = "schoolmanagement.session";
    let cachedSession = null;
    try {
      cachedSession = JSON.parse(sessionStorage.getItem(sessionKey) || "null");
    } catch {
      sessionStorage.removeItem(sessionKey);
    }
    if (["admin", "teacher", "student"].includes(cachedSession?.role)) {
      setRole(cachedSession.role);
      setAccountName(cachedSession.name || "");
      setMustChangePassword(Boolean(cachedSession.mustChangePassword));
      setLogin(false);
    }
    apiGet("/session")
      .then((session) => {
        if (!current || !["admin", "teacher", "student"].includes(session?.role)) return;
        setRole(session.role);
        setAccountName(session.name || "");
        setMustChangePassword(Boolean(session.mustChangePassword));
        setLogin(false);
        sessionStorage.setItem(sessionKey, JSON.stringify(session));
      })
      .catch((error) => {
        if (!current || error.status !== 401) return;
        sessionStorage.removeItem(sessionKey);
        setAccountName("");
        setMustChangePassword(false);
        setLogin(true);
      })
      .finally(() => {
        if (current) setSessionLoading(false);
      });
    return () => {
      current = false;
    };
  }, []);

  function notify(message, type = "success") {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 3200);
  }
function passwordChangeRequired(...responses) {
  return responses.some((response) => {
    if (!response || typeof response !== "object") return false;

    return Boolean(
      response.mustChangePassword ??
      response.MustChangePassword ??
      response.must_change_password ??
      response.passwordChangeRequired ??
      response.PasswordChangeRequired ??
      response.password_change_required ??
      response.requirePasswordChange ??
      response.require_password_change ??
      response.data?.mustChangePassword ??
      response.data?.must_change_password
    );
  });
}
 async function handleLogin(credentials) {
  const result = await loginRequest(credentials);
  const authenticatedRole = result?.role || result?.Role;

  if (!["admin", "teacher", "student"].includes(authenticatedRole)) {
    throw new Error("The server returned an invalid account role.");
  }

  const name = result?.name || result?.Name || credentials.username || "";
  const needsPasswordChange = passwordChangeRequired(result);

  setRole(authenticatedRole);
  setAccountName(name);
  setPage("Overview");
  setMustChangePassword(needsPasswordChange);

  sessionStorage.setItem("schoolmanagement.session", JSON.stringify({
    role: authenticatedRole,
    name,
    mustChangePassword: needsPasswordChange,
  }));

  setLogin(false);
  notify(needsPasswordChange ? "Please change your password to continue" : "Welcome back");
}

  async function handleLogout() {
    try {
      await logoutRequest();
    } catch {
      // Clear the local view even if the session has already expired.
    }
    setLogin(true);
    setAccountName("");
    sessionStorage.removeItem("schoolmanagement.session");
    setPage("Overview");
  }

  const displayName = accountName || roleLabels[role];
  const activeNav = navByRole[role];

 if (sessionLoading) {
  return <AppShellSkeleton />;
}
  if (login)
    return (
      <>
      <LoginScreen
        onLogin={handleLogin}
        onNotify={notify}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        school={school}
      />
      <Toast toast={toast} onDismiss={() => { if (toastTimer.current) window.clearTimeout(toastTimer.current); toastTimer.current = null; setToast(null); }} />
      </>
    );
  if (mustChangePassword)
    return (
      <ChangePasswordScreen
        onSave={async (body) => {
          await apiPut("/me/password", body);
          setMustChangePassword(false);
          notify("Password updated");
        }}
        onLogout={handleLogout}
      />
    );

  return (
    <div className={`app-shell ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
      <aside className="sidebar" id="primary-sidebar">
        <div className="brand">
          <div className="brand-mark">
            <button
            className="sidebar-toggle"
            type="button"
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            aria-expanded={sidebarOpen}
            aria-controls="primary-sidebar"
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            <span aria-hidden="true">{sidebarOpen ? <FiX /> : <FiMenu />}</span>
          </button>
          </div>
          <div>
            {school.logo ? <img className="brand-logo" src={school.logo} alt="" /> : <><strong>{school.name}</strong><small>{school.level || "SCHOOL"}</small></>}
          </div>
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          {activeNav.map((section) => (
            <div className="nav-section" key={section.group}>
              <div className="nav-heading">{section.group}</div>
              {section.items.map(([label, IconComponent]) => (
                <button
                  key={label}
                  onClick={() => {
                    setPage(label);
                    if (window.innerWidth <= 850) setSidebarOpen(false);
                  }}
                  className={`nav-item ${page === label ? "selected" : ""}`}
                >
                  <Icon><IconComponent /></Icon>
                  <span>{label}</span>
                  {label === "Fees & payments" && (
                    <span className="nav-count">3</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="profile-switch"
            onClick={() => setModal("account")}
          >
            <div className="avatar avatar-dark">
              {displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
            </div>
            <div className="profile-text">
              <strong>{displayName}</strong>
              <small>{roleLabels[role]}</small>
            </div>
            <span className="more"><FiMoreHorizontal /></span>
          </button>
        </div>
      </aside>
      {sidebarOpen && window.innerWidth <= 850 && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <div className="crumb">
            Workspace <span>/</span> <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <label className="search-box">
              <Icon><FiSearch /></Icon>
              <input
                id="workspace-search"
                name="workspaceSearch"
                placeholder="Search anything..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <kbd>Ctrl K</kbd>
            </label>
            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() => notify("You are all caught up")}
            >
              <span><FiBell /></span>
              <i />
            </button>
            <div className="top-divider" />
            <div className="role-chip">
              <span className={`role-dot ${role}`} />
              {roleLabels[role]}
            </div>
          </div>
        </header>

        <div className="content">
          {role === "admin" && (
            <AdminWorkspace page={page} search={search} onNotify={notify} school={school} />
          )}
          {role === "teacher" && page === "Overview" && (
            <LiveTeacherDashboard onOpen={setPage} />
          )}
          {role === "teacher" && page === "My classes" && <LiveTeacherClasses />}
          {role === "teacher" && page === "Gradebook" && (
            <LiveGradebook />
          )}
          {role === "teacher" && page === "Students" && (
            <LiveTeacherStudents />
          )}
          {role === "student" && page === "Overview" && (
            <LiveStudentDashboard onOpen={setPage} />
          )}
          {role === "student" && page === "My results" && <LiveStudentResults school={school} />}
          {role === "student" && page === "My fees" && (
            <StudentFees onNotify={notify} />
          )}
          {role === "student" && page === "My profile" && (
            <LiveStudentProfile onNotify={notify} />
          )}
          <footer className="footer">
            <span>&copy; {new Date().getFullYear()} {school.name}</span>
            <nav aria-label="Footer links">
              <button onClick={() => notify("Help centre is coming soon")}>
                Help centre
              </button>
              <span aria-hidden="true">&middot;</span>
              <button onClick={() => setModal("account")}>Account</button>
              <span className="preview-label">Connected workspace</span>
            </nav>
          </footer>
        </div>
      </main>

      {toast && (
        <div className={`toast ${toast.type === "error" ? "toast-error" : ""}`} role={toast.type === "error" ? "alert" : "status"} aria-live={toast.type === "error" ? "assertive" : "polite"}>
          <span>{toast.type === "error" ? "!" : <FiCheck />}</span>
          {toast.message}
          <button type="button" aria-label="Dismiss notification" onClick={() => { if (toastTimer.current) window.clearTimeout(toastTimer.current); toastTimer.current = null; setToast(null); }}><FiX /></button>
        </div>
      )}
      {modal && (
        <Modal
          role={role}
          accountName={accountName}
          onClose={() => setModal("")}
          onNotify={notify}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

function PageHeading({ eyebrow, title, subtitle, children }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}

function rowValue(row, ...keys) {
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
}
function cash(value) {
  return `KES ${Number(value || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}
function StudentFees({ onNotify }) {
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;
    let timer;
    Promise.all([apiGet("/me/fees/summary"), apiGet("/me/payments")])
      .then(([summary, history]) => {
        if (!current) return;
        setAccounts(Array.isArray(summary) ? summary : []);
        const records = Array.isArray(history) ? history : [];
        setPayments(records);
        if (
          records.some(
            (payment) =>
              String(rowValue(payment, "status", "Status")).toLowerCase() ===
              "pending",
          )
        ) {
          timer = window.setTimeout(
            () => setRevision((value) => value + 1),
            15000,
          );
        }
        setError("");
      })
      .catch((loadError) => {
        if (current)
          setError(loadError.message || "Could not load your fee account.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [revision]);

  async function startPayment(event) {
    event.preventDefault();
    if (!selected) return;

    const paymentAmount = Number(amount);
    const balance = Number(rowValue(selected, "balance", "Balance") || 0);
    if (!Number.isInteger(paymentAmount) || paymentAmount < 1 || paymentAmount > balance) {
      setError(`Enter a whole KES amount between 1 and ${Math.floor(balance).toLocaleString("en-KE")}.`);
      return;
    }

    const normalizedPhone = phoneNumber.trim().replace(/[\s-]/g, "");
    if (!/^(?:254|0)(?:7|1)\d{8}$/.test(normalizedPhone)) {
      setError("Enter a valid Kenyan Safaricom number, e.g. 0712345678, 0112345678, or 254712345678.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const result = await apiPost("/me/payments", {
        studentFeeAccountId: rowValue(selected, "id", "ID"),
        amount: String(paymentAmount),
        method: "mpesa",
        phoneNumber: normalizedPhone,
      });
      setSelected(null);
      setPhoneNumber("");
      onNotify(
        rowValue(result, "customerMessage", "message") ||
          "M-Pesa prompt sent. Approve it on your phone.",
      );
      setRevision((value) => value + 1);
    } catch (paymentError) {
      setError(paymentError.message || "Could not start M-Pesa checkout.");
      onNotify(paymentError.message || "Could not start M-Pesa checkout.", "error");
    } finally {
      setBusy(false);
    }
  }

  const totalDue = accounts.reduce(
    (sum, row) => sum + Number(rowValue(row, "amountDue", "AmountDue") || 0),
    0,
  );
  const totalPaid = accounts.reduce(
    (sum, row) => sum + Number(rowValue(row, "amountPaid", "AmountPaid") || 0),
    0,
  );
  const totalBalance = accounts.reduce(
    (sum, row) => sum + Number(rowValue(row, "balance", "Balance") || 0),
    0,
  );
  const visiblePayments = payments.filter((payment) => {
    const status = String(rowValue(payment, "status", "Status")).toLowerCase();
    if (status === "completed") return true;
    if (status !== "pending") return false;
    const created = new Date(rowValue(payment, "createdAt", "CreatedAt")).getTime();
    return Number.isFinite(created) && Date.now() - created < 60 * 60 * 1000;
  });
  const progress =
    totalDue > 0 ? Math.min(100, Math.round((totalPaid / totalDue) * 100)) : 0;

  return (
    <>
      <PageHeading
        eyebrow="SCHOOL ACCOUNT"
        title="My fees"
        subtitle="View your invoices and pay an outstanding balance with M-Pesa STK Push."
      />
      {error && (
        <div className="admin-notice error">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {loading ? (
  <FeeSkeleton />
) : (
        <>
          <div className="fee-student-summary">
            <div>
              <span>OUTSTANDING BALANCE</span>
              <strong>{cash(totalBalance)}</strong>
              <small>
                Across {accounts.length} invoice
                {accounts.length === 1 ? "" : "s"}
              </small>
            </div>
            <div>
              <span>PAID</span>
              <strong>{cash(totalPaid)}</strong>
              <small>Completed payments</small>
            </div>
            <div>
              <span>TOTAL INVOICED</span>
              <strong>{cash(totalDue)}</strong>
              <small>All terms</small>
            </div>
            <div className="fee-progress">
              <div>
                <span>Fees paid</span>
                <b>{progress}%</b>
              </div>
              <div className="mini-progress">
                <span style={{ width: `${progress}%` }} />
              </div>
              <small>
                {cash(totalPaid)} of {cash(totalDue)}
              </small>
            </div>
          </div>
          <section className="panel invoice-section">
            <div className="panel-title">
              <div>
                <h3>Your invoices</h3>
                <p>Each payment is linked to the invoice you select.</p>
              </div>
              <button
                className="button secondary small"
                onClick={() => setRevision((value) => value + 1)}
              >
                Refresh
              </button>
            </div>
            <div className="invoice-list">
              {accounts.map((account, index) => {
                const balance = Number(
                  rowValue(account, "balance", "Balance") || 0,
                );
                const accountID = rowValue(account, "id", "ID");
                return (
                  <article
                    className="invoice-card"
                    key={accountID || `student-invoice-${index}`}
                  >
                    <div className="invoice-top">
                      <div>
                        <strong>
                          {rowValue(
                            account,
                            "termName",
                            "TermName",
                            "feeStructureName",
                            "FeeStructureName",
                          ) || `Invoice ${String(accountID).slice(0, 8)}`}
                        </strong>
                        <span>Invoice balance</span>
                      </div>
                      <b>{cash(balance)}</b>
                    </div>
                    <div className="invoice-summary">
                      <span>
                        Paid{" "}
                        {cash(
                          rowValue(account, "amountPaid", "AmountPaid") || 0,
                        )}
                      </span>
                      <strong>
                        Total{" "}
                        {cash(
                          rowValue(account, "amountDue", "AmountDue") || 0,
                        )}
                      </strong>
                      <button
                        className="button primary small"
                        disabled={balance < 1}
                        onClick={() => {
                          setSelected(account);
                          setAmount(String(Math.floor(balance)));
                          setError("");
                        }}
                      >
                        Pay with M-Pesa
                      </button>
                    </div>
                  </article>
                );
              })}
              {!accounts.length && (
                <p className="empty-state">
                  No fee invoices are linked to your student account yet.
                </p>
              )}
            </div>
          </section>
          <section className="panel invoice-section">
            <div className="panel-title">
              <div>
                <h3>Payment history</h3>
                <p>
                  M-Pesa attempts remain pending for up to one hour. Only
                  confirmed payments stay in your history after that.
                </p>
              </div>
            </div>
            <div className="payment-history">
              {visiblePayments.map((payment, index) => {
                const status = String(rowValue(payment, "status", "Status"));
                return (
                  <div
                    key={
                      rowValue(payment, "id", "ID") ||
                      `student-payment-${index}`
                    }
                  >
                    <span>
                      <strong>
                        {cash(rowValue(payment, "amount", "Amount"))} -{" "}
                        {rowValue(payment, "method", "Method")}
                      </strong>
                      <small>
                        {rowValue(
                          payment,
                          "transactionReference",
                          "TransactionReference",
                        ) ||
                          rowValue(payment, "phoneNumber", "PhoneNumber") ||
                          "No receipt yet"}
                      </small>
                    </span>
                    <span
                      className={`status ${status.toLowerCase() === "completed" ? "active" : "pending"}`}
                    >
                      <i />
                      {status}
                    </span>
                    <small>
                      {String(
                        rowValue(payment, "createdAt", "CreatedAt") || "",
                      ).slice(0, 10)}
                    </small>
                  </div>
                );
              })}
              {!visiblePayments.length && <p>No successful or active payment attempts yet.</p>}
            </div>
          </section>
          <div className="info-note">
            <span>?</span> M-Pesa sandbox checkout sends a prompt to the number
            you enter. Approve it on the phone; the invoice updates after
            Safaricom confirms payment.
          </div>
        </>
      )}
      {selected && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy)
              setSelected(null);
          }}
        >
          <form className="modal" onSubmit={startPayment}>
            <button
              type="button"
              className="modal-close"
              onClick={() => setSelected(null)}
            >
              <FiX />
            </button>
            <h2>Pay with M-Pesa</h2>
            <p>
              Enter the Safaricom number that should receive the STK prompt.
            </p>
            <label className="field-label">Amount (whole KES)</label>
            <input
              className="form-input"
              type="number"
              name="amount"
              min="1"
              max={rowValue(selected, "balance", "Balance")}
              step="1"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <label className="field-label">M-Pesa phone number</label>
            <input
              className="form-input"
              type="tel"
              name="phoneNumber"
              placeholder="0712345678"
              autoComplete="tel"
              required
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
            {error && <div className="login-error">{error}</div>}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? "Sending prompt..." : "Send STK prompt"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}


function LoginScreen({
  onLogin,
  onNotify,
  showPassword,
  setShowPassword,
  school,
}) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      await onLogin({
        username: form.get("username").trim(),
        password: form.get("password"),
      });
    } catch (loginError) {
      const message = loginError.status === 401
        ? "Sign-in failed. Staff and admins should use their registered phone number; students should use their ADM admission number. Check the password and try again."
        : loginError.message || "Unable to sign in. Check your details and try again.";
      setError(message);
      onNotify(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-side">
        <div className="brand">
          <div className="brand-mark">
            <FiBookOpen aria-hidden="true" />
          </div>
          <div>
            {school.logo ? <img className="brand-logo" src={school.logo} alt="" /> : <><strong>{school.name}</strong><small>{school.level || "SCHOOL"}</small></>}
          </div>
        </div>
        <div className="login-art">
          <div className="login-orbit orbit-one" />
          <div className="login-orbit orbit-two" />
          <div className="login-sun"><FiSun aria-hidden="true" /></div>
          <div className="login-book"><FiBookOpen aria-hidden="true" /></div>
          <span className="login-plant"><FiFeather aria-hidden="true" /></span>
          <span className="login-spark"><FiStar aria-hidden="true" /></span>
        </div>
        <div className="login-quote">
          <h2>
            A brighter future
            <br />
            starts <em>here.</em>
          </h2>
          <p>One school community, learning and growing together.</p>
          <div className="login-dots">
            <i />
            <i />
            <i />
          </div>
        </div>
        <small className="login-copyright">
          &copy; {new Date().getFullYear()} {school.name}{school.location ? ` · ${school.location}` : ""}
        </small>
      </div>
      <div className="login-form-side">
        <div className="login-top">{school.name}</div>
        <form className="login-form" onSubmit={submit}>
          <div className="eyebrow">WELCOME BACK</div>
          <h1>Sign in to your account</h1>
          <p>Enter your details to access your school workspace.</p>
          <label className="field-label" htmlFor="username">
            Phone number or admission number
          </label>
          <input
            name="username"
            className="form-input"
            id="username"
            autoComplete="username"
            placeholder="e.g. 0712345678 or ADM-2026-0001"
            required
          />
          <div className="field-heading">
            <label className="field-label" htmlFor="password">
              Password
            </label>
          </div>
          <div className="password-field">
            <input
              name="password"
              className="form-input"
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <div className="login-options">
            <span className="login-hint">
              Staff/admin: registered phone number. Students: admission number.
            </span>
            <button
              type="button"
              onClick={() =>
                setError(
                  "Please contact your school administrator to reset your password.",
                )
              }
            >
              Forgot password?
            </button>
          </div>
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
          <button
            className="button primary login-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? (
              "Signing in..."
            ) : (
              <>
                Sign in <FiArrowRight aria-hidden="true" />
              </>
            )}
          </button>
          <div className="login-divider">
            <span />
            secure school access
            <span />
          </div>
          <button
            type="button"
            className="help-login"
            onClick={() =>
              setError(
                "Please contact your school administrator for help signing in.",
              )
            }
          >
            Having trouble signing in? <b>Contact your school administrator</b>
          </button>
        </form>
      </div>
    </div>
  );
}

function ChangePasswordScreen({ onSave, onLogout }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") || "");
    const newPassword = String(form.get("newPassword") || "");
    if (newPassword !== form.get("confirmPassword")) {
      setError("The new passwords do not match.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ currentPassword, newPassword });
    } catch (saveError) {
      setError(saveError.message || "Could not update password.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="login-screen">
      <div className="login-form-side">
        <form className="login-form" onSubmit={submit}>
          <div className="eyebrow">ACCOUNT SECURITY</div>
          <h1>Choose a new password</h1>
          <p>
            This is your first sign-in or your password was reset. Update it to
            continue.
          </p>
          <label className="field-label">Current password</label>
          <div className="password-field">
            <input
              className="form-input"
              name="currentPassword"
              type={showCurrent ? "text" : "password"}
              required
              autoComplete="current-password"
            />
            <button type="button" className="password-toggle" aria-label={showCurrent ? "Hide current password" : "Show current password"} aria-pressed={showCurrent} onClick={() => setShowCurrent((show) => !show)}>
              {showCurrent ? "Hide" : "Show"}
            </button>
          </div>
          <label className="field-label">New password</label>
          <div className="password-field">
            <input
              className="form-input"
              name="newPassword"
              type={showNew ? "text" : "password"}
              required
              minLength="8"
              autoComplete="new-password"
            />
            <button type="button" className="password-toggle" aria-label={showNew ? "Hide new password" : "Show new password"} aria-pressed={showNew} onClick={() => setShowNew((show) => !show)}>
              {showNew ? "Hide" : "Show"}
            </button>
          </div>
          <label className="field-label">Confirm new password</label>
          <div className="password-field">
            <input
              className="form-input"
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              required
              minLength="8"
              autoComplete="new-password"
            />
            <button type="button" className="password-toggle" aria-label={showConfirm ? "Hide password confirmation" : "Show password confirmation"} aria-pressed={showConfirm} onClick={() => setShowConfirm((show) => !show)}>
              {showConfirm ? "Hide" : "Show"}
            </button>
          </div>
          {error && <div className="login-error">{error}</div>}
          <button className="button primary login-submit" disabled={saving}>
            {saving ? "Updating..." : "Update password"}
          </button>
          <button type="button" className="help-login" onClick={onLogout}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

function Modal({ role, accountName, onClose, onLogout }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <button type="button" className="modal-close" onClick={onClose}>
          <FiX />
        </button>
        <div className="modal-icon"><FiSettings aria-hidden="true" /></div>
        <h2>Account settings</h2>
        <p>Manage your account preferences.</p>
        <div className="account-modal-user">
          <div className="avatar avatar-blue">
            {(accountName || roleLabels[role])
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase()}
          </div>
          <div>
            <strong>{accountName || "Account"}</strong>
            <small>{roleLabels[role]}</small>
          </div>
        </div>
        <button
          className="button secondary modal-wide"
          onClick={() => {
            onClose();
            onLogout();
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export default App;
