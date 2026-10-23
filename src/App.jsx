import { useEffect, useState } from "react";
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

const navByRole = {
  admin: [
    {
      group: "OVERVIEW",
      items: [
        ["Overview", "⌂"],
        ["Students", "♙"],
        ["Teachers", "♧"],
        ["Classes & units", "▦"],
      ],
    },
    {
      group: "SCHOOL",
      items: [
        ["Academics", "▤"],
        ["Fees & payments", "◉"],
        ["Reports", "▥"],
      ],
    },
  ],
  teacher: [
    {
      group: "TEACHING",
      items: [
        ["Overview", "⌂"],
        ["My classes", "▦"],
        ["Gradebook", "▤"],
        ["Students", "♙"],
      ],
    },
  ],
  student: [
    {
      group: "MY SCHOOL",
      items: [
        ["Overview", "⌂"],
        ["My results", "▤"],
        ["My fees", "◉"],
        ["My profile", "♙"],
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

function App() {
  const [role, setRole] = useState("admin");
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 850);
  const [accountName, setAccountName] = useState("");
  const [page, setPage] = useState("Overview");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState("");
  const [toast, setToast] = useState("");
  const [login, setLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);

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

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function handleLogin(credentials) {
    const result = await loginRequest(credentials);
    const authenticatedRole = result?.role;
    if (!["admin", "teacher", "student"].includes(authenticatedRole)) {
      throw new Error("The server returned an invalid account role.");
    }
    setRole(authenticatedRole);
    setAccountName(result?.name || result?.Name || credentials.username || "");
    setPage("Overview");
    setMustChangePassword(
      Boolean(result?.mustChangePassword || result?.MustChangePassword),
    );
    sessionStorage.setItem("schoolmanagement.session", JSON.stringify({
      role: authenticatedRole,
      name: result?.name || result?.Name || credentials.username || "",
      mustChangePassword: Boolean(result?.mustChangePassword || result?.MustChangePassword),
    }));
    setLogin(false);
    notify("Welcome back");
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

  if (sessionLoading)
    return <div className="session-restore">Restoring your session…</div>;

  if (login)
    return (
      <LoginScreen
        onLogin={handleLogin}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
      />
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
            <span aria-hidden="true">{sidebarOpen ? "✳" : "☰"}</span>
          </button>
          </div>
          <div>
            <strong>Northstar</strong>
            <small>ACADEMY</small>
          </div>
        </div>
        <div className="school-switch">
          <div className="school-emblem">N</div>
          <div className="school-meta">
            <strong>Northstar Academy</strong>
            <small>Primary & Junior</small>
          </div>
          <span className="chevron">⌄</span>
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          {activeNav.map((section) => (
            <div className="nav-section" key={section.group}>
              <div className="nav-heading">{section.group}</div>
              {section.items.map(([label, icon]) => (
                <button
                  key={label}
                  onClick={() => {
                    setPage(label);
                    if (window.innerWidth <= 850) setSidebarOpen(false);
                  }}
                  className={`nav-item ${page === label ? "selected" : ""}`}
                >
                  <Icon>{icon}</Icon>
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
            <span className="more">•••</span>
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
              <Icon>⌕</Icon>
              <input
                placeholder="Search anything..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <kbd>⌘ K</kbd>
            </label>
            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() => notify("You’re all caught up")}
            >
              <span>♧</span>
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
            <AdminWorkspace page={page} search={search} onNotify={notify} />
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
          {role === "student" && page === "My results" && <LiveStudentResults />}
          {role === "student" && page === "My fees" && (
            <StudentFees onNotify={notify} />
          )}
          {role === "student" && page === "My profile" && (
            <LiveStudentProfile onNotify={notify} />
          )}
          <footer className="footer">
            <span>© 2026 Northstar Academy</span>
            <div>
              <button onClick={() => notify("Help centre is coming soon")}>
                Help centre
              </button>
              <span>·</span>
              <button onClick={() => setModal("account")}>Account</button>
              <span className="preview-label">Connected workspace</span>
            </div>
          </footer>
        </div>
      </main>

      {toast && (
        <div className="toast">
          <span>✓</span>
          {toast}
        </div>
      )}
      {modal && (
        <Modal
          type={modal}
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

function Button({ children, variant = "primary", onClick, icon }) {
  return (
    <button className={`button ${variant}`} onClick={onClick}>
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
}

function AdminDashboard({ period, setPeriod, onOpen, onNotify }) {
  return (
    <>
      <PageHeading
        eyebrow="MONDAY, 19 OCTOBER 2026"
        title="Good morning, Ibrahim ☀️"
        subtitle="Here’s what’s happening across your school today."
      >
        <button
          className="button date-button"
          onClick={() =>
            setPeriod(period === "This term" ? "This year" : "This term")
          }
        >
          ▦ &nbsp;{period}
          <span>⌄</span>
        </button>
        <Button
          icon="⇧"
          onClick={() => onNotify("Report export is ready soon")}
        >
          Export report
        </Button>
      </PageHeading>
      <div className="welcome-strip">
        <div className="welcome-icon">✦</div>
        <div>
          <strong>Your school is off to a great start this term</strong>
          <p>
            Attendance is up <b>4.8%</b> compared to last term. Keep it going!
          </p>
        </div>
        <button onClick={() => onOpen("Reports")}>
          View school report <span>→</span>
        </button>
        <span className="strip-close">×</span>
      </div>
      <div className="section-title">
        <div>
          <h2>School at a glance</h2>
          <p>A quick look at your school’s key numbers.</p>
        </div>
        <button className="text-button" onClick={() => onOpen("Reports")}>
          View all reports <span>→</span>
        </button>
      </div>
      <div className="stat-grid">
        <StatCard
          label="Total students"
          value="248"
          change="12"
          note="vs. last term"
          icon="♙"
          color="blue"
          detail="8 classes"
        />
        <StatCard
          label="Teaching staff"
          value="18"
          change="2"
          note="new this term"
          icon="♧"
          color="violet"
          detail="16 active"
        />
        <StatCard
          label="Fees collected"
          value="KES 1.84M"
          change="8.2%"
          note="vs. last term"
          icon="◉"
          color="green"
          detail="72% of target"
        />
        <StatCard
          label="Attendance today"
          value="94.6%"
          change="2.1%"
          note="vs. last week"
          icon="◷"
          color="orange"
          detail="235 of 248 present"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel collection-panel">
          <PanelTitle
            title="Fee collection"
            subtitle="Collection progress for Term 2, 2026"
            action="View fees"
            onClick={() => onOpen("Fees & payments")}
          />
          <div className="collection-body">
            <div className="donut-wrap">
              <div className="donut">
                <div>
                  <strong>72%</strong>
                  <small>collected</small>
                </div>
              </div>
            </div>
            <div className="collection-legend">
              <div>
                <i className="dot collected" />
                <span>Collected</span>
                <strong>KES 1.84M</strong>
              </div>
              <div>
                <i className="dot pending" />
                <span>Outstanding</span>
                <strong>KES 712K</strong>
              </div>
              <div className="collection-foot">
                Target for this term <b>KES 2.55M</b>
              </div>
            </div>
          </div>
          <div className="progress-track">
            <span style={{ width: "72%" }} />
          </div>
        </section>
        <section className="panel activity-panel">
          <PanelTitle
            title="Recent activity"
            subtitle="The latest updates from your school"
            action="See all"
            onClick={() => onOpen("Reports")}
          />
          <div className="activity-list">
            <Activity
              color="green"
              icon="✓"
              title="Payment received"
              detail="Amara Wanjiku · KES 8,500"
              time="10 min ago"
            />
            <Activity
              color="blue"
              icon="♙"
              title="New student enrolled"
              detail="Noah Kiptoo · Grade 6 North"
              time="42 min ago"
            />
            <Activity
              color="violet"
              icon="▤"
              title="Marks submitted for review"
              detail="David Kamau · Science · Term 2"
              time="2 hours ago"
            />
            <Activity
              color="orange"
              icon="＋"
              title="New teacher added"
              detail="Mercy Wambui · Mathematics"
              time="Yesterday"
            />
          </div>
        </section>
      </div>
      <div className="section-title lower-title">
        <div>
          <h2>Students overview</h2>
          <p>Recently added students and their account status.</p>
        </div>
        <Button variant="secondary" onClick={() => onOpen("Students")}>
          View all students <span>→</span>
        </Button>
      </div>
      <div className="panel table-panel">
        <StudentTable students={[]} compact />
      </div>
    </>
  );
}

function StatCard({ label, value, change, note, icon, color, detail }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <i className={`stat-icon ${color}`}>{icon}</i>
      </div>
      <strong className="stat-value">{value}</strong>
      <div className="stat-bottom">
        <span className="change">↗ {change}</span>
        <span>{note}</span>
        <span className="stat-detail">{detail}</span>
      </div>
    </div>
  );
}
function PanelTitle({ title, subtitle, action, onClick }) {
  return (
    <div className="panel-title">
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <button className="text-button" onClick={onClick}>
        {action} <span>→</span>
      </button>
    </div>
  );
}
function Activity({ color, icon, title, detail, time }) {
  return (
    <div className="activity-row">
      <span className={`activity-icon ${color}`}>{icon}</span>
      <div className="activity-copy">
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <time>{time}</time>
    </div>
  );
}

function StudentsPage({ students, onAdd, onReset, teacher = false }) {
  return (
    <>
      <PageHeading
        eyebrow="SCHOOL DIRECTORY"
        title="Students"
        subtitle="View and manage student records across all classes."
      >
        <Button variant="secondary" onClick={onReset}>
          ↻ Reset password
        </Button>
        {!teacher && (
          <Button icon="＋" onClick={onAdd}>
            Add student
          </Button>
        )}
      </PageHeading>
      <div className="toolbar">
        <div className="result-count">
          <strong>{students.length}</strong> students <span>·</span> All classes
        </div>
        <div className="filters">
          <button className="filter-button">
            All classes <span>⌄</span>
          </button>
          <button className="filter-button">
            Status: Active <span>⌄</span>
          </button>
          <button className="filter-button">⇩ &nbsp;Download</button>
        </div>
      </div>
      <div className="panel table-panel">
        <StudentTable students={students} />
      </div>
      <div className="table-footer">
        <span>
          Showing{" "}
          <b>
            {students.length ? 1 : 0}–{students.length}
          </b>{" "}
          of <b>248</b> students
        </span>
        <div>
          <button disabled>←</button>
          <button className="page-number">1</button>
          <button>2</button>
          <button>3</button>
          <span>…</span>
          <button>13</button>
          <button>→</button>
        </div>
      </div>
    </>
  );
}

function StudentTable({ students, compact = false }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>
              <input type="checkbox" aria-label="Select all" />
            </th>
            <th>STUDENT</th>
            <th>ADMISSION NO.</th>
            <th>CLASS</th>
            <th>STATUS</th>
            {!compact && <th>FEE BALANCE</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.admission}>
              <td>
                <input type="checkbox" aria-label={`Select ${student.name}`} />
              </td>
              <td>
                <div className="student-cell">
                  <span className={`avatar avatar-${student.color}`}>
                    {student.initials}
                  </span>
                  <strong>{student.name}</strong>
                </div>
              </td>
              <td className="muted-cell">{student.admission}</td>
              <td>{student.className}</td>
              <td>
                <span className="status active">
                  <i />
                  {student.status}
                </span>
              </td>
              {!compact && (
                <td
                  className={
                    student.balance === "KES 0" ? "balance-zero" : "balance-due"
                  }
                >
                  {student.balance}
                </td>
              )}
              <td>
                <button
                  className="row-menu"
                  aria-label={`More options for ${student.name}`}
                >
                  •••
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {students.length === 0 && (
        <div className="empty-state">No students match that search.</div>
      )}
    </div>
  );
}

function GenericListPage({ title, subtitle, action, icon, rows, onAction }) {
  return (
    <>
      <PageHeading eyebrow="SCHOOL DIRECTORY" title={title} subtitle={subtitle}>
        <Button icon="＋" onClick={onAction}>
          {action}
        </Button>
      </PageHeading>
      <div className="toolbar">
        <div className="result-count">
          <strong>{rows.length}</strong> records <span>·</span> Current school
          year
        </div>
        <button className="filter-button">
          All status <span>⌄</span>
        </button>
      </div>
      <div className="panel simple-list">
        {rows.map((item) => {
          const [name, details, status] = item.split("|");
          return (
            <div className="simple-row" key={name}>
              <span className="simple-icon">{icon}</span>
              <div className="simple-copy">
                <strong>{name}</strong>
                <span>{details}</span>
              </div>
              <span className="status active">
                <i />
                {status}
              </span>
              <button className="row-menu">•••</button>
            </div>
          );
        })}
      </div>
      <div className="info-note">
        <span>✦</span> Changes made here are reflected in your school records.
      </div>
    </>
  );
}

function AcademicsPage({ onNotify }) {
  return (
    <>
      <PageHeading
        eyebrow="ACADEMIC MANAGEMENT"
        title="Academics"
        subtitle="Manage terms, subjects, and assessment results."
      >
        <Button
          icon="＋"
          onClick={() => onNotify("Term creation form coming soon")}
        >
          Create term
        </Button>
      </PageHeading>
      <div className="term-banner">
        <div>
          <span className="eyebrow">CURRENT TERM</span>
          <h2>Term 2, 2026</h2>
          <p>
            May 4 – August 21, 2026{" "}
            <span className="status active">
              <i />
              Active
            </span>
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() => onNotify("Term settings coming soon")}
        >
          Manage term
        </button>
      </div>
      <div className="section-title">
        <div>
          <h2>Assessment overview</h2>
          <p>Marks submitted by teachers for review.</p>
        </div>
        <button className="filter-button">
          Term 2, 2026 <span>⌄</span>
        </button>
      </div>
      <div className="stat-grid three">
        <StatCard
          label="Marks submitted"
          value="1,284"
          change="156"
          note="this week"
          icon="▤"
          color="blue"
          detail="Across 8 classes"
        />
        <StatCard
          label="Awaiting approval"
          value="42"
          change="12"
          note="since yesterday"
          icon="◷"
          color="orange"
          detail="Needs your review"
        />
        <StatCard
          label="Approved results"
          value="96%"
          change="4.2%"
          note="vs. last term"
          icon="✓"
          color="green"
          detail="1,242 approved"
        />
      </div>
      <div className="panel simple-list review-list">
        <div className="panel-title">
          <div>
            <h3>Needs your review</h3>
            <p>Recent mark submissions from teachers</p>
          </div>
          <button
            className="text-button"
            onClick={() => onNotify("Review queue opened")}
          >
            Open review queue →
          </button>
        </div>
        {[
          [
            "David Kamau",
            "Science · Grade 8 East",
            "24 students · Submitted 10:42 AM",
          ],
          [
            "Lucy Njeri",
            "Mathematics · Grade 7 West",
            "28 students · Submitted yesterday",
          ],
          [
            "Peter Otieno",
            "English · Grade 6 North",
            "21 students · Submitted yesterday",
          ],
        ].map((row) => (
          <div className="review-row" key={row[0]}>
            <div className="avatar avatar-lilac">
              {row[0]
                .split(" ")
                .map((v) => v[0])
                .join("")}
            </div>
            <div className="simple-copy">
              <strong>{row[1]}</strong>
              <span>
                {row[0]} · {row[2]}
              </span>
            </div>
            <span className="status pending">
              <i />
              Pending
            </span>
            <button
              className="button secondary small"
              onClick={() => onNotify("Review screen coming soon")}
            >
              Review
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function FeesPage({ onNotify }) {
  return (
    <>
      <PageHeading
        eyebrow="SCHOOL FINANCE"
        title="Fees & payments"
        subtitle="Track fee collection, balances, and payment activity."
      >
        <Button
          variant="secondary"
          onClick={() => onNotify("Fee structure editor coming soon")}
        >
          Manage fee structures
        </Button>
        <Button
          icon="＋"
          onClick={() => onNotify("Record payment form coming soon")}
        >
          Record payment
        </Button>
      </PageHeading>
      <div className="stat-grid three">
        <StatCard
          label="Collected this term"
          value="KES 1.84M"
          change="8.2%"
          note="vs. last term"
          icon="◉"
          color="green"
          detail="72% of target"
        />
        <StatCard
          label="Outstanding balance"
          value="KES 712K"
          change="5.1%"
          note="less than last term"
          icon="◷"
          color="orange"
          detail="86 accounts due"
        />
        <StatCard
          label="Payments today"
          value="KES 46,500"
          change="12"
          note="transactions"
          icon="↙"
          color="blue"
          detail="Last payment 11:24 AM"
        />
      </div>
      <div className="dashboard-grid fee-grid">
        <section className="panel">
          <PanelTitle
            title="Collection trend"
            subtitle="Fees collected over the last 6 months"
            action="Download"
            onClick={() => onNotify("Download ready soon")}
          />
          <div className="bar-chart">
            <div className="chart-labels">
              <span>400k</span>
              <span>300k</span>
              <span>200k</span>
              <span>100k</span>
              <span>0</span>
            </div>
            <div className="bars">
              {[
                ["Mar", 49],
                ["Apr", 62],
                ["May", 55],
                ["Jun", 82],
                ["Jul", 68],
                ["Aug", 92],
              ].map(([month, height]) => (
                <div className="bar-column" key={month}>
                  <div className="bar" style={{ height: `${height}%` }} />
                  <span>{month}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="panel">
          <PanelTitle
            title="Collection by class"
            subtitle="Term 2, 2026"
            action="View all"
            onClick={() => onNotify("Class collection details coming soon")}
          />
          <div className="class-collection">
            {[
              ["Grade 8 East", "82%"],
              ["Grade 7 West", "74%"],
              ["Grade 6 North", "61%"],
              ["Grade 5 South", "54%"],
            ].map(([name, value]) => (
              <div key={name}>
                <div>
                  <span>{name}</span>
                  <strong>{value}</strong>
                </div>
                <div className="mini-progress">
                  <span style={{ width: value }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="info-note">
        <span>✦</span> Student fee balances and payment history are available
        from the Students directory.
      </div>
    </>
  );
}

function ReportsPage({ onNotify }) {
  return (
    <>
      <PageHeading
        eyebrow="INSIGHTS & EXPORTS"
        title="School reports"
        subtitle="A clear picture of academic progress, attendance, and finances."
      >
        <Button
          icon="⇩"
          onClick={() => onNotify("Your report is being prepared")}
        >
          Download report
        </Button>
      </PageHeading>
      <div className="report-grid">
        {[
          [
            "◷",
            "Attendance report",
            "Daily attendance by class and date",
            "94.6%",
            "Average today",
            "blue",
          ],
          [
            "▤",
            "Academic performance",
            "Marks and results by term",
            "B+",
            "School average",
            "violet",
          ],
          [
            "◉",
            "Fee collection",
            "Collected and outstanding fees",
            "72%",
            "Term target reached",
            "green",
          ],
          [
            "♙",
            "Student enrolment",
            "Enrolment by class and status",
            "248",
            "Active students",
            "orange",
          ],
        ].map(([icon, title, desc, value, label, color]) => (
          <button
            className="report-card"
            key={title}
            onClick={() => onNotify(`${title} report opened`)}
          >
            <span className={`stat-icon ${color}`}>{icon}</span>
            <h3>
              {title}
              <span>↗</span>
            </h3>
            <p>{desc}</p>
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="panel report-callout">
        <div className="help-icon">✦</div>
        <div>
          <strong>Need a custom report?</strong>
          <p>
            Choose the fields you need and download a spreadsheet for your
            records.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => onNotify("Custom report builder coming soon")}
        >
          Build a report
        </Button>
      </div>
    </>
  );
}

function TeacherDashboard({ onOpen }) {
  return (
    <>
      <PageHeading
        eyebrow="MONDAY, 19 OCTOBER 2026"
        title="Good morning, David ☀️"
        subtitle="Here’s your teaching day at a glance."
      >
        <button className="button date-button">
          ▦ &nbsp;Today<span>⌄</span>
        </button>
      </PageHeading>
      <div className="welcome-strip teacher-welcome">
        <div className="welcome-icon">✦</div>
        <div>
          <strong>You have one class to get ready for</strong>
          <p>
            Grade 8 East · Science starts at <b>10:30 AM</b>.
          </p>
        </div>
        <button onClick={() => onOpen("My classes")}>
          View my schedule <span>→</span>
        </button>
        <span className="strip-close">×</span>
      </div>
      <div className="stat-grid">
        <StatCard
          label="My classes"
          value="4"
          change="2"
          note="grade levels"
          icon="▦"
          color="blue"
          detail="Across 3 subjects"
        />
        <StatCard
          label="My students"
          value="86"
          change="3"
          note="new this term"
          icon="♙"
          color="violet"
          detail="In your classes"
        />
        <StatCard
          label="Marks to review"
          value="24"
          change="8"
          note="this week"
          icon="▤"
          color="orange"
          detail="2 classes pending"
        />
        <StatCard
          label="Next class"
          value="10:30"
          change="AM"
          note="in 45 minutes"
          icon="◷"
          color="green"
          detail="Science · Grade 8 East"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <PanelTitle
            title="Today’s schedule"
            subtitle="Monday, October 19"
            action="My classes"
            onClick={() => onOpen("My classes")}
          />
          <div className="schedule-list">
            <Schedule
              time="8:00"
              subject="Mathematics"
              room="Grade 7 West · Room 12"
              color="blue"
            />
            <Schedule
              time="10:30"
              subject="Science"
              room="Grade 8 East · Lab 2"
              color="violet"
              active
            />
            <Schedule
              time="1:30"
              subject="Science"
              room="Grade 6 North · Room 08"
              color="green"
            />
          </div>
        </section>
        <section className="panel">
          <PanelTitle
            title="To do"
            subtitle="Things that need your attention"
            action="Gradebook"
            onClick={() => onOpen("Gradebook")}
          />
          <div className="todo-list">
            <button onClick={() => onOpen("Gradebook")}>
              <span className="todo-check" />
              <span>
                <strong>Submit Term 2 marks</strong>
                <small>Science · Grade 8 East</small>
              </span>
              <b>Due today</b>
            </button>
            <button onClick={() => onOpen("Gradebook")}>
              <span className="todo-check" />
              <span>
                <strong>Review class assessment</strong>
                <small>Mathematics · Grade 7 West</small>
              </span>
              <b className="due-muted">Due Wed</b>
            </button>
            <button onClick={() => onOpen("Students")}>
              <span className="todo-check checked">✓</span>
              <span>
                <strong>Take morning attendance</strong>
                <small>Grade 7 West</small>
              </span>
              <b className="done-tag">Done</b>
            </button>
          </div>
        </section>
      </div>
      <div className="section-title lower-title">
        <div>
          <h2>Recent student activity</h2>
          <p>Updates from your assigned classes.</p>
        </div>
        <Button variant="secondary" onClick={() => onOpen("Students")}>
          View students →
        </Button>
      </div>
      <div className="panel activity-panel">
        <div className="activity-list">
          <Activity
            color="green"
            icon="✓"
            title="Assessment completed"
            detail="Grade 8 East · Science quiz"
            time="9:12 AM"
          />
          <Activity
            color="blue"
            icon="♙"
            title="New student joined your class"
            detail="Noah Kiptoo · Grade 6 North"
            time="Yesterday"
          />
          <Activity
            color="orange"
            icon="◷"
            title="Marks are due soon"
            detail="Term 2 · 2 class assessments"
            time="Today"
          />
        </div>
      </div>
    </>
  );
}

function Schedule({ time, subject, room, color, active }) {
  return (
    <div className={`schedule-row ${active ? "current" : ""}`}>
      <time>
        {time}
        <small>{time === "1:30" ? "PM" : "AM"}</small>
      </time>
      <div className={`schedule-line ${color}`} />
      <div>
        <strong>{subject}</strong>
        <span>{room}</span>
      </div>
      {active && <span className="now-tag">UP NEXT</span>}
    </div>
  );
}
function TeacherClasses() {
  return (
    <>
      <PageHeading
        eyebrow="YOUR TIMETABLE"
        title="My classes"
        subtitle="Your assigned classes, subjects, and teaching schedule."
      />
      <div className="class-card-grid">
        {[
          [
            "Grade 8 East",
            "Science",
            "24 students",
            "10:30 AM · Lab 2",
            "violet",
          ],
          [
            "Grade 7 West",
            "Mathematics",
            "28 students",
            "8:00 AM · Room 12",
            "blue",
          ],
          [
            "Grade 6 North",
            "Science",
            "21 students",
            "1:30 PM · Room 08",
            "green",
          ],
          [
            "Grade 8 East",
            "Mathematics",
            "24 students",
            "Wed · 9:00 AM · Room 12",
            "orange",
          ],
        ].map(([name, subject, count, time, color]) => (
          <div className="class-card" key={name + subject}>
            <div className={`class-card-icon ${color}`}>▦</div>
            <span className="status active">
              <i />
              Assigned
            </span>
            <h3>{name}</h3>
            <p>{subject}</p>
            <div className="class-card-meta">
              <span>♙ &nbsp;{count}</span>
              <span>◷ &nbsp;{time}</span>
            </div>
            <button>
              Open class <span>→</span>
            </button>
          </div>
        ))}
      </div>
      <div className="info-note">
        <span>✦</span> Your classes are assigned by your school administrator.
      </div>
    </>
  );
}
function StudentDashboard({ onOpen }) {
  return (
    <>
      <PageHeading
        eyebrow="MONDAY, 19 OCTOBER 2026"
        title="Habari, Amara 👋"
        subtitle="Welcome back! Here’s your school progress this term."
      >
        <button className="button date-button">
          Term 2, 2026 <span>⌄</span>
        </button>
      </PageHeading>
      <div className="student-hero">
        <div className="hero-copy">
          <span className="hero-tag">TERM 2 · 2026</span>
          <h2>You’re doing great, Amara!</h2>
          <p>
            Keep up the good work. You’re making wonderful progress this term.
          </p>
          <button onClick={() => onOpen("My results")}>
            View my results <span>→</span>
          </button>
        </div>
        <div className="hero-art">
          <div className="art-sun" />
          <div className="art-book">✦</div>
          <div className="art-star s1">✦</div>
          <div className="art-star s2">✧</div>
          <div className="art-plant">♣</div>
        </div>
      </div>
      <div className="section-title">
        <div>
          <h2>My overview</h2>
          <p>Your learning and school account at a glance.</p>
        </div>
      </div>
      <div className="stat-grid">
        <StatCard
          label="My average"
          value="B+"
          change="4.2%"
          note="since last term"
          icon="▤"
          color="violet"
          detail="Across 6 subjects"
        />
        <StatCard
          label="Attendance"
          value="96%"
          change="2 days"
          note="absent this term"
          icon="◷"
          color="green"
          detail="Great attendance!"
        />
        <StatCard
          label="Fee balance"
          value="KES 4,500"
          change="Due Aug 15"
          note="next payment"
          icon="◉"
          color="orange"
          detail="View payment details"
        />
        <StatCard
          label="My subjects"
          value="6"
          change="2"
          note="assessments soon"
          icon="▦"
          color="blue"
          detail="See my timetable"
        />
      </div>
      <div className="dashboard-grid student-grid">
        <section className="panel">
          <PanelTitle
            title="Recent results"
            subtitle="Your latest approved marks"
            action="All results"
            onClick={() => onOpen("My results")}
          />
          <div className="result-list">
            {[
              ["Mathematics", "Quiz 2 · Oct 16", "87", "B+", "blue"],
              ["Science", "Class test · Oct 14", "92", "A", "green"],
              ["English", "Composition · Oct 10", "78", "B", "violet"],
            ].map(([subject, assessment, score, grade, color]) => (
              <div className="result-row" key={subject}>
                <span className={`subject-icon ${color}`}>▤</span>
                <div>
                  <strong>{subject}</strong>
                  <small>{assessment}</small>
                </div>
                <strong className="score">
                  {score}
                  <small>/100</small>
                </strong>
                <span className={`grade ${color}`}>{grade}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <PanelTitle
            title="Coming up"
            subtitle="Your next school dates"
            action="View calendar"
            onClick={() => onOpen("My profile")}
          />
          <div className="coming-list">
            <div>
              <time>
                <b>22</b>
                <small>OCT</small>
              </time>
              <span>
                <strong>Science practical</strong>
                <small>Science · Lab 2</small>
              </span>
            </div>
            <div>
              <time>
                <b>28</b>
                <small>OCT</small>
              </time>
              <span>
                <strong>Mathematics assessment</strong>
                <small>Mathematics · Room 12</small>
              </span>
            </div>
            <div>
              <time>
                <b>04</b>
                <small>NOV</small>
              </time>
              <span>
                <strong>School sports day</strong>
                <small>All classes · School field</small>
              </span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function StudentResults() {
  return (
    <>
      <PageHeading
        eyebrow="ACADEMIC PROGRESS"
        title="My results"
        subtitle="Your approved marks and progress across all subjects."
      >
        <button className="filter-button">
          Term 2, 2026 <span>⌄</span>
        </button>
      </PageHeading>
      <div className="results-summary">
        <div>
          <span>TERM AVERAGE</span>
          <strong>B+</strong>
          <small>84.2% across 6 subjects</small>
        </div>
        <div>
          <span>CLASS POSITION</span>
          <strong>
            08<small> / 24</small>
          </strong>
          <small>↑ 3 places this term</small>
        </div>
        <div>
          <span>APPROVED RESULTS</span>
          <strong>
            12<small> / 14</small>
          </strong>
          <small>2 results pending</small>
        </div>
        <div className="summary-spark">
          <span>✦</span>
          <strong>Keep it up!</strong>
          <small>You’re improving every term.</small>
        </div>
      </div>
      <div className="panel">
        <div className="panel-title">
          <div>
            <h3>Subject results</h3>
            <p>Marks approved by your school</p>
          </div>
          <button className="filter-button">All subjects⌄</button>
        </div>
        <div className="results-table">
          <div className="result-header">
            <span>SUBJECT</span>
            <span>ASSESSMENT</span>
            <span>DATE</span>
            <span>SCORE</span>
            <span>GRADE</span>
            <span>STATUS</span>
          </div>
          {[
            ["Mathematics", "Quiz 2", "Oct 16", "87 / 100", "B+"],
            ["Science", "Class test", "Oct 14", "92 / 100", "A"],
            ["English", "Composition", "Oct 10", "78 / 100", "B"],
            ["Kiswahili", "Oral assessment", "Oct 08", "84 / 100", "B+"],
            ["Social Studies", "Map skills", "Oct 03", "81 / 100", "B+"],
          ].map((row) => (
            <div className="result-table-row" key={row[0]}>
              {row.map((cell) => (
                <span key={cell}>{cell}</span>
              ))}
              <span className="status active">
                <i />
                Approved
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="info-note">
        <span>✦</span> Only results approved by your teacher are shown here.
      </div>
    </>
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
            5000,
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
    setBusy(true);
    setError("");
    try {
      const result = await apiPost("/me/payments", {
        studentFeeAccountId: rowValue(selected, "id", "ID"),
        amount,
        method: "mpesa",
        phoneNumber,
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
        <div className="admin-loading">Loading fee account…</div>
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
                        {cash(rowValue(account, "amountPaid", "AmountPaid"))}
                      </span>
                      <strong>
                        Total{" "}
                        {cash(rowValue(account, "amountDue", "AmountDue"))}
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
                        {cash(rowValue(payment, "amount", "Amount"))} ·{" "}
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
              ×
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
                {busy ? "Sending prompt…" : "Send STK prompt"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
function StudentProfile({ onNotify }) {
  const [changing, setChanging] = useState(false);
  return (
    <>
      <PageHeading
        eyebrow="MY ACCOUNT"
        title="My profile"
        subtitle="Your student details and account settings."
      >
        <Button
          variant="secondary"
          onClick={() => onNotify("Profile editing is not enabled yet")}
        >
          Edit profile
        </Button>
      </PageHeading>
      <div className="profile-layout">
        <section className="panel student-profile-card">
          <div className="student-profile-head">
            <div className="avatar avatar-peach large-avatar">AW</div>
            <div>
              <h2>Amara Wanjiku</h2>
              <span className="status active">
                <i />
                Active student
              </span>
            </div>
          </div>
          <div className="profile-details">
            {[
              ["Admission number", "ADM-2026-0001"],
              ["Class", "Grade 8 East"],
              ["School year", "2026"],
              ["Parent / guardian", "+254 722 345 678"],
              [
                "Subjects",
                "Mathematics, Science, English, Kiswahili, Social Studies, CRE",
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel account-security">
          <h3>Account security</h3>
          <p>Keep your account secure by using a password only you know.</p>
          <div className="security-row">
            <span className="security-icon">♧</span>
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
            <span>✦</span>
            <p>
              If you forget your password, ask the school administrator to reset
              it. Your school records will stay safe.
            </p>
          </div>
        </section>
      </div>
      <div className="info-note">
        <span>✦</span> Some profile details can only be updated by your school
        administrator.
      </div>
      {changing && (
        <ChangePasswordDialog
          onClose={() => setChanging(false)}
          onNotify={onNotify}
        />
      )}
    </>
  );
}

function ChangePasswordDialog({ onClose, onNotify }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") || "");
    if (newPassword !== form.get("confirmPassword")) {
      setError("The new passwords do not match.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiPut("/me/password", {
        currentPassword: form.get("currentPassword"),
        newPassword,
      });
      onClose();
      onNotify("Password updated");
    } catch (saveError) {
      setError(saveError.message || "Could not update password.");
    } finally {
      setSaving(false);
    }
  }
  const [showCurrent, setShowCurrent] = useState(false);
const [showNew, setShowNew] = useState(false);
const [showConfirm, setShowConfirm] = useState(false);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form className="modal" onSubmit={submit}>
        <button type="button" className="modal-close" onClick={onClose}>
          ×
        </button>
        <h2>Change password</h2>
        <p>Choose a new password for your student account.</p>
        <label className="field-label">Current password</label>
<div className="password-field">
  <input
    className="form-input"
    name="currentPassword"
    type={showCurrent ? "text" : "password"}
    required
    autoComplete="current-password"
  />
  <button
    type="button"
    className="password-toggle"
    onClick={() => setShowCurrent(!showCurrent)}
  >
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
    minLength={8}
    autoComplete="new-password"
  />
  <button
    type="button"
    className="password-toggle"
    onClick={() => setShowNew(!showNew)}
  >
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
    minLength={8}
    autoComplete="new-password"
  />
  <button
    type="button"
    className="password-toggle"
    onClick={() => setShowConfirm(!showConfirm)}
  >
    {showConfirm ? "Hide" : "Show"}
  </button>
</div>
        {error && <div className="login-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? "Saving…" : "Update password"}
          </button>
        </div>
      </form>
    </div>
  );
}

function LoginScreen({
  onLogin,
  showPassword,
  setShowPassword,
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
      setError(
        loginError.message ||
          "Unable to sign in. Check your details and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-side">
        <div className="brand">
          <div className="brand-mark">
            <span>✳</span>
          </div>
          <div>
            <strong>Northstar</strong>
            <small>ACADEMY</small>
          </div>
        </div>
        <div className="login-art">
          <div className="login-orbit orbit-one" />
          <div className="login-orbit orbit-two" />
          <div className="login-sun">✳</div>
          <div className="login-book">N</div>
          <span className="login-plant">♣</span>
          <span className="login-spark">✦</span>
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
          © 2026 Northstar Academy · Nairobi, Kenya
        </small>
      </div>
      <div className="login-form-side">
        <div className="login-top">Northstar Academy</div>
        <form className="login-form" onSubmit={submit}>
          <div className="eyebrow">WELCOME BACK</div>
          <h1>Sign in to your account</h1>
          <p>Enter your details to access your school workspace.</p>
          <label className="field-label" htmlFor="username">
            Username
          </label>
          <input
            name="username"
            className="form-input"
            id="username"
            autoComplete="username"
            placeholder="Username"
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
              Use the credentials provided by your school.
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
              "Signing in…"
            ) : (
              <>
                Sign in <span>→</span>
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
            {saving ? "Updating…" : "Update password"}
          </button>
          <button type="button" className="help-login" onClick={onLogout}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

function Modal({
  type,
  role,
  accountName,
  onClose,
  onStudentSave,
  onNotify,
  onRoleChange,
  onLogout,
}) {
  let title = "Account settings";
  let subtitle = "Manage your Northstar account.";
  if (type === "add-student") {
    title = "Add a student";
    subtitle = "Create a student record and assign a class.";
  }
  if (type === "reset-password") {
    title = "Reset student password";
    subtitle = "Choose a student account to restore its default password.";
  }
  if (type === "switch-role") {
    title = "Switch workspace";
    subtitle = "Preview the dashboard for each role.";
  }
  if (type === "add-teacher") {
    title = "Add a teacher";
    subtitle = "Create a staff profile and assign teaching subjects.";
  }
  if (type === "create-class") {
    title = "Create a class";
    subtitle = "Set up a class for the current school year.";
  }
  if (type === "account") {
    title = "Account settings";
    subtitle = "Manage your account preferences.";
  }
  if (type === "add-student")
    return (
      <div
        className="modal-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <form className="modal" onSubmit={onStudentSave}>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
          <div className="modal-icon">♙</div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
          <label className="field-label">Student’s full name</label>
          <input
            name="name"
            className="form-input"
            placeholder="e.g. Amara Wanjiku"
            required
          />
          <label className="field-label">Class</label>
          <select name="className" className="form-input">
            <option>Grade 8 East</option>
            <option>Grade 7 West</option>
            <option>Grade 6 North</option>
            <option>Grade 5 South</option>
          </select>
          <label className="field-label">Parent / guardian phone</label>
          <input className="form-input" placeholder="+254 7XX XXX XXX" />
          <div className="modal-note">
            A unique admission number and default password will be generated.
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="button primary" type="submit">
              Add student
            </button>
          </div>
        </form>
      </div>
    );
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <button type="button" className="modal-close" onClick={onClose}>
          ×
        </button>
        <div className="modal-icon">
          {type === "reset-password" ? "↻" : type === "switch-role" ? "♙" : "⚙"}
        </div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
        {type === "reset-password" ? (
          <>
            <label className="field-label">Student account</label>
            <select className="form-input">
              <option>Amara Wanjiku · ADM-2026-0001</option>
              <option>Brian Otieno · ADM-2026-0002</option>
              <option>Zara Hassan · ADM-2026-0003</option>
            </select>
            <div className="reset-warning">
              <b>↻</b>
              <span>
                This resets the password to the school default. Student records
                and results will not be affected.
              </span>
            </div>
            <div className="modal-note">
              The backend currently has no password reset endpoint. This preview
              does not change a real account password.
            </div>
            <div className="modal-actions">
              <button className="button secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="button primary"
                onClick={() => {
                  onNotify(
                    "Reset preview only · connect the password reset API to apply this change",
                  );
                  onClose();
                }}
              >
                Reset password
              </button>
            </div>
          </>
        ) : type === "switch-role" ? (
          <div className="switch-role-list">
            {[
              ["admin", "Administrator", "School management and finance"],
              ["teacher", "Teacher", "Classes, marks, and students"],
              ["student", "Student", "Results, fees, and profile"],
            ].map(([value, label, detail]) => (
              <button
                key={value}
                className={role === value ? "current" : ""}
                onClick={() => {
                  onRoleChange(value);
                  onClose();
                }}
              >
                <span className={`role-dot ${value}`} />
                <span>
                  <b>{label}</b>
                  <small>{detail}</small>
                </span>
                {role === value && <strong>Current</strong>}
              </button>
            ))}
          </div>
        ) : type === "add-teacher" || type === "create-class" ? (
          <>
            <label className="field-label">
              {type === "add-teacher" ? "Full name" : "Class name"}
            </label>
            <input
              className="form-input"
              placeholder={
                type === "add-teacher"
                  ? "e.g. Mercy Wambui"
                  : "e.g. Grade 5 South"
              }
            />
            <label className="field-label">
              {type === "add-teacher" ? "Phone number" : "School year"}
            </label>
            <input
              className="form-input"
              placeholder={type === "add-teacher" ? "+254 7XX XXX XXX" : "2026"}
            />
            <div className="modal-note">
              This action is a preview until connected to the school API.
            </div>
            <div className="modal-actions">
              <button className="button secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="button primary"
                onClick={() => {
                  onNotify("Connect the school API to save this record");
                  onClose();
                }}
              >
                Save
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="account-modal-user">
              <div className="avatar avatar-blue">
                {role === "admin" ? "AD" : role === "teacher" ? "DK" : "AW"}
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
                onNotify("Password change requires a backend endpoint");
              }}
            >
              Change password
            </button>
            <button
              className="button secondary modal-wide"
              onClick={() => {
                onClose();
                onLogout();
              }}
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
