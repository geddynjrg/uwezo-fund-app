import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { loadStaffSession, saveStaffSession, type MailLink } from '../lib/staffSession';
import { signInMailbox, standardMailboxPassword } from '../lib/zimbraAuth';
import {
  MAIL_FOLDERS,
  listMail,
  moveMail,
  parseMessageBody,
  parseMessages,
  readMail,
  saveDraft,
  sendMail,
  type MailFolderId,
  type MailItem,
} from '../lib/zimbraMail';

type MailBoxProps = {
  onPasswordReset: (message: string) => void;
};

export function MailBox({ onPasswordReset }: MailBoxProps) {
  const [mail, setMail] = useState<MailLink | null>(() => loadStaffSession()?.mail || null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [folder, setFolder] = useState<MailFolderId>('inbox');
  const [items, setItems] = useState<MailItem[]>([]);
  const [open, setOpen] = useState<{ item: MailItem; body: string } | null>(null);
  const [composing, setComposing] = useState(false);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function storeMail(next: MailLink, passwordReset: boolean) {
    const staff = loadStaffSession();
    if (!staff) return;
    saveStaffSession({
      ...staff,
      passwordReset: passwordReset || staff.passwordReset,
      mail: next,
    });
    setMail(next);
    if (passwordReset) {
      onPasswordReset(`The mailbox password had expired. It is now ${standardMailboxPassword()}. Use that password the next time a sign-in is required.`);
    }
  }

  async function tokenFor(action: (token: string) => Promise<{ ok: boolean; xml: string; authFailed: boolean; detail: string }>) {
    const current = mail || loadStaffSession()?.mail || null;
    if (!current) return null;
    let result = await action(current.token);
    if (!result.authFailed) return result;
    const signed = await signInMailbox(current.email, current.password);
    if (!signed.ok) {
      setError(signed.message);
      return null;
    }
    const next = { email: signed.email, token: signed.token, password: signed.password };
    storeMail(next, signed.passwordReset);
    result = await action(signed.token);
    return result;
  }

  async function loadFolder(nextFolder: MailFolderId, link: MailLink | null = mail) {
    if (!link) return;
    setBusy(true);
    setError('');
    const query = MAIL_FOLDERS.find((item) => item.id === nextFolder)?.query || 'in:inbox';
    const result = await tokenFor((token) => listMail(token, query));
    setBusy(false);
    if (!result) return;
    if (!result.ok) {
      setError(result.detail);
      setItems([]);
      return;
    }
    setItems(parseMessages(result.xml));
  }

  useEffect(() => {
    if (!mail) return;
    void loadFolder(folder, mail);
    // The folder load reads the mailbox token saved on this phone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, mail?.email]);

  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const signed = await signInMailbox(email, password);
    setBusy(false);
    if (!signed.ok) {
      setError(signed.message);
      return;
    }
    storeMail({ email: signed.email, token: signed.token, password: signed.password }, signed.passwordReset);
    setPassword('');
    setMessage(`Mailbox ${signed.email} is connected on this phone.`);
  }

  async function openItem(item: MailItem) {
    setBusy(true);
    setError('');
    const result = await tokenFor((token) => readMail(token, item.id));
    setBusy(false);
    if (!result) return;
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    setOpen({ item, body: parseMessageBody(result.xml) || item.preview || 'This message has no text.' });
    setComposing(false);
  }

  async function submitMail(event: { preventDefault: () => void }, draft: boolean) {
    event.preventDefault();
    if (!to.includes('@') || !subject.trim() || !body.trim()) {
      setError('Enter the recipient, subject, and message.');
      return;
    }
    setBusy(true);
    setError('');
    const result = await tokenFor((token) => (draft ? saveDraft(token, to.trim(), subject.trim(), body) : sendMail(token, to.trim(), subject.trim(), body)));
    setBusy(false);
    if (!result) return;
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    setMessage(draft ? 'Draft saved.' : 'Message sent.');
    setComposing(false);
    setTo('');
    setSubject('');
    setBody('');
    if (draft) setFolder('drafts');
    else void loadFolder(folder);
  }

  async function act(op: 'trash' | 'spam' | 'archive' | 'delete') {
    if (!open) return;
    setBusy(true);
    setError('');
    const result = await tokenFor((token) => moveMail(token, open.item.id, op));
    setBusy(false);
    if (!result) return;
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    const labels = { trash: 'Moved to Deleted.', spam: 'Moved to Spam.', archive: 'Archived.', delete: 'Deleted.' };
    setMessage(labels[op]);
    setOpen(null);
    void loadFolder(folder);
  }

  if (!loadStaffSession()) {
    return <p className="lms-note">Sign in again to use mail.</p>;
  }

  if (!mail) {
    return (
      <form className="account-form" onSubmit={(event) => void connect(event)}>
        <h2>Mailbox</h2>
        <p className="home-chat-note">
          Sign in once with the mail.govmail.ke mailbox. Reading, sending, drafts, spam, archive, and deleted mail stay available on this phone until you log out.
        </p>
        <label>
          Mailbox
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@uwezo.go.ke" />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error ? <p className="lms-note">{error}</p> : null}
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Opening…' : 'Open mailbox'}</button>
      </form>
    );
  }

  const folderLabel = MAIL_FOLDERS.find((item) => item.id === folder)?.label || 'Inbox';

  return (
    <div className="account-form">
      <h2>{mail.email}</h2>
      <div className="mail-folders">
        {MAIL_FOLDERS.map((item) => (
          <button key={item.id} type="button" className={item.id === folder ? 'btn-primary' : 'btn-ghost'} onClick={() => { setFolder(item.id); setOpen(null); setComposing(false); }}>
            {item.label}
          </button>
        ))}
      </div>
      <button type="button" className="btn-ghost" onClick={() => { setComposing(true); setOpen(null); setError(''); }}>
        New message
      </button>
      {message ? <p className="lms-note">{message}</p> : null}
      {error ? <p className="lms-note">{error}</p> : null}
      {composing ? (
        <form className="account-form" onSubmit={(event) => void submitMail(event, false)}>
          <label>To<input type="email" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
          <label>Message<textarea rows={6} value={body} onChange={(event) => setBody(event.target.value)} /></label>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send'}</button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={(event) => void submitMail(event, true)}>Save draft</button>
        </form>
      ) : null}
      {open ? (
        <article className="mail-read">
          <h3>{open.item.subject}</h3>
          <p className="home-chat-note">{open.item.from || open.item.to} · {open.item.date}</p>
          <p>{open.body}</p>
          <div className="doc-actions">
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => void act('archive')}>Archive</button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => void act('spam')}>Spam</button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => void act(folder === 'deleted' ? 'delete' : 'trash')}>
              {folder === 'deleted' ? 'Delete' : 'Deleted'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(null)}>Back to {folderLabel}</button>
          </div>
        </article>
      ) : null}
      {!open && !composing ? (
        items.length ? items.map((item) => (
          <button key={item.id} type="button" className="application-card" onClick={() => void openItem(item)}>
            <strong>{item.subject}</strong>
            <span>{item.from || item.to}{item.date ? ` · ${item.date}` : ''}</span>
            {item.preview ? <span>{item.preview}</span> : null}
          </button>
        )) : <p className="home-chat-note">{busy ? 'Loading mail…' : `No messages in ${folderLabel}.`}</p>
      ) : null}
    </div>
  );
}
