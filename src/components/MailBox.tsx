import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { loadStaffSession, saveStaffSession, type MailLink } from '../lib/staffSession';
import { isUwezoMailbox, signInMailbox, standardMailboxPassword } from '../lib/zimbraAuth';
import {
  MAIL_FOLDERS,
  listMail,
  moveMail,
  parseMessageBody,
  parseMessages,
  readMail,
  saveDraft,
  sendMail,
  type MailAttachment,
  type MailFolderId,
  type MailItem,
  type MailPayload,
} from '../lib/zimbraMail';

type MailBoxProps = {
  onPasswordReset: (message: string) => void;
};

const FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Courier New'];
const SIZES = [
  { label: 'Small', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Large', value: '5' },
  { label: 'Largest', value: '6' },
];

function signatureStore(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('uwezo.mail.signature.v1') || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function loadSignature(email: string): string {
  return signatureStore()[email.toLowerCase()] || '';
}

function saveSignature(email: string, dataUrl: string) {
  const book = signatureStore();
  if (dataUrl) book[email.toLowerCase()] = dataUrl;
  else delete book[email.toLowerCase()];
  localStorage.setItem('uwezo.mail.signature.v1', JSON.stringify(book));
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}

function splitDataUrl(dataUrl: string): MailAttachment | null {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) return null;
  const base64 = match[2].replace(/\s/g, '');
  const extension = match[1].split('/')[1] || 'bin';
  return { name: `signature.${extension}`, type: match[1], base64 };
}

function cleanHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+="[^"]*"/gi, '');
}

export function MailBox({ onPasswordReset }: MailBoxProps) {
  const staff = loadStaffSession();
  const [mail, setMail] = useState<MailLink | null>(() => staff?.mail || null);
  const [email, setEmail] = useState(staff?.email || '');
  const [password, setPassword] = useState('');
  const [folder, setFolder] = useState<MailFolderId>('inbox');
  const [items, setItems] = useState<MailItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState<{ item: MailItem; body: string } | null>(null);
  const [composing, setComposing] = useState(false);
  const [settings, setSettings] = useState(false);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [attachments, setAttachments] = useState<MailAttachment[]>([]);
  const [signature, setSignature] = useState(() => (staff?.email ? loadSignature(staff.email) : ''));
  const [includeSignature, setIncludeSignature] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);

  function storeMail(next: MailLink, passwordReset: boolean) {
    const current = loadStaffSession();
    if (!current) return;
    saveStaffSession({
      ...current,
      passwordReset: passwordReset || current.passwordReset,
      mail: next,
    });
    setMail(next);
    setSignature(loadSignature(next.email));
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
    return action(signed.token);
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
    setSelected([]);
  }

  useEffect(() => {
    const current = loadStaffSession();
    if (!current || current.mail || !current.password || !isUwezoMailbox(current.email)) return;
    let cancelled = false;
    void (async () => {
      const signed = await signInMailbox(current.email, current.password);
      if (cancelled || !signed.ok) return;
      storeMail({ email: signed.email, token: signed.token, password: signed.password }, signed.passwordReset);
      setMessage(`Mailbox ${signed.email} is connected on this phone.`);
    })();
    return () => {
      cancelled = true;
    };
    // Open the mailbox with the password already used to enter the app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mail) return;
    void loadFolder(folder, mail);
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

  function format(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }

  function payload(): MailPayload | null {
    const html = cleanHtml(editorRef.current?.innerHTML || '');
    const text = editorRef.current?.innerText.trim() || '';
    if (!to.includes('@') || !subject.trim() || !text) {
      setError('Enter the recipient, subject, and message.');
      return null;
    }
    const signatureFile = includeSignature ? splitDataUrl(signature) : null;
    const withSignature = signatureFile ? `${html}<p><img src="cid:signature@uwezo" alt="Signature" style="max-width:240px"></p>` : html;
    return { to: to.trim(), subject: subject.trim(), html: withSignature, attachments, signature: signatureFile };
  }

  async function submitMail(event: { preventDefault: () => void }, draft: boolean) {
    event.preventDefault();
    const messageBody = payload();
    if (!messageBody) return;
    setBusy(true);
    setError('');
    const result = await tokenFor((token) => (draft ? saveDraft(token, messageBody) : sendMail(token, messageBody)));
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
    setAttachments([]);
    if (editorRef.current) editorRef.current.innerHTML = '';
    if (draft) setFolder('drafts');
    else void loadFolder(folder);
  }

  async function removeIds(ids: string[]) {
    if (!ids.length) {
      setError('Select one or more messages to delete.');
      return;
    }
    setBusy(true);
    setError('');
    const op = folder === 'deleted' ? 'delete' : 'trash';
    const result = await tokenFor((token) => moveMail(token, ids, op));
    setBusy(false);
    if (!result) return;
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    setMessage(ids.length === 1 ? 'Message deleted.' : `${ids.length} messages deleted.`);
    setOpen(null);
    setSelected([]);
    void loadFolder(folder);
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

  async function addAttachments(files: FileList | null) {
    if (!files?.length) return;
    const next = [...attachments];
    for (const file of [...files]) {
      if (next.length >= 3) {
        setError('Attach up to 3 files.');
        break;
      }
      if (file.size > 1200000) {
        setError(`${file.name} is larger than 1.2 MB.`);
        continue;
      }
      const dataUrl = await readFile(file);
      const parsed = splitDataUrl(dataUrl);
      if (!parsed) {
        setError(`${file.name} could not be read.`);
        continue;
      }
      next.push({ ...parsed, name: file.name });
    }
    setAttachments(next);
  }

  async function chooseSignature(file: File | null) {
    if (!file || !mail) return;
    if (!file.type.startsWith('image/')) {
      setError('The signature must be a picture.');
      return;
    }
    if (file.size > 400000) {
      setError('Use a signature picture smaller than 400 KB.');
      return;
    }
    const dataUrl = await readFile(file);
    if (!splitDataUrl(dataUrl)) {
      setError('The signature picture could not be read.');
      return;
    }
    saveSignature(mail.email, dataUrl);
    setSignature(dataUrl);
    setMessage('Signature saved on this phone.');
  }

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  if (!staff) return <p className="lms-note">Sign in again to use mail.</p>;

  if (!mail) {
    return (
      <form className="account-form" onSubmit={(event) => void connect(event)}>
        <h2>Mailbox</h2>
        <p className="home-chat-note">
          This sign-in did not open the mailbox. Enter the mail.govmail.ke password for this address. It stays connected until you log out.
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
  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.id));

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
      <div className="doc-actions">
        <button type="button" className="btn-ghost" onClick={() => { setComposing(true); setOpen(null); setSettings(false); setError(''); }}>New message</button>
        <button type="button" className="btn-ghost" onClick={() => { setSettings((openSettings) => !openSettings); setComposing(false); }}>Signature</button>
        <button type="button" className="btn-ghost" disabled={busy || (!selected.length && !open)} onClick={() => void removeIds(selected.length ? selected : open ? [open.item.id] : [])}>
          Delete selected
        </button>
      </div>
      {message ? <p className="lms-note">{message}</p> : null}
      {error ? <p className="lms-note">{error}</p> : null}
      {settings ? (
        <div className="mail-read">
          <h3>Signature</h3>
          <p className="home-chat-note">Upload a picture. It is added when you send a message from this phone.</p>
          {signature ? <img src={signature} alt="Signature" style={{ maxWidth: 220 }} /> : <p>No signature saved.</p>}
          <label className="btn-ghost">
            Upload signature
            <input type="file" accept="image/*" onChange={(event) => void chooseSignature(event.target.files?.[0] || null)} />
          </label>
          {signature ? <button type="button" className="btn-ghost" onClick={() => { saveSignature(mail.email, ''); setSignature(''); }}>Remove signature</button> : null}
        </div>
      ) : null}
      {composing ? (
        <form className="account-form" onSubmit={(event) => void submitMail(event, false)}>
          <label>To<input type="email" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
          <div className="mail-toolbar">
            <button type="button" className="btn-ghost" onClick={() => format('bold')}>Bold</button>
            <button type="button" className="btn-ghost" onClick={() => format('italic')}>Italic</button>
            <button type="button" className="btn-ghost" onClick={() => format('underline')}>Underline</button>
            <select aria-label="Font" defaultValue="" onChange={(event) => { format('fontName', event.target.value); event.target.value = ''; }}>
              <option value="" disabled>Font</option>
              {FONTS.map((font) => <option key={font} value={font}>{font}</option>)}
            </select>
            <select aria-label="Font size" defaultValue="" onChange={(event) => { format('fontSize', event.target.value); event.target.value = ''; }}>
              <option value="" disabled>Size</option>
              {SIZES.map((size) => <option key={size.value} value={size.value}>{size.label}</option>)}
            </select>
            <label>
              Colour
              <input type="color" aria-label="Font colour" defaultValue="#1a1a1a" onChange={(event) => format('foreColor', event.target.value)} />
            </label>
          </div>
          <p className="home-chat-note">Select text, then choose a font, size, or colour.</p>
          <div ref={editorRef} className="mail-editor" contentEditable role="textbox" aria-label="Message" />
          <label className="btn-ghost">
            Attach files
            <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" onChange={(event) => void addAttachments(event.target.files)} />
          </label>
          {attachments.map((file) => <span key={file.name}>{file.name}</span>)}
          <label className="lms-check">
            <input type="checkbox" checked={includeSignature} onChange={(event) => setIncludeSignature(event.target.checked)} />
            Include signature
          </label>
          {includeSignature && signature ? <img src={signature} alt="Signature" style={{ maxWidth: 220 }} /> : null}
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
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => void removeIds([open.item.id])}>
              {folder === 'deleted' ? 'Delete' : 'Deleted'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(null)}>Back to {folderLabel}</button>
          </div>
        </article>
      ) : null}
      {!open && !composing && !settings ? (
        <>
          {items.length ? (
            <label className="lms-check">
              <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : items.map((item) => item.id))} />
              Select all
            </label>
          ) : null}
          {items.length ? items.map((item) => (
            <div className="mail-row" key={item.id}>
              <input type="checkbox" aria-label={`Select ${item.subject}`} checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
              <button type="button" className="application-card" onClick={() => void openItem(item)}>
                <strong>{item.subject}</strong>
                <span>{item.from || item.to}{item.date ? ` · ${item.date}` : ''}</span>
                {item.preview ? <span>{item.preview}</span> : null}
              </button>
            </div>
          )) : <p className="home-chat-note">{busy ? 'Loading mail…' : `No messages in ${folderLabel}.`}</p>}
        </>
      ) : null}
    </div>
  );
}
