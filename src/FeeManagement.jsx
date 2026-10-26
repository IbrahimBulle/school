import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "./api";

const get = (row, ...keys) => {
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
const list = (value) => (Array.isArray(value) ? value : []);
const id = (row) => get(row, "id", "ID");
const money = (value) => `KES ${Number(value || 0).toLocaleString("en-KE")}`;

export default function FeeManagement({ onNotify }) {
  const [templates, setTemplates] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [items, setItems] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [revision, setRevision] = useState(0);
  const [paymentRefresh, setPaymentRefresh] = useState(0);
  const visiblePayments = payments.filter((payment) => {
    const status = String(get(payment, "status", "Status")).toLowerCase();
    if (status === "completed") return true;
    if (status !== "pending") return false;
    const created = new Date(get(payment, "createdAt", "CreatedAt")).getTime();
    return Number.isFinite(created) && Date.now() - created < 60 * 60 * 1000;
  });

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const [templateData, classData, studentData] = await Promise.all([
        apiGet("/fee-templates"),
        apiGet("/classes"),
        apiGet("/students"),
      ]);
      setTemplates(list(templateData));
      setClasses(list(classData));
      setStudents(list(studentData));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, [revision]);

  useEffect(() => {
    if (!selectedTemplate) {
      setItems([]);
      return;
    }
    let current = true;
    apiGet(`/fee-templates/${selectedTemplate}/items`)
      .then((result) => {
        if (current) setItems(list(result));
      })
      .catch((loadError) => {
        if (current) setError(loadError.message);
      });
    return () => {
      current = false;
    };
  }, [selectedTemplate, revision]);

  useEffect(() => {
    if (!selectedStudent) {
      setInvoices([]);
      setPayments([]);
      return;
    }
    let current = true;
    setInvoices([]);
    setPayments([]);
    apiGet(`/students/${selectedStudent}/invoices`)
      .then((invoiceData) => {
        if (current) setInvoices(list(invoiceData));
      })
      .catch((loadError) => {
        if (current) setError(loadError.message);
      });
    return () => {
      current = false;
    };
  }, [selectedStudent, revision]);

  useEffect(() => {
    if (!selectedStudent) return;
    let current = true;
    let timer;
    apiGet(`/students/${selectedStudent}/payments`).then((paymentData) => {
      if (!current) return;
      const records = list(paymentData);
      setPayments(records);
      const hasCurrentPending = records.some((payment) => {
        if (String(get(payment, "status", "Status")).toLowerCase() !== "pending") return false;
        const created = new Date(get(payment, "createdAt", "CreatedAt")).getTime();
        return Number.isFinite(created) && Date.now() - created < 60 * 60 * 1000;
      });
      if (hasCurrentPending) timer = window.setTimeout(() => setPaymentRefresh((n) => n + 1), 15000);
    }).catch((loadError) => {
      if (current) setError(loadError.message);
    });
    return () => {
      current = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [selectedStudent, paymentRefresh]);

  async function save(event) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    const form = new FormData(event.currentTarget);
    const value = (key) => String(form.get(key) || "").trim();
    setBusy(true);
    setError("");
    try {
      if (dialog.type === "template") {
        const body = {
          name: value("name"),
          classId: value("classId"),
          active: true,
        };
        if (dialog.record)
          await apiPut(`/fee-templates/${dialog.record.id}`, body);
        else await apiPost("/fee-templates", body);
        setDialog(null);
        onNotify(
          dialog.record ? "Fee template updated" : "Fee template created",
        );
      } else if (dialog.type === "item") {
        const body = {
          code: value("code"),
          description: value("description"),
          amount: value("amount"),
        };
        if (dialog.record)
          await apiPut(`/fee-template-items/${dialog.record.id}`, body);
        else await apiPost(`/fee-templates/${selectedTemplate}/items`, body);
        setDialog(null);
        onNotify(
          dialog.record ? "Template item updated" : "Template item added",
        );
      } else if (dialog.type === "payment") {
        const method = value("method");
        const result = await apiPost("/payments/admin", {
          studentFeeAccountId: value("accountId"),
          amount: value("amount"),
          method,
          transactionReference: value("reference"),
          phoneNumber: value("phoneNumber"),
        });
        setDialog(null);
        onNotify(
          method === "mpesa"
            ? get(result, "customerMessage", "message") ||
                "M-Pesa STK prompt sent. Complete it on the phone."
            : "Payment recorded",
        );
      }
      setPaymentRefresh((n) => n + 1);
      setRevision((n) => n + 1);
    } catch (saveError) {
      setError(saveError.message);
      onNotify(saveError.message || "Could not save the fee record.", "error");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function issueInvoices() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await apiPost("/fees/invoices/issue-active-term", {});
      onNotify(
        `${get(result, "created", "Created") || 0} invoices issued for the active term`,
      );
      setRevision((n) => n + 1);
    } catch (issueError) {
      setError(issueError.message);
      onNotify(issueError.message || "Could not issue invoices.", "error");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function resetTemplate(template) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const next = !Boolean(get(template, "active", "Active"));
    try {
      await apiPut(`/fee-templates/${id(template)}`, {
        name: get(template, "name", "Name"),
        classId: get(template, "classId", "ClassID"),
        active: next,
      });
      onNotify(next ? "Template activated" : "Template paused");
      setRevision((n) => n + 1);
    } catch (actionError) {
      setError(actionError.message);
      onNotify(actionError.message || "Could not update the fee template.", "error");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function removeTemplateItem(item) {
    if (
      !window.confirm(
        `Remove ${get(item, "description", "Description")} from this template? Existing invoices keep their saved copies.`,
      )
    )
      return;
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await apiDelete(`/fee-template-items/${id(item)}`);
      onNotify("Template item removed; existing invoices are unchanged");
      setRevision((n) => n + 1);
    } catch (actionError) {
      setError(actionError.message);
      onNotify(actionError.message || "Could not remove the fee item.", "error");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const template = templates.find(
    (entry) => String(id(entry)) === String(selectedTemplate),
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">FEES & BILLING</div>
          <h1>Fee templates & invoices</h1>
          <p>
            Set a reusable fee plan by class, then issue term invoices with a
            saved copy of each charge.
          </p>
        </div>
        <div className="heading-actions">
          <button
            className="button secondary"
            onClick={issueInvoices}
            disabled={busy}
          >
            Issue active term invoices
          </button>
          <button
            className="button primary"
            onClick={() => setDialog({ type: "template" })}
          >
            ＋ New fee template
          </button>
        </div>
      </div>
      {error && (
        <div className="admin-notice error">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {loading ? (
        <div className="admin-loading">Loading billing records…</div>
      ) : (
        <>
          <div className="fee-model-note">
            <span>✦</span>
            <div>
              <strong>Templates can change; issued invoices stay fixed.</strong>
              <p>
                Student enrolment creates an invoice for the active term. When a
                term closes, the next term is billed automatically from the
                current class template.
              </p>
            </div>
          </div>
          <div className="fee-template-grid">
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h3>Class fee templates</h3>
                  <p>{templates.length} reusable plans</p>
                </div>
              </div>
              <div className="admin-list">
                {templates.map((entry, index) => (
                  <div
                    className={`fee-template-row ${String(selectedTemplate) === String(id(entry)) ? "selected" : ""}`}
                    key={
                      id(entry) ||
                      `template-${get(entry, "classId", "ClassID")}-${index}`
                    }
                  >
                    <button
                      className="fee-template-select"
                      onClick={() => setSelectedTemplate(id(entry))}
                    >
                      <strong>{get(entry, "name", "Name")}</strong>
                      <small>
                        {get(entry, "className", "ClassName")} ·{" "}
                        {Boolean(get(entry, "active", "Active"))
                          ? "Active"
                          : "Paused"}
                      </small>
                    </button>
                    <button
                      className="button secondary small"
                      onClick={() =>
                        setDialog({
                          type: "template",
                          record: {
                            id: id(entry),
                            name: get(entry, "name", "Name"),
                            classId: get(entry, "classId", "ClassID"),
                          },
                        })
                      }
                    >
                      Edit
                    </button>
                    <button
                      className="button secondary small"
                      onClick={() => resetTemplate(entry)}
                    >
                      {Boolean(get(entry, "active", "Active"))
                        ? "Pause"
                        : "Activate"}
                    </button>
                  </div>
                ))}
                {!templates.length && (
                  <p className="empty-state">
                    No templates yet. Create a class template to start issuing
                    invoices.
                  </p>
                )}
              </div>
            </section>
            <section className="panel">
              <div className="panel-title">
                <div>
                  <h3>
                    {template
                      ? `${get(template, "name", "Name")} · items`
                      : "Template items"}
                  </h3>
                  <p>These charges are copied into an invoice when issued.</p>
                </div>
                {template && (
                  <button
                    className="button secondary small"
                    onClick={() => setDialog({ type: "item" })}
                  >
                    ＋ Add charge
                  </button>
                )}
              </div>
              {!template ? (
                <p className="empty-state">
                  Select a template to manage its charges.
                </p>
              ) : (
                <div className="admin-list">
                  {items.map((item, index) => (
                    <div
                      key={
                        id(item) || `item-${get(item, "code", "Code")}-${index}`
                      }
                    >
                      <span>
                        <strong>
                          {get(item, "code", "Code")} ·{" "}
                          {get(item, "description", "Description")}
                        </strong>
                        <small>{money(get(item, "amount", "Amount"))}</small>
                      </span>
                      <button
                        className="button secondary small"
                        onClick={() =>
                          setDialog({
                            type: "item",
                            record: {
                              id: id(item),
                              code: get(item, "code", "Code"),
                              description: get(
                                item,
                                "description",
                                "Description",
                              ),
                              amount: get(item, "amount", "Amount"),
                            },
                          })
                        }
                      >
                        Edit
                      </button>
                      <button
                        className="row-menu"
                        onClick={() => removeTemplateItem(item)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {!items.length && (
                    <p className="empty-state">
                      No charges in this template. Add the first fee item.
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>
          <section className="panel invoice-section">
            <div className="panel-title">
              <div>
                <h3>Student invoices & payments</h3>
                <p>
                  Invoices are term-specific snapshots. Payments remain attached
                  to their original invoice.
                </p>
              </div>
              <select
                id="fee-management-student"
                name="studentId"
                className="filter-button"
                value={selectedStudent}
                onChange={(event) => setSelectedStudent(event.target.value)}
              >
                <option value="">Select student</option>
                {students.map((student, index) => (
                  <option
                    value={id(student)}
                    key={
                      id(student) ||
                      `student-${get(student, "admissionNumber", "AdmissionNumber")}-${index}`
                    }
                  >
                    {get(student, "studentName", "StudentName")} ·{" "}
                    {get(student, "admissionNumber", "AdmissionNumber")}
                  </option>
                ))}
              </select>
            </div>
            {selectedStudent && (
              <>
                <div className="invoice-list">
                  {invoices.map((invoice, index) => (
                    <article
                      className="invoice-card"
                      key={
                        id(invoice) ||
                        `invoice-${get(invoice, "invoiceNumber", "InvoiceNumber")}-${index}`
                      }
                    >
                      <div className="invoice-top">
                        <div>
                          <strong>
                            {get(invoice, "invoiceNumber", "InvoiceNumber")}
                          </strong>
                          <span>
                            {get(invoice, "termName", "TermName")} ·{" "}
                            {get(invoice, "className", "ClassName")}
                          </span>
                        </div>
                        <b>{money(get(invoice, "amountDue", "AmountDue"))}</b>
                      </div>
                      <div className="invoice-line-items">
                        {list(get(invoice, "items", "Items")).map(
                          (line, lineIndex) => (
                            <div
                              key={
                                id(line) ||
                                `line-${get(line, "code", "Code")}-${get(line, "description", "Description")}-${lineIndex}`
                              }
                            >
                              <span>
                                {get(line, "code", "Code")} ·{" "}
                                {get(line, "description", "Description")}
                              </span>
                              <b>{money(get(line, "amount", "Amount"))}</b>
                            </div>
                          ),
                        )}
                        {!list(get(invoice, "items", "Items")).length && (
                          <small>
                            No fee items were configured when this invoice was
                            issued.
                          </small>
                        )}
                      </div>
                      <div className="invoice-summary">
                        <span>
                          Paid {money(get(invoice, "amountPaid", "AmountPaid"))}
                        </span>
                        <strong>
                          Balance {money(get(invoice, "balance", "Balance"))}
                        </strong>
                        <button
                          className="button secondary small"
                          onClick={() =>
                            setDialog({
                              type: "payment",
                              invoiceId: id(invoice),
                              balance: get(invoice, "balance", "Balance"),
                            })
                          }
                        >
                          Record payment
                        </button>
                      </div>
                    </article>
                  ))}
                  {!invoices.length && (
                    <p className="empty-state">
                      No invoices for this student yet.
                    </p>
                  )}
                </div>
                <div className="payment-history">
                  <h4>Payment history</h4>
                  {visiblePayments.map((payment, index) => (
                    <div
                      key={
                        id(payment) ||
                        `payment-${get(payment, "transactionReference", "TransactionReference")}-${get(payment, "createdAt", "CreatedAt")}-${index}`
                      }
                    >
                      <span>
                        <strong>
                          {money(get(payment, "amount", "Amount"))}
                        </strong>
                        <small>
                          {get(payment, "method", "Method")} ·{" "}
                          {get(
                            payment,
                            "transactionReference",
                            "TransactionReference",
                          ) || "No reference"}
                        </small>
                      </span>
                      <span>{get(payment, "status", "Status")}</span>
                      <small>
                        {String(get(payment, "createdAt", "CreatedAt")).slice(
                          0,
                          10,
                        )}
                      </small>
                    </div>
                  ))}
                  {!visiblePayments.length && <p>No successful or active payment attempts.</p>}
                </div>
              </>
            )}
          </section>
        </>
      )}
      {dialog && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDialog(null);
          }}
        >
          <form className="modal admin-modal" onSubmit={save}>
            <button
              type="button"
              className="modal-close"
              onClick={() => setDialog(null)}
            >
              ×
            </button>
            <div className="modal-icon">
              {dialog.type === "payment" ? "◉" : "＋"}
            </div>
            <h2>
              {dialog.type === "template"
                ? dialog.record
                  ? "Edit fee template"
                  : "New class fee template"
                : dialog.type === "item"
                  ? dialog.record
                    ? "Edit fee item"
                    : "Add template item"
                  : "Record payment"}
            </h2>
            <p>
              {dialog.type === "payment"
                ? "Record the payment against this issued invoice."
                : "Template changes apply to future invoices only."}
            </p>
            {dialog.type === "template" && (
              <>
                <label className="admin-field">
                  Template name
                  <input
                    name="name"
                    required
                    defaultValue={dialog.record?.name || ""}
                    placeholder="Grade 7 annual fee plan"
                  />
                </label>
                <label className="admin-field">
                  Class / grade
                  <select
                    name="classId"
                    defaultValue={dialog.record?.classId || ""}
                    required
                  >
                    <option value="" disabled>
                      Select a class
                    </option>
                    {classes.map((item, index) => (
                      <option
                        key={
                          id(item) ||
                          `class-${get(item, "name", "Name")}-${index}`
                        }
                        value={id(item)}
                      >
                        {get(item, "name", "Name")}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {dialog.type === "item" && (
              <>
                <label className="admin-field">
                  Code
                  <input
                    name="code"
                    required
                    defaultValue={dialog.record?.code || ""}
                    placeholder="TUITION"
                  />
                </label>
                <label className="admin-field">
                  Description
                  <input
                    name="description"
                    required
                    defaultValue={dialog.record?.description || ""}
                    placeholder="Tuition fee"
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
                    defaultValue={dialog.record?.amount || ""}
                  />
                </label>
              </>
            )}
            {dialog.type === "payment" && (
              <>
                <label className="admin-field">
                  Invoice
                  <input id="fee-payment-invoice" name="invoiceDisplay" value={dialog.invoiceId} readOnly />
                </label>
                <label className="admin-field">
                  Outstanding balance
                  <input id="fee-payment-balance" name="balanceDisplay" value={money(dialog.balance)} readOnly />
                </label>
                <input
                  type="hidden"
                  name="accountId"
                  value={dialog.invoiceId}
                />
                <label className="admin-field">
                  Payment amount (whole KES for M-Pesa)
                  <input
                    name="amount"
                    type="number"
                    min="1"
                    max={dialog.balance}
                    step="1"
                    required
                  />
                </label>
                <label className="admin-field">
                  Method
                  <select name="method">
                    <option value="cash">Cash</option>
                    <option value="mpesa">M-Pesa STK prompt</option>
                    <option value="bank">Bank</option>
                  </select>
                </label>
                <label className="admin-field">
                  Transaction reference
                  <input name="reference" />
                </label>
                <label className="admin-field">
                  Phone number
                  <input name="phoneNumber" placeholder="0712345678" />
                  <small>
                    Required for M-Pesa. The payer must approve the prompt on
                    their phone.
                  </small>
                </label>
              </>
            )}
            {error && <div className="modal-note error-text">{error}</div>}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setDialog(null)}
              >
                Cancel
              </button>
              <button className="button primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
