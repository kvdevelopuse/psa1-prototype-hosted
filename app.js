(() => {
  "use strict";

  const STORAGE_KEY = "psa-prototype-test-records-v1";
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const ALLOWED_FILE_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
  const records = loadRecords();
  const files = new Map();
  const fileErrors = new Map();
  let signedIn = false;
  let submitting = false;
  let toastTimer;

  const programmeLabels = {
    weekday: "Weekday Batch",
    weekend: "Weekend Batch"
  };

  const fieldGroups = [
    {
      title: "Programme",
      fields: [["programme", "Batch option"]]
    },
    {
      title: "Player information",
      fields: [
        ["fullName", "Full name"], ["nickname", "Nickname"], ["gender", "Gender"], ["age", "Age"],
        ["dateOfBirth", "Date of Birth"], ["nationality", "Nationality"], ["email", "Email"],
        ["phone1", "Parent/Guardian mobile"], ["phone2", "Alternate/Emergency contact"], ["height", "Height (cm)"], ["weight", "Weight (kg)"],
        ["bloodGroup", "Blood group"], ["school", "Name of school"], ["previousCoaching", "Previous cricket coaching"],
        ["previousCoachingDetails", "Previous coaching details"], ["cricketTeam", "Part of a cricket team"],
        ["cricketTeamDetails", "Cricket team details"], ["medicalConditions", "Medical conditions"], ["address", "Address"]
      ]
    },
    {
      title: "Parents / guardians",
      fields: [["fatherNameOccupation", "Fathers Name & Occupation"], ["motherNameOccupation", "Mothers Name & Occupation"]]
    },
    {
      title: "Acknowledgment",
      fields: [["acknowledgment", "Acknowledgment"], ["acknowledgmentDate", "Date"], ["acknowledgmentTime", "Time"], ["signatureName", "Typed full name / signature"]]
    }
  ];

  const officeFields = [
    ["status", "Registration status"],
    ["dateOfJoining", "Date of joining"],
    ["registrationFee", "Registration fee (AED)"],
    ["coachingFee", "Coaching fee (AED)"],
    ["transport", "Transport"],
    ["jersey", "Jersey"]
  ];

  const fieldTypes = {
    programme: "select", gender: "select", age: "number", dateOfBirth: "date", email: "email",
    height: "number", weight: "number", previousCoaching: "select", previousCoachingDetails: "textarea",
    cricketTeam: "select", cricketTeamDetails: "textarea", medicalConditions: "textarea", address: "textarea",
    acknowledgment: "checkbox", acknowledgmentDate: "date", acknowledgmentTime: "time",
    dateOfJoining: "date", registrationFee: "number", coachingFee: "number"
  };

  const fieldOptions = {
    programme: [["", "Not supplied"], ["weekday", "Weekday Batch"], ["weekend", "Weekend Batch"]],
    gender: [["", "Not supplied"], ["Male", "Male"], ["Female", "Female"]],
    previousCoaching: [["", "Not supplied"], ["Yes", "Yes"], ["No", "No"]],
    cricketTeam: [["", "Not supplied"], ["Yes", "Yes"], ["No", "No"]]
  };

  const fileNames = {
    photo: "Applicant photo", passport: "Passport copy", eidFront: "Emirates ID — Front", eidBack: "Emirates ID — Back"
  };

  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  })[char]);

  function loadRecords() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      let changed = false;
      parsed.forEach((record) => {
        if (!record?.values) return;
        const derivedAge = calculateAge(record.values.dateOfBirth);
        if (record.values.age !== derivedAge) {
          record.values.age = derivedAge;
          changed = true;
        }
      });
      if (changed) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        } catch (error) {
          console.warn("Calculated ages could not be migrated in browser storage.", error);
        }
      }
      return parsed;
    } catch (error) {
      console.warn("Saved prototype records could not be loaded.", error);
      return [];
    }
  }

  function saveRecords(nextRecords) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
  }

  function formatSubmittedAt(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
  }

  function calculateAge(dateValue, today = new Date()) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue || "");
    if (!match) return "";
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const birthDate = new Date(year, month - 1, day);
    if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day || birthDate > today) return "";
    let age = today.getFullYear() - year;
    const birthdayPassed = today.getMonth() > month - 1 || (today.getMonth() === month - 1 && today.getDate() >= day);
    if (!birthdayPassed) age -= 1;
    return String(age);
  }

  function syncAge(root) {
    const dateInput = qs('[name="dateOfBirth"]', root);
    const ageInput = qs('[name="age"]', root);
    if (dateInput && ageInput) ageInput.value = calculateAge(dateInput.value);
  }

  function setAcknowledgmentDefaults(form, now = new Date()) {
    const dateInput = qs('[name="acknowledgmentDate"]', form);
    const timeInput = qs('[name="acknowledgmentTime"]', form);
    const pad = (value) => String(value).padStart(2, "0");
    if (dateInput && !dateInput.value) {
      dateInput.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    }
    if (timeInput && !timeInput.value) {
      timeInput.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }
  }

  function nextRecordReference() {
    const highest = records.reduce((maximum, record) => {
      const match = /^PSA-DEMO-(\d+)$/.exec(record.reference || "");
      return match ? Math.max(maximum, Number(match[1])) : maximum;
    }, 0);
    return `PSA-DEMO-${String(highest + 1).padStart(3, "0")}`;
  }

  function parseHash() {
    const raw = location.hash.replace(/^#/, "") || "home";
    const [route, query = ""] = raw.split("?");
    return { route, params: new URLSearchParams(query) };
  }

  function navigate(route, params = {}) {
    const search = new URLSearchParams(params).toString();
    const next = `#${route}${search ? `?${search}` : ""}`;
    if (location.hash === next) renderRoute();
    else location.hash = next;
  }

  function renderRoute() {
    let { route, params } = parseHash();
    const guarded = route === "admin" || route === "admin-detail" || route === "admin-edit";
    if (guarded && !signedIn) {
      route = "login";
      showToast("Sign in to view the demonstration Admin area.");
    }

    if (route !== "admin") qs("#reset-panel").hidden = true;

    const target = qs(`[data-page="${route}"]`) || qs('[data-page="home"]');
    qsa("[data-page]").forEach((page) => {
      const active = page === target;
      page.hidden = !active;
      page.classList.toggle("is-active", active);
    });

    qsa(".primary-nav a").forEach((link) => link.classList.remove("is-current"));
    const currentNav = route === "programmes" ? qs('.primary-nav [data-route="programmes"]') : (route === "login" || guarded ? qs('.primary-nav [data-route="login"]') : null);
    currentNav?.classList.add("is-current");

    if (route === "register") {
      const programme = params.get("programme");
      if (programmeLabels[programme]) qs("#programme-select").value = programme;
    }
    if (route === "admin") renderAdminList();
    if (route === "admin-detail") renderAdminDetail(params.get("id"));
    if (route === "admin-edit") renderAdminEdit(params.get("id"));

    qs("#login-nav-link").textContent = signedIn ? "Admin" : "Login";
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => qs("#main-content")?.focus({ preventScroll: true }), 20);
  }

  function showToast(message) {
    const toast = qs("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3400);
  }

  function validateFile(file) {
    const hasAllowedExtension = /\.(jpe?g|png|pdf)$/i.test(file.name);
    const hasAllowedType = !file.type || ALLOWED_FILE_TYPES.has(file.type.toLowerCase());
    if (!hasAllowedExtension || !hasAllowedType) return "Choose a JPG, JPEG, PNG, or PDF file.";
    if (file.size > MAX_FILE_BYTES) return "Choose a file no larger than 10 MB.";
    return "";
  }

  function chooseProgramme(programme) {
    navigate("register", { programme });
  }

  function handleFileSelection(input) {
    const key = input.dataset.fileKey;
    const file = input.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      fileErrors.set(key, validationError);
      input.value = "";
      renderFilePreview(key);
      return;
    }

    const previous = files.get(key);
    if (previous?.url) URL.revokeObjectURL(previous.url);
    const entry = { file, url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null };
    files.set(key, entry);
    fileErrors.delete(key);
    renderFilePreview(key);
  }

  function renderFilePreview(key) {
    const preview = qs(`[data-file-preview="${key}"]`);
    const entry = files.get(key);
    const error = fileErrors.get(key);
    if (!preview) return;
    if (!entry) {
      preview.innerHTML = error ? `<p class="file-error" role="alert">${escapeHtml(error)}</p>` : "";
      return;
    }
    const visual = entry.url
      ? `<img src="${entry.url}" alt="Local preview for ${escapeHtml(entry.file.name)}">`
      : `<span class="file-type-icon" aria-hidden="true">FILE</span>`;
    preview.innerHTML = `<div class="file-selected">${visual}<div><strong title="${escapeHtml(entry.file.name)}">${escapeHtml(entry.file.name)}</strong><small>${formatBytes(entry.file.size)}${entry.url ? " · image preview" : " · preview unavailable"}</small></div><button class="remove-file" type="button" data-remove-file="${key}" aria-label="Remove ${escapeHtml(entry.file.name)}">Remove</button></div>${error ? `<p class="file-error" role="alert">${escapeHtml(error)} The previous selection is still active.</p>` : ""}`;
  }

  function removeFile(key) {
    const entry = files.get(key);
    if (entry?.url) URL.revokeObjectURL(entry.url);
    files.delete(key);
    fileErrors.delete(key);
    const input = qs(`[data-file-key="${key}"]`);
    if (input) input.value = "";
    renderFilePreview(key);
  }

  function formatBytes(bytes) {
    if (!bytes) return "0 bytes";
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function formValues(form) {
    const data = new FormData(form);
    const values = {};
    for (const [key, value] of data.entries()) {
      if (!(value instanceof File)) values[key] = value;
    }
    return values;
  }

  async function handleRegistrationSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    submitting = true;
    const form = event.currentTarget;
    const submit = qs("#submit-registration");
    const status = qs("#registration-status");
    submit.disabled = true;
    submit.innerHTML = `Saving test record <span aria-hidden="true">…</span>`;
    status.textContent = "";

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 280));
      syncAge(form);
      const values = formValues(form);
      const reference = nextRecordReference();
      const fileMetadata = {};
      for (const [key, entry] of files.entries()) {
        fileMetadata[key] = { name: entry.file.name, type: entry.file.type || "Not reported", size: entry.file.size };
      }
      const record = {
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${records.length}`,
        reference,
        submittedAt: new Date().toISOString(),
        values,
        files: fileMetadata,
        office: { status: "Test received" }
      };
      saveRecords([...records, record]);
      records.push(record);

      for (const [key] of files.entries()) removeFile(key);
      fileErrors.clear();
      qsa("[data-file-preview]").forEach((preview) => { preview.innerHTML = ""; });
      form.reset();
      setAcknowledgmentDefaults(form);
      qs("#confirmation-reference").textContent = reference;
      qs("#confirmation-message").textContent = `${programmeLabels[values.programme] ? `${programmeLabels[values.programme]} was recorded. ` : ""}This is not an enrollment approval. Sign in to the demo Admin area to review it; the record remains in this browser until reset.`;
      navigate("confirmation");
    } catch (error) {
      console.error(error);
      status.textContent = "The test record could not be saved. Your entries remain in the form; please try again.";
    } finally {
      submitting = false;
      submit.disabled = false;
      submit.innerHTML = `Submit test registration <span aria-hidden="true">→</span>`;
    }
  }

  function handleLogin(event) {
    event.preventDefault();
    const username = qs("#username").value;
    const password = qs("#password").value;
    const error = qs("#login-error");
    if (username === "admin" && password === "admin") {
      signedIn = true;
      error.textContent = "";
      event.currentTarget.reset();
      navigate("admin");
    } else {
      signedIn = false;
      error.textContent = "Username or password is incorrect. Use admin / admin for this prototype.";
      qs("#username").focus();
    }
  }

  function renderAdminList() {
    const summary = qs("#record-summary");
    const list = qs("#admin-list");
    const resetButton = qs("#reset-data-button");
    summary.textContent = `${records.length} test ${records.length === 1 ? "record" : "records"} saved in this browser`;
    if (resetButton) resetButton.disabled = records.length === 0;
    if (!records.length) {
      list.innerHTML = `<div class="empty-state"><div><div class="empty-state-icon" aria-hidden="true">0</div><h2>No registrations yet</h2><p>Create a blank or completed test registration, then sign in to review it here.</p><button class="button button-primary" type="button" data-route="register">Create test registration <span aria-hidden="true">→</span></button></div></div>`;
      return;
    }

    const rows = records.map((record) => {
      const name = record.values.fullName || "Not supplied";
      const programme = programmeLabels[record.values.programme] || "Not supplied";
      const status = record.office?.status || "Test received";
      return `<tr><td data-label="Reference">${escapeHtml(record.reference)}</td><td data-label="Applicant">${escapeHtml(name)}</td><td data-label="Programme">${escapeHtml(programme)}</td><td data-label="Submitted">${escapeHtml(formatSubmittedAt(record.submittedAt))}</td><td data-label="Status"><span class="status-pill">${escapeHtml(status)}</span></td><td data-label="Action"><button class="view-record" type="button" data-record-id="${escapeHtml(record.id)}">Manage record</button></td></tr>`;
    }).join("");
    list.innerHTML = `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Reference</th><th>Applicant</th><th>Programme</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderAdminDetail(id) {
    const root = qs("#admin-detail");
    const record = records.find((item) => item.id === id);
    if (!record) {
      root.innerHTML = `<div class="missing-record"><h1>Record unavailable</h1><p>The record may have been reset or the link may be incomplete.</p><button class="button button-primary" type="button" data-route="admin">Return to registrations</button></div>`;
      return;
    }

    const cards = fieldGroups.map((group) => {
      const rows = group.fields.map(([key, label]) => {
        let value = record.values[key];
        if (key === "programme") value = programmeLabels[value] || value;
        const output = value ? escapeHtml(value) : `<span class="not-supplied">Not supplied</span>`;
        return `<div><dt>${escapeHtml(label)}</dt><dd>${output}</dd></div>`;
      }).join("");
      const wide = group.title === "Player information" ? " detail-wide" : "";
      return `<section class="detail-card${wide}"><h2>${escapeHtml(group.title)}</h2><dl class="detail-list">${rows}</dl></section>`;
    }).join("");

    const fileRows = Object.entries(fileNames).map(([key, label]) => {
      const file = record.files[key];
      return `<div><strong>${escapeHtml(label)}</strong><span>${file ? `${escapeHtml(file.name)} · ${formatBytes(file.size)}` : "Not supplied"}</span></div>`;
    }).join("");

    const office = { status: "Test received", ...(record.office || {}) };
    const officeRows = officeFields.map(([key, label]) => {
      const value = office[key];
      const output = value ? escapeHtml(value) : `<span class="not-supplied">Not supplied</span>`;
      return `<div><dt>${escapeHtml(label)}</dt><dd>${output}</dd></div>`;
    }).join("");
    const updated = record.updatedAt ? `<p>Last updated ${escapeHtml(formatSubmittedAt(record.updatedAt))}</p>` : "";

    root.innerHTML = `<header class="record-header"><div><span class="status-pill">${escapeHtml(office.status)}</span><h1>${escapeHtml(record.values.fullName || "Unnamed registration")}</h1><p>Submitted ${escapeHtml(formatSubmittedAt(record.submittedAt))}</p>${updated}</div><div class="record-header-actions"><div class="record-reference">${escapeHtml(record.reference)}</div><button class="button button-light" type="button" data-edit-record="${escapeHtml(record.id)}">Edit record</button><button class="button button-danger-outline" type="button" data-delete-record="${escapeHtml(record.id)}">Delete record</button></div></header><div class="delete-panel" id="delete-panel" hidden><div><strong>Delete this registration?</strong><p>This permanently removes ${escapeHtml(record.reference)} from this browser.</p></div><div class="delete-panel-actions"><button class="button button-secondary" type="button" data-cancel-delete>Cancel</button><button class="button button-danger" type="button" data-confirm-delete="${escapeHtml(record.id)}">Yes, delete record</button></div><p class="delete-status" id="delete-status" role="alert"></p></div><div class="detail-sections">${cards}<section class="detail-card"><h2>Selected documents</h2><div class="file-list">${fileRows}</div><p class="office-note">Only filenames and sizes are retained in this browser record; document contents are not available.</p></section><section class="detail-card"><h2>Office use</h2><dl class="detail-list">${officeRows}</dl></section></div>`;
  }

  function renderEditorField([key, label], source, prefix = "") {
    const type = fieldTypes[key] || "text";
    const value = source[key] ?? "";
    const name = `${prefix}${key}`;
    const full = type === "textarea" || ["fullName", "school", "fatherNameOccupation", "motherNameOccupation", "signatureName"].includes(key) ? " field-full" : "";
    if (key === "age") return `<label class="field">${escapeHtml(label)} <span>Automatic</span><input name="${escapeHtml(name)}" type="number" min="0" value="${escapeHtml(value)}" readonly aria-readonly="true"><small>Calculated from Date of Birth.</small></label>`;
    if (type === "select") {
      const options = fieldOptions[key].map(([optionValue, optionLabel]) => `<option value="${escapeHtml(optionValue)}"${String(value) === optionValue ? " selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("");
      return `<label class="field${full}">${escapeHtml(label)}<select name="${escapeHtml(name)}">${options}</select></label>`;
    }
    if (type === "textarea") return `<label class="field field-full">${escapeHtml(label)}<textarea name="${escapeHtml(name)}" rows="3">${escapeHtml(value)}</textarea></label>`;
    if (type === "checkbox") return `<label class="check-field field-full"><input type="checkbox" name="${escapeHtml(name)}" value="Acknowledged"${value ? " checked" : ""}><span>${escapeHtml(label)}</span></label>`;
    const numberAttributes = type === "number" ? ` min="0" step="any"` : "";
    return `<label class="field${full}">${escapeHtml(label)}<input name="${escapeHtml(name)}" type="${type}" value="${escapeHtml(value)}"${numberAttributes} autocomplete="off"></label>`;
  }

  function renderAdminEdit(id) {
    const root = qs("#admin-edit");
    const record = records.find((item) => item.id === id);
    if (!record) {
      root.innerHTML = `<div class="missing-record"><h1>Record unavailable</h1><p>The record may have been deleted or reset.</p><button class="button button-primary" type="button" data-route="admin">Return to registrations</button></div>`;
      return;
    }

    const sections = fieldGroups.map((group, index) => `<section class="form-section"><div class="form-section-heading"><span>${String(index + 1).padStart(2, "0")}</span><div><h2>${escapeHtml(group.title)}</h2><p>Admin can update any value in this section.</p></div></div><div class="field-grid">${group.fields.map((field) => renderEditorField(field, record.values)).join("")}</div></section>`).join("");
    const office = { status: "Test received", ...(record.office || {}) };
    const officeSection = `<section class="form-section"><div class="form-section-heading"><span>05</span><div><h2>Office use</h2><p>Manage status, joining details, fees in AED, transport, and jersey.</p></div></div><div class="field-grid">${officeFields.map((field) => renderEditorField(field, office, "office_")).join("")}</div></section>`;
    const documentCards = Object.entries(fileNames).map(([key, label]) => {
      const file = record.files[key];
      const current = file ? `${escapeHtml(file.name)} · ${formatBytes(file.size)}` : "Not supplied";
      return `<div class="admin-file-editor"><strong>${escapeHtml(label)}</strong><span>Current: ${current}</span><label class="field">Replace with one JPG, JPEG, PNG, or PDF file (max 10 MB)<input type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" name="file_${escapeHtml(key)}"></label>${file ? `<label class="remove-existing-file"><input type="checkbox" name="remove_${escapeHtml(key)}"> Remove current file metadata</label>` : ""}</div>`;
    }).join("");
    const documentSection = `<section class="form-section"><div class="form-section-heading"><span>06</span><div><h2>Selected documents</h2><p>Replace or remove stored metadata. File contents are never saved.</p></div></div><div class="admin-file-grid">${documentCards}</div></section>`;

    root.innerHTML = `<div class="admin-edit-heading"><p class="eyebrow"><span>Admin</span> Edit ${escapeHtml(record.reference)}</p><h1>Edit registration</h1><p>System reference and original submission time remain unchanged.</p></div><form id="admin-edit-form" data-editing-record-id="${escapeHtml(record.id)}">${sections}${officeSection}${documentSection}<div class="form-submit-bar"><div><strong>Save Admin changes?</strong><p>Updates remain in this browser until deleted or reset.</p></div><button class="button button-primary" type="submit">Save changes <span aria-hidden="true">→</span></button></div><p class="form-status" id="admin-edit-status" role="status" aria-live="polite"></p></form>`;
    const form = qs("#admin-edit-form");
    syncAge(form);
    qs('[name="dateOfBirth"]', form).addEventListener("input", () => syncAge(form));
    form.addEventListener("submit", handleAdminEditSubmit);
  }

  function handleAdminEditSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    syncAge(form);
    const id = form.dataset.editingRecordId;
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) return navigate("admin");
    const current = records[index];
    const data = new FormData(form);
    const values = {};
    fieldGroups.forEach((group) => group.fields.forEach(([key]) => {
      values[key] = key === "acknowledgment" ? (data.has(key) ? "Acknowledged" : "") : String(data.get(key) || "");
    }));
    const office = {};
    officeFields.forEach(([key]) => { office[key] = String(data.get(`office_${key}`) || ""); });
    if (!office.status) office.status = "Test received";
    const nextFiles = { ...(current.files || {}) };
    for (const key of Object.keys(fileNames)) {
      const replacement = data.get(`file_${key}`);
      if (replacement instanceof File && replacement.size > 0) {
        const validationError = validateFile(replacement);
        if (validationError) {
          qs("#admin-edit-status").textContent = `${fileNames[key]}: ${validationError}`;
          form.elements[`file_${key}`].focus();
          return;
        }
        nextFiles[key] = { name: replacement.name, type: replacement.type || "Not reported", size: replacement.size };
      } else if (data.has(`remove_${key}`)) {
        delete nextFiles[key];
      }
    }
    const updatedRecord = { ...current, values, office, files: nextFiles, updatedAt: new Date().toISOString() };
    const nextRecords = [...records];
    nextRecords[index] = updatedRecord;
    try {
      saveRecords(nextRecords);
      records.splice(index, 1, updatedRecord);
      navigate("admin-detail", { id });
      showToast(`${current.reference} was updated.`);
    } catch (error) {
      console.error(error);
      qs("#admin-edit-status").textContent = "Changes could not be saved. Your edits remain on screen; please try again.";
    }
  }

  function deleteRecord(id) {
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) return navigate("admin");
    const reference = records[index].reference;
    const nextRecords = records.filter((record) => record.id !== id);
    try {
      saveRecords(nextRecords);
      records.splice(index, 1);
      navigate("admin");
      showToast(`${reference} was deleted.`);
    } catch (error) {
      console.error(error);
      qs("#delete-status").textContent = "This record could not be deleted. Please try again.";
    }
  }

  function openResetPanel() {
    if (!records.length) return;
    const panel = qs("#reset-panel");
    qs("#reset-panel-message").textContent = `This removes ${records.length} saved test ${records.length === 1 ? "record" : "records"} from this browser. This action cannot be undone.`;
    qs("#reset-status").textContent = "";
    panel.hidden = false;
    qs("#confirm-reset-button").focus();
  }

  function closeResetPanel() {
    qs("#reset-panel").hidden = true;
    qs("#reset-data-button").focus();
  }

  function resetTestData() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      records.splice(0, records.length);
      qs("#reset-panel").hidden = true;
      renderAdminList();
      showToast("All saved test registrations were removed from this browser.");
      qs("#reset-data-button").focus();
    } catch (error) {
      console.error(error);
      qs("#reset-status").textContent = "Test data could not be reset. Please try again.";
    }
  }

  document.addEventListener("click", (event) => {
    const routeTarget = event.target.closest("[data-route]");
    if (routeTarget) {
      event.preventDefault();
      navigate(routeTarget.dataset.route);
      return;
    }
    const programmeTarget = event.target.closest("[data-register-programme]");
    if (programmeTarget) {
      chooseProgramme(programmeTarget.dataset.registerProgramme);
      return;
    }
    const removeTarget = event.target.closest("[data-remove-file]");
    if (removeTarget) {
      removeFile(removeTarget.dataset.removeFile);
      return;
    }
    const editTarget = event.target.closest("[data-edit-record]");
    if (editTarget) {
      navigate("admin-edit", { id: editTarget.dataset.editRecord });
      return;
    }
    const deleteTarget = event.target.closest("[data-delete-record]");
    if (deleteTarget) {
      const panel = qs("#delete-panel");
      panel.hidden = false;
      qs("[data-confirm-delete]", panel).focus();
      return;
    }
    if (event.target.closest("[data-cancel-delete]")) {
      qs("#delete-panel").hidden = true;
      qs("[data-delete-record]").focus();
      return;
    }
    const confirmDeleteTarget = event.target.closest("[data-confirm-delete]");
    if (confirmDeleteTarget) {
      deleteRecord(confirmDeleteTarget.dataset.confirmDelete);
      return;
    }
    const recordTarget = event.target.closest("[data-record-id]");
    if (recordTarget) navigate("admin-detail", { id: recordTarget.dataset.recordId });
  });

  qsa(".file-input").forEach((input) => input.addEventListener("change", () => handleFileSelection(input)));
  const registrationForm = qs("#registration-form");
  setAcknowledgmentDefaults(registrationForm);
  const termsDisclosure = qs(".terms-disclosure", registrationForm);
  const mobileTermsQuery = window.matchMedia("(max-width: 720px)");
  const syncTermsDisclosure = () => { termsDisclosure.open = !mobileTermsQuery.matches; };
  syncTermsDisclosure();
  if (mobileTermsQuery.addEventListener) mobileTermsQuery.addEventListener("change", syncTermsDisclosure);
  else mobileTermsQuery.addListener(syncTermsDisclosure);
  qs('[name="dateOfBirth"]', registrationForm).addEventListener("input", () => syncAge(registrationForm));
  registrationForm.addEventListener("submit", handleRegistrationSubmit);
  qs("#login-form").addEventListener("submit", handleLogin);
  qs("#logout-button").addEventListener("click", () => {
    signedIn = false;
    qs("#reset-panel").hidden = true;
    navigate("login");
    showToast("You have left the demonstration Admin area.");
  });
  qs("#reset-data-button").addEventListener("click", openResetPanel);
  qs("#cancel-reset-button").addEventListener("click", closeResetPanel);
  qs("#confirm-reset-button").addEventListener("click", resetTestData);
  qs("#cancel-admin-edit").addEventListener("click", () => {
    const id = parseHash().params.get("id");
    navigate(id ? "admin-detail" : "admin", id ? { id } : {});
  });
  window.addEventListener("hashchange", renderRoute);
  window.addEventListener("beforeunload", () => {
    files.forEach((entry) => entry.url && URL.revokeObjectURL(entry.url));
  });

  renderRoute();
})();
