import { useEffect, useState } from 'react';
import {
  DEFAULT_REPORT_COLUMNS,
  REPORT_FIELDS,
  loadLmsDraft,
  pageKit,
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
  const kit = pageKit(path);
  const report = Boolean(reportMethod(path));
  const kitActions = kit?.actions || [];
  const actionList = kitActions.length ? kitActions.map((item) => item.method) : actions;
  const formFields = (kit?.fields.length ? kit.fields : fields).filter((field) => field.key !== 'selectedColumns');
  const [values, setValues] = useState<Record<string, string>>({});
  const [review, setReview] = useState<LmsCompareRow[] | null>(null);
  const [action, setAction] = useState(reportMethod(path) || actionList[0] || '');
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
      for (const field of formFields) initial[field.key] = field.value || '';
      setValues(initial);
    }
    setAction(reportMethod(path) || actionList[0] || '');
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

  function savedValues(nextAction = action): Record<string, string> {
    return nextAction ? { ...values, __action: nextAction } : { ...values };
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

  async function submit(nextAction?: string) {
    const chosen = nextAction || action;
    const next = savedValues(chosen);
    saveLmsDraft(email, path, next);
    if (report && !review) {
      await compare();
      return;
    }
    setBusy(true);
    const result = await runLmsAction(email, path, next);
    setBusy(false);
    setNotice(result.detail);
    if (result.ok) {
      onView(result.view);
      setReview(null);
    }
  }

  if (!report && !formFields.length && !actionList.length && !kit) {
    return <p className="home-chat-note">This page is the latest copy from the LMS. Refresh pages to download it again.</p>;
  }

  return (
    <div className="lms-fields">
      {kit?.intro ? <p className="home-chat-note">{kit.intro}</p> : null}
      {report ? (
        <>
          <h2>{path.includes('sector') ? 'Sectoral analysis columns' : 'Report columns'}</h2>
          <p className="home-chat-note">Choose the columns used on the online LMS. Compare them, then generate the report.</p>
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
        formFields.map((field) => (
          <label key={field.key}>
            {field.label}
            <input
              type={field.type || 'text'}
              value={values[field.key] ?? field.value ?? ''}
              placeholder={field.placeholder || ''}
              onChange={(event) => {
                setValues({ ...values, [field.key]: event.target.value });
                setReview(null);
              }}
            />
          </label>
        ))
      )}
      {!report && actionList.length > 1 && kitActions.length <= 1 ? (
        <label>
          Action
          <select value={action} onChange={(event) => setAction(event.target.value)}>
            {actionList.map((name) => (
              <option key={name} value={name}>{name.replace(/([a-z])([A-Z])/g, '$1 $2')}</option>
            ))}
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
        {formFields.length || report ? (
          <button type="button" className="btn-ghost" disabled={busy} onClick={keep}>Save on this phone</button>
        ) : null}
        {report || formFields.length ? (
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => void compare()}>Compare with the LMS</button>
        ) : null}
        {review ? <button type="button" className="btn-ghost" disabled={busy} onClick={() => setReview(null)}>Make changes</button> : null}
        {kitActions.length ? kitActions.map((item, index) => (
          <button
            key={item.method}
            type="button"
            className={index === 0 ? 'btn-primary' : 'btn-ghost'}
            disabled={busy}
            onClick={() => {
              setAction(item.method);
              void submit(item.method);
            }}
          >
            {busy && action === item.method ? 'Working…' : item.label}
          </button>
        )) : (
          <button type="button" className="btn-primary" disabled={busy || !action} onClick={() => void submit()}>
            {busy ? 'Working…' : review ? 'Submit as saved on this phone' : (report ? 'Review before generate' : 'Run action')}
          </button>
        )}
      </div>
    </div>
  );
}
