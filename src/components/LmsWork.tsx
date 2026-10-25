import { useEffect, useState } from 'react';
import {
  DEFAULT_REPORT_COLUMNS,
  REPORT_FIELDS,
  loadLmsDraft,
  reportMethod,
  reviewLmsDraft,
  runLmsAction,
  saveLmsDraft,
  type LmsCompareRow,
  type LmsField,
  type LmsPageView,
} from '../lib/lmsSync';

type LmsWorkProps = {
  email: string;
  path: string;
  fields: LmsField[];
  actions: string[];
  busy: boolean;
  setBusy: (busy: boolean) => void;
  setNotice: (notice: string) => void;
  onView: (view: LmsPageView) => void;
};

export function LmsWork({ email, path, fields, actions, busy, setBusy, setNotice, onView }: LmsWorkProps) {
  const report = reportMethod(path) === 'generateReport';
  const [values, setValues] = useState<Record<string, string>>({});
  const [review, setReview] = useState<LmsCompareRow[] | null>(null);
  const [action, setAction] = useState(reportMethod(path) || actions[0] || '');
  const groups = [...new Set(REPORT_FIELDS.map((field) => field.group))];
  const selected = new Set((values.selectedColumns || '').split(',').filter(Boolean));

  useEffect(() => {
    const saved = loadLmsDraft(email, path);
    if (report) {
      setValues({ ...saved, selectedColumns: saved.selectedColumns || DEFAULT_REPORT_COLUMNS.join(',') });
    } else if (Object.keys(saved).length) {
      setValues(saved);
    } else {
      const initial: Record<string, string> = {};
      for (const field of fields) initial[field.key] = field.value;
      setValues(initial);
    }
    setAction(reportMethod(path) || actions[0] || '');
    setReview(null);
    // The form opens from the page that was just selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, path]);

  function toggleColumn(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setValues({ ...values, selectedColumns: [...next].join(',') });
    setReview(null);
  }

  function savedValues(): Record<string, string> {
    return action ? { ...values, __action: action } : values;
  }

  function keep() {
    saveLmsDraft(email, path, savedValues());
    setNotice('Saved on this phone.');
  }

  async function compare() {
    const next = savedValues();
    saveLmsDraft(email, path, next);
    setBusy(true);
    const result = await reviewLmsDraft(email, path, next);
    setBusy(false);
    setNotice(result.detail);
    setReview(result.ok ? result.rows : null);
  }

  async function submit() {
    if (!review) {
      await compare();
      return;
    }
    setBusy(true);
    const result = await runLmsAction(email, path, savedValues());
    setBusy(false);
    setNotice(result.detail);
    if (result.ok) {
      onView(result.view);
      setReview(null);
    }
  }

  if (!report && !fields.length && !actions.length) {
    return <p className="home-chat-note">This page is the latest copy from the LMS. Refresh pages to download it again. It has no form to submit from the app.</p>;
  }

  return (
    <div className="lms-fields">
      {report ? (
        <>
          <h2>Report columns</h2>
          <p className="home-chat-note">Choose the columns saved on this phone. Generate compares them with the LMS before it submits.</p>
          {groups.map((group) => (
            <fieldset key={group}>
              <legend>{group}</legend>
              {REPORT_FIELDS.filter((field) => field.group === group).map((field) => (
                <label className="lms-check" key={field.key}>
                  <input type="checkbox" checked={selected.has(field.key)} onChange={() => toggleColumn(field.key)} />
                  {field.label}
                </label>
              ))}
            </fieldset>
          ))}
        </>
      ) : (
        fields.map((field) => (
          <label key={field.key}>
            {field.label}
            <input
              value={values[field.key] ?? field.value}
              onChange={(event) => {
                setValues({ ...values, [field.key]: event.target.value });
                setReview(null);
              }}
            />
          </label>
        ))
      )}
      {!report && actions.length > 1 ? (
        <label>
          Action
          <select value={action} onChange={(event) => setAction(event.target.value)}>
            {actions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      ) : null}
      {review ? (
        <div className="lms-table">
          <h2>On the LMS now and saved on this phone</h2>
          <table>
            <thead>
              <tr><th>Field</th><th>On the LMS now</th><th>Saved on this phone</th></tr>
            </thead>
            <tbody>
              {review.length ? review.map((row) => (
                <tr key={row.label} className={row.different ? 'lms-diff' : undefined}>
                  <td>{row.label}</td>
                  <td>{row.server}</td>
                  <td>{row.phone}</td>
                </tr>
              )) : (
                <tr><td colSpan={3}>There is nothing to compare on this page.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="doc-actions">
        <button type="button" className="btn-ghost" disabled={busy} onClick={keep}>Save on this phone</button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => void compare()}>Compare with the LMS</button>
        {review ? <button type="button" className="btn-ghost" disabled={busy} onClick={() => setReview(null)}>Make changes</button> : null}
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Working…' : review ? 'Submit as saved on this phone' : 'Review before submit'}
        </button>
      </div>
    </div>
  );
}
