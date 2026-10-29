import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { loadStaffSession, saveStaffSession, type MailLink } from '../lib/staffSession';
import { isUwezoMailbox, openMailboxForOfficer, standardMailboxPassword } from '../lib/zimbraAuth';
import {
  MAIL_FOLDERS,
  attachmentDataUrl,
  buildMailQuery,
  fetchAttachment,
  flagMail,
  forwardSubject,
  listMail,
  markMailRead,
  moveMail,
  parseMessageDetail,
  parseMessages,
  quoteForwardHtml,
  quoteHtml,
  readConversation,
  readMail,
  replySubject,
  saveDraft,
  saveOrShareFile,
  sendMail,
  type MailAttachment,
  type MailDetail,
  type MailFolderId,
  type MailItem,
  type MailPart,
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

const AVATAR_COLORS = ['#1a73e8', '#d93025', '#188038', '#e37400', '#9334e6', '#007b83', '#c5221f', '#1967d2'];

function Icon({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      {children}
    </svg>
  );
}

const IcMenu = () => (
  <Icon>
    <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
  </Icon>
);
const IcBack = () => (
  <Icon>
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
  </Icon>
);
const IcClose = () => (
  <Icon>
    <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </Icon>
);
const IcSend = () => (
  <Icon>
    <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
  </Icon>
);
const IcAttach = () => (
  <Icon>
    <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-1.93-1.57-3.5-3.5-3.5S8 3.07 8 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-2.5z" />
  </Icon>
);
const IcDelete = () => (
  <Icon>
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </Icon>
);
const IcArchive = () => (
  <Icon>
    <path d="M20.54 5.23 19.15 3.55A1.99 1.99 0 0 0 17.56 3H6.44c-.61 0-1.18.28-1.59.75L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5 6.5 12H10v-2h4v2h3.5L12 17.5zM5.12 5l.81-1h12l.94 1H5.12z" />
  </Icon>
);
const IcSpam = () => (
  <Icon>
    <path d="M12 2 1 21h22L12 2zm1 14h-2v-2h2v2zm0-4h-2v-4h2v4z" />
  </Icon>
);
const IcStar = ({ filled }: { filled?: boolean }) => (
  <Icon>
    {filled ? (
      <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    ) : (
      <path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z" />
    )}
  </Icon>
);
const IcReply = () => (
  <Icon size={18}>
    <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
  </Icon>
);
const IcReplyAll = () => (
  <Icon size={18}>
    <path d="M7 8V5l-7 7 7 7v-3l-4-4 4-4zm6 1V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
  </Icon>
);
const IcForward = () => (
  <Icon size={18}>
    <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z" />
  </Icon>
);
const IcCheck = () => (
  <Icon size={20}>
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
  </Icon>
);
const IcUncheck = () => (
  <Icon size={20}>
    <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
  </Icon>
);
const IcEdit = () => (
  <Icon size={20}>
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
  </Icon>
);
const IcPaperclip = () => (
  <Icon size={16}>
    <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-1.93-1.57-3.5-3.5-3.5S8 3.07 8 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-2.5z" />
  </Icon>
);

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

function sizeLabel(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uniqueAddresses(values: string[], skip: string[] = []): string[] {
  const blocked = new Set(skip.map((item) => item.trim().toLowerCase()).filter(Boolean));
  const out: string[] = [];
  for (const value of values) {
    const address = value.trim();
    const key = address.toLowerCase();
    if (!address.includes('@') || blocked.has(key) || out.some((item) => item.toLowerCase() === key)) continue;
    out.push(address);
  }
  return out;
}

function parseAddressList(value: string): string[] {
  return uniqueAddresses(value.split(/[,;\s]+/).filter(Boolean));
}

function displayName(address: string): string {
  const personal = /"([^"]+)"/.exec(address)?.[1];
  if (personal) return personal;
  const angle = /<([^>]+)>/.exec(address)?.[1];
  const raw = (angle || address).trim();
  const local = raw.split('@')[0] || raw;
  return local.replace(/[._]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function avatarLetter(address: string): string {
  const name = displayName(address).trim();
  return (name.charAt(0) || '?').toUpperCase();
}

function avatarColor(address: string): string {
  let hash = 0;
  for (let i = 0; i < address.length; i += 1) hash = (hash + address.charCodeAt(i) * (i + 1)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

type ChipFieldProps = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  trailing?: ReactNode;
};

function ChipField({ label, value, onChange, placeholder, trailing }: ChipFieldProps) {
  const [draft, setDraft] = useState('');
  const chips = parseAddressList(value);

  function commit(raw: string) {
    const next = uniqueAddresses([...chips, ...parseAddressList(raw)]);
    onChange(next.join(', '));
    setDraft('');
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',' || event.key === ';' || event.key === 'Tab') {
      if (draft.trim()) {
        event.preventDefault();
        commit(draft);
      }
    } else if (event.key === 'Backspace' && !draft && chips.length) {
      onChange(chips.slice(0, -1).join(', '));
    }
  }

  return (
    <div className="gmail-compose-field">
      <span className="gmail-compose-label">{label}</span>
      <div className="gmail-chip-row">
        {chips.map((chip) => (
          <span className="gmail-chip" key={chip.toLowerCase()}>
            <span className="gmail-chip-avatar" style={{ background: avatarColor(chip) }}>
              {avatarLetter(chip)}
            </span>
            <span className="gmail-chip-text">{chip}</span>
            <button
              type="button"
              className="gmail-chip-x"
              aria-label={`Remove ${chip}`}
              onClick={() => onChange(chips.filter((item) => item.toLowerCase() !== chip.toLowerCase()).join(', '))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="gmail-chip-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (draft.trim()) commit(draft);
          }}
          placeholder={chips.length ? '' : placeholder}
          aria-label={label}
        />
        {trailing}
      </div>
    </div>
  );
}

export function MailBox({ onPasswordReset }: MailBoxProps) {
  const staff = loadStaffSession();
  const [mail, setMail] = useState<MailLink | null>(() => staff?.mail || null);
  const [email, setEmail] = useState(staff?.email || '');
  const [password, setPassword] = useState('');
  const [folder, setFolder] = useState<MailFolderId>('inbox');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [items, setItems] = useState<MailItem[]>([]);
  const [mailOffset, setMailOffset] = useState(0);
  const [hasMoreMail, setHasMoreMail] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [threadStack, setThreadStack] = useState<MailItem[]>([]);
  const [open, setOpen] = useState<(MailDetail & { starred?: boolean; isConversation?: boolean }) | null>(null);
  const PAGE_SIZE = 50;
  const [preview, setPreview] = useState<{ part: MailPart; url: string; name: string; type: string; base64: string } | null>(null);
  const [composing, setComposing] = useState(false);
  const [settings, setSettings] = useState(false);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [origId, setOrigId] = useState('');
  const [replyType, setReplyType] = useState<'r' | 'w' | ''>('');
  const [attachments, setAttachments] = useState<MailAttachment[]>([]);
  const [signature, setSignature] = useState(() => (staff?.email ? loadSignature(staff.email) : ''));
  const [includeSignature, setIncludeSignature] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const draftHtml = useRef('');
  const autoConnectDone = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      onPasswordReset(
        `Your mailbox password had expired and was reset to ${standardMailboxPassword()}. Use that password the next time a mailbox sign-in is required.`,
      );
    }
  }

  async function refreshMailToken(current: MailLink): Promise<MailLink | null> {
    const preferDelegate =
      current.via === 'delegate' ||
      staff?.authVia === 'lms' ||
      Boolean(staff?.eboardVerified) ||
      !current.password;
    const sessionPassword = current.password || (!preferDelegate ? staff?.password || standardMailboxPassword() : '');
    const opened = await openMailboxForOfficer(current.email, sessionPassword, preferDelegate);
    if (!opened.ok) {
      setError(opened.message);
      return null;
    }
    const next: MailLink = {
      email: opened.email,
      token: opened.token,
      password: opened.password || (opened.via === 'password' ? sessionPassword : ''),
      via: opened.via || (preferDelegate ? 'delegate' : 'password'),
    };
    storeMail(next, opened.passwordReset);
    return next;
  }

  async function tokenFor(action: (token: string) => Promise<{ ok: boolean; xml: string; authFailed: boolean; detail: string }>) {
    const current = mail || loadStaffSession()?.mail || null;
    if (!current) return null;
    let result = await action(current.token);
    if (!result.authFailed) return result;
    const refreshed = await refreshMailToken(current);
    if (!refreshed) return null;
    return action(refreshed.token);
  }

  async function loadFolder(
    nextFolder: MailFolderId,
    link: MailLink | null = mail,
    options: { searchText?: string; append?: boolean; offset?: number } = {},
  ) {
    if (!link) return;
    const folderQuery = MAIL_FOLDERS.find((item) => item.id === nextFolder)?.query || 'in:inbox';
    const searchText = options.searchText ?? searchApplied;
    const offset = options.offset ?? 0;
    const query = buildMailQuery(folderQuery, searchText);
    const types = nextFolder === 'drafts' ? 'message' : 'conversation';
    setBusy(true);
    setError('');
    const result = await tokenFor((token) =>
      listMail(token, { query, limit: PAGE_SIZE, offset, types }),
    );
    setBusy(false);
    if (!result) return;
    if (!result.ok) {
      setError(result.detail);
      if (!options.append) setItems([]);
      return;
    }
    const parsed = parseMessages(result.xml);
    setItems((current) => (options.append ? [...current, ...parsed] : parsed));
    setMailOffset(offset + parsed.length);
    setHasMoreMail(parsed.length >= PAGE_SIZE);
    if (!options.append) setSelected([]);
    setThreadStack([]);
  }

  async function runSearch(event?: FormEvent) {
    event?.preventDefault();
    setSearchApplied(search.trim());
    await loadFolder(folder, mail, { searchText: search.trim(), offset: 0 });
  }

  async function loadMoreMail() {
    await loadFolder(folder, mail, { append: true, offset: mailOffset });
  }

  async function connectMailbox(targetEmail: string, mailboxPassword = '', preferDelegate = false) {
    setConnecting(true);
    setError('');
    const opened = await openMailboxForOfficer(targetEmail, mailboxPassword, preferDelegate);
    setConnecting(false);
    if (!opened.ok) {
      setError(opened.message);
      return false;
    }
    storeMail(
      {
        email: opened.email,
        token: opened.token,
        password: opened.password,
        via: opened.via || (opened.password ? 'password' : 'delegate'),
      },
      opened.passwordReset,
    );
    setMessage(`Mailbox ${opened.email} is connected on this phone.`);
    return true;
  }

  useEffect(() => {
    if (autoConnectDone.current) return;
    const current = loadStaffSession();
    if (!current || !isUwezoMailbox(current.email)) return;
    if (current.mail?.token) {
      autoConnectDone.current = true;
      return;
    }
    autoConnectDone.current = true;
    void (async () => {
      const preferDelegate =
        current.authVia === 'lms' ||
        Boolean(current.eboardVerified) ||
        current.mail?.via === 'delegate' ||
        !current.mail?.password;
      const pwd = preferDelegate
        ? ''
        : current.mail?.password || current.password || standardMailboxPassword();
      await connectMailbox(current.email, pwd, preferDelegate);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mail) return;
    void loadFolder(folder, mail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, mail?.email, mail?.token]);

  useEffect(() => {
    if (!composing || !editorRef.current) return;
    if (draftHtml.current) {
      editorRef.current.innerHTML = draftHtml.current;
      draftHtml.current = '';
    }
  }, [composing]);

  async function connect(event: FormEvent) {
    event.preventDefault();
    await connectMailbox(email, password);
    setPassword('');
  }

  function format(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }

  function resetComposeFields() {
    setTo('');
    setCc('');
    setBcc('');
    setShowCc(false);
    setShowBcc(false);
    setSubject('');
    setOrigId('');
    setReplyType('');
    setAttachments([]);
    if (editorRef.current) editorRef.current.innerHTML = '';
  }

  function startCompose(next?: {
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    html?: string;
    origId?: string;
    replyType?: 'r' | 'w';
  }) {
    setPreview(null);
    setOpen(null);
    setSettings(false);
    setDrawerOpen(false);
    setComposing(true);
    setError('');
    setTo(next?.to || '');
    setCc(next?.cc || '');
    setBcc(next?.bcc || '');
    setShowCc(Boolean(next?.cc));
    setShowBcc(Boolean(next?.bcc));
    setSubject(next?.subject || '');
    setOrigId(next?.origId || '');
    setReplyType(next?.replyType || '');
    setAttachments([]);
    draftHtml.current = next?.html || '';
    if (editorRef.current) editorRef.current.innerHTML = next?.html || '';
  }

  function startReply(detail: MailDetail, all: boolean) {
    const self = mail?.email || '';
    const toList = uniqueAddresses([detail.from], [self]);
    const ccList = all ? uniqueAddresses([...detail.to, ...detail.cc], [self, ...toList]) : [];
    startCompose({
      to: toList.join(', '),
      cc: ccList.join(', '),
      subject: replySubject(detail.subject),
      html: quoteHtml(detail),
      origId: detail.id,
      replyType: 'r',
    });
  }

  async function startForward(detail: MailDetail) {
    startCompose({
      to: '',
      subject: forwardSubject(detail.subject),
      html: quoteForwardHtml(detail),
      origId: detail.id,
      replyType: 'w',
    });
    if (!detail.attachments.length) return;
    setBusy(true);
    setError('');
    const current = mail || loadStaffSession()?.mail || null;
    if (!current) {
      setBusy(false);
      return;
    }
    const next: MailAttachment[] = [];
    for (const part of detail.attachments.slice(0, 5)) {
      let result = await fetchAttachment(current.token, detail.id, part.part);
      if (result.authFailed) {
        const refreshed = await refreshMailToken(current);
        if (!refreshed) break;
        result = await fetchAttachment(refreshed.token, detail.id, part.part);
      }
      if (result.ok && result.base64) {
        next.push({
          name: result.name || part.name,
          type: result.type || part.type || 'application/octet-stream',
          base64: result.base64,
        });
      }
    }
    setAttachments(next);
    setBusy(false);
    if (next.length) setMessage(`Forwarding with ${next.length} attachment(s).`);
  }

  function discardCompose() {
    const hasContent =
      Boolean(to.trim() || cc.trim() || bcc.trim() || subject.trim() || attachments.length) ||
      Boolean(editorRef.current?.innerText.trim());
    if (hasContent && !window.confirm('Discard this message?')) return;
    setComposing(false);
    resetComposeFields();
    setMessage('Draft discarded.');
  }

  function payload(): MailPayload | null {
    const html = cleanHtml(editorRef.current?.innerHTML || '');
    const text = editorRef.current?.innerText.trim() || '';
    if (!to.includes('@') || !subject.trim() || !text) {
      setError('Enter the recipient, subject, and message.');
      return null;
    }
    const signatureFile = includeSignature ? splitDataUrl(signature) : null;
    const withSignature = signatureFile
      ? html.includes('cid:signature@uwezo')
        ? html
        : `${html}<p><img src="cid:signature@uwezo" alt="Signature" style="max-width:240px"></p>`
      : html;
    return {
      to: to.trim(),
      cc: cc.trim(),
      bcc: bcc.trim(),
      subject: subject.trim(),
      html: withSignature,
      attachments,
      signature: signatureFile,
      origId: origId || undefined,
      replyType: replyType || undefined,
    };
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
    setMessage(draft ? 'Draft saved.' : attachments.length ? 'Message sent with attachments.' : 'Message sent.');
    setComposing(false);
    resetComposeFields();
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
    const conversation = folder !== 'drafts';
    const result = await tokenFor((token) => moveMail(token, ids, op, conversation));
    setBusy(false);
    if (!result) return;
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    setMessage(ids.length === 1 ? 'Message deleted.' : `${ids.length} messages deleted.`);
    setOpen(null);
    setPreview(null);
    setSelected([]);
    void loadFolder(folder);
  }

  async function act(op: 'trash' | 'spam' | 'archive' | 'delete') {
    if (!open) return;
    setBusy(true);
    setError('');
    const conversation = Boolean(open.isConversation) || folder !== 'drafts';
    const result = await tokenFor((token) => moveMail(token, open.id, op, conversation && op !== 'delete'));
    setBusy(false);
    if (!result) return;
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    const labels = { trash: 'Moved to Deleted.', spam: 'Moved to Spam.', archive: 'Archived.', delete: 'Deleted.' };
    setMessage(labels[op]);
    setOpen(null);
    setPreview(null);
    void loadFolder(folder);
  }

  async function toggleStar(id: string, currentlyStarred: boolean) {
    setBusy(true);
    setError('');
    const conversation = folder !== 'drafts';
    const result = await tokenFor((token) => flagMail(token, id, !currentlyStarred, conversation));
    setBusy(false);
    if (!result) return;
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    setItems((current) => current.map((row) => (row.id === id ? { ...row, starred: !currentlyStarred } : row)));
    setOpen((current) => (current && current.id === id ? { ...current, starred: !currentlyStarred } : current));
  }

  async function openItem(item: MailItem) {
    setBusy(true);
    setError('');
    setPreview(null);
    setThreadStack([]);

    if (folder === 'drafts') {
      const result = await tokenFor((token) => readMail(token, item.id));
      setBusy(false);
      if (!result) return;
      if (!result.ok) {
        setError(result.detail);
        return;
      }
      const detail = parseMessageDetail(result.xml, item);
      startCompose({
        to: detail.to.join(', '),
        cc: detail.cc.join(', '),
        subject: detail.subject,
        html: detail.html || `<p>${detail.body}</p>`,
        origId: detail.id,
      });
      setMessage('Draft opened for editing.');
      return;
    }

    if (item.isConversation) {
      const result = await tokenFor((token) => readConversation(token, item.id));
      setBusy(false);
      if (!result) return;
      if (!result.ok) {
        setError(result.detail);
        return;
      }
      const thread = parseMessages(result.xml);
      if (!thread.length) {
        setError('Could not load this conversation.');
        return;
      }
      setThreadStack(thread);
      const newest = thread[0];
      setBusy(true);
      const msg = await tokenFor((token) => readMail(token, newest.id));
      setBusy(false);
      if (!msg?.ok) {
        setError(msg?.detail || 'Could not open the conversation message.');
        return;
      }
      const detail = parseMessageDetail(msg.xml, newest);
      setOpen({ ...detail, starred: item.starred || newest.starred, isConversation: true });
      setComposing(false);
      setItems((current) => current.map((row) => (row.id === item.id ? { ...row, unread: false } : row)));
      return;
    }

    const result = await tokenFor((token) => readMail(token, item.id));
    setBusy(false);
    if (!result) return;
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    const detail = parseMessageDetail(result.xml, item);
    setOpen({ ...detail, starred: item.starred });
    setComposing(false);
    setItems((current) => current.map((row) => (row.id === item.id ? { ...row, unread: false } : row)));
  }

  async function bulkAct(op: 'trash' | 'spam' | 'archive' | 'read' | 'unread' | 'flag' | '!flag') {
    if (!selected.length) {
      setError('Select one or more messages first.');
      return;
    }
    const conversation = folder !== 'drafts';
    setBusy(true);
    setError('');
    let result;
    if (op === 'read' || op === 'unread') {
      result = await tokenFor((token) => markMailRead(token, selected, op === 'read', conversation));
    } else if (op === 'flag' || op === '!flag') {
      result = await tokenFor((token) => flagMail(token, selected, op === 'flag', conversation));
    } else {
      result = await tokenFor((token) => moveMail(token, selected, op, conversation));
    }
    setBusy(false);
    if (!result) return;
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    setMessage(`${selected.length} conversation(s) updated.`);
    setSelected([]);
    void loadFolder(folder);
  }

  async function openAttachment(part: MailPart) {
    if (!open) return;
    setBusy(true);
    setError('');
    const current = mail || loadStaffSession()?.mail || null;
    if (!current) {
      setBusy(false);
      setError('Sign in to the mailbox again.');
      return;
    }
    let result = await fetchAttachment(current.token, open.id, part.part);
    if (result.authFailed) {
      const refreshed = await refreshMailToken(current);
      if (!refreshed) {
        setBusy(false);
        return;
      }
      result = await fetchAttachment(refreshed.token, open.id, part.part);
    }
    setBusy(false);
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    const type = result.type || part.type || 'application/octet-stream';
    const name = result.name || part.name;
    setPreview({
      part,
      name,
      type,
      base64: result.base64,
      url: attachmentDataUrl(type, result.base64),
    });
    setMessage(`${name} is ready to preview or download.`);
  }

  async function downloadPreview() {
    if (!preview) return;
    setBusy(true);
    const result = await saveOrShareFile(preview.name, preview.type, preview.base64);
    setBusy(false);
    setMessage(result.detail);
    if (!result.ok) setError(result.detail);
  }

  async function addAttachments(files: FileList | null) {
    if (!files?.length) return;
    const next = [...attachments];
    for (const file of [...files]) {
      if (next.length >= 5) {
        setError('Attach up to 5 files.');
        break;
      }
      if (file.size > 5_000_000) {
        setError(`${file.name} is larger than 5 MB.`);
        continue;
      }
      const dataUrl = await readFile(file);
      const parsed = splitDataUrl(dataUrl);
      if (!parsed) {
        setError(`${file.name} could not be read.`);
        continue;
      }
      next.push({ ...parsed, name: file.name, type: file.type || parsed.type });
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
      <div className="gmail-shell">
        <header className="gmail-topbar">
          <div className="gmail-search-pill">
            <span className="gmail-menu-icon" aria-hidden>
              <IcMenu />
            </span>
            <span className="gmail-search-placeholder">Search in mail</span>
          </div>
        </header>
        <div className="gmail-connect">
          {connecting || busy ? (
            <p className="gmail-status">Opening mailbox for {staff.email}…</p>
          ) : (
            <>
              <h2>Mail</h2>
              <p>
                {staff.authVia === 'lms' || staff.eboardVerified
                  ? 'Mail opens for this same address so you can read and send as yourself.'
                  : 'Enter the mail.govmail.ke password if needed, or open the mailbox for this address.'}
              </p>
              {error ? <p className="gmail-error">{error}</p> : null}
              <button
                type="button"
                className="gmail-primary-btn"
                disabled={connecting}
                onClick={() =>
                  void connectMailbox(
                    staff.email,
                    staff.mail?.password || '',
                    staff.authVia === 'lms' || Boolean(staff.eboardVerified) || !staff.mail?.password,
                  )
                }
              >
                Open my mailbox
              </button>
              <form className="gmail-connect-form" onSubmit={(event) => void connect(event)}>
                <label>
                  Mailbox
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@uwezo.go.ke" />
                </label>
                <label>
                  Password (optional)
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                </label>
                <button type="submit" className="gmail-text-btn" disabled={connecting}>
                  Open with mailbox password
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    );
  }

  const folderLabel = MAIL_FOLDERS.find((item) => item.id === folder)?.label || 'Inbox';
  const filtered = items;
  const selecting = selected.length > 0;

  return (
    <div className="gmail-shell">
      {drawerOpen ? (
        <button type="button" className="gmail-drawer-backdrop" aria-label="Close menu" onClick={() => setDrawerOpen(false)} />
      ) : null}
      <aside className={`gmail-drawer ${drawerOpen ? 'is-open' : ''}`}>
        <div className="gmail-drawer-brand">
          <span className="gmail-brand-mark">M</span>
          <div>
            <strong>Mail</strong>
            <small>{mail.email}</small>
          </div>
        </div>
        {mail.via === 'delegate' || staff.authVia === 'lms' || staff.eboardVerified ? (
          <p className="gmail-drawer-note">Opened for this signed-in session</p>
        ) : null}
        <nav className="gmail-drawer-nav">
          {MAIL_FOLDERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === folder ? 'is-active' : ''}
              onClick={() => {
                setFolder(item.id);
                setOpen(null);
                setPreview(null);
                setComposing(false);
                setSettings(false);
                setDrawerOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setSettings(true);
              setComposing(false);
              setOpen(null);
              setDrawerOpen(false);
            }}
          >
            Signature
          </button>
        </nav>
      </aside>

      {!composing ? (
        <header className="gmail-topbar">
          {selecting ? (
            <div className="gmail-select-bar">
              <button type="button" className="gmail-icon-btn" onClick={() => setSelected([])} aria-label="Clear selection">
                <IcBack />
              </button>
              <strong>{selected.length}</strong>
              <button type="button" className="gmail-icon-btn" disabled={busy} onClick={() => void bulkAct('archive')} aria-label="Archive">
                <IcArchive />
              </button>
              <button type="button" className="gmail-icon-btn" disabled={busy} onClick={() => void bulkAct('spam')} aria-label="Spam">
                <IcSpam />
              </button>
              <button type="button" className="gmail-icon-btn" disabled={busy} onClick={() => void removeIds(selected)} aria-label="Delete">
                <IcDelete />
              </button>
              <button type="button" className="gmail-icon-btn" disabled={busy} onClick={() => void bulkAct('read')} aria-label="Mark read">
                <IcCheck />
              </button>
              <button type="button" className="gmail-text-btn" disabled={busy} onClick={() => void bulkAct('unread')}>
                Unread
              </button>
              <button type="button" className="gmail-icon-btn" disabled={busy} onClick={() => void bulkAct('flag')} aria-label="Star">
                <IcStar filled />
              </button>
            </div>
          ) : (
            <form className="gmail-search-pill" onSubmit={(event) => void runSearch(event)}>
              <button type="button" className="gmail-icon-btn" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
                <IcMenu />
              </button>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Search in ${folderLabel}`}
                aria-label="Search mail"
              />
              <button type="submit" className="gmail-text-btn" disabled={busy}>
                Search
              </button>
              {searchApplied ? (
                <button
                  type="button"
                  className="gmail-text-btn"
                  onClick={() => {
                    setSearch('');
                    setSearchApplied('');
                    void loadFolder(folder, mail, { searchText: '', offset: 0 });
                  }}
                >
                  Clear
                </button>
              ) : (
                <span className="gmail-avatar gmail-avatar--sm" style={{ background: avatarColor(mail.email) }}>
                  {avatarLetter(mail.email)}
                </span>
              )}
            </form>
          )}
        </header>
      ) : null}

      {message ? <p className="gmail-toast">{message}</p> : null}
      {error ? <p className="gmail-error gmail-error--banner">{error}</p> : null}

      {settings ? (
        <div className="gmail-pane">
          <button type="button" className="gmail-text-btn" onClick={() => setSettings(false)}>
            ← Back
          </button>
          <h3>Signature</h3>
          <p className="gmail-muted">Upload a picture. It is added when you send a message from this phone.</p>
          {signature ? <img src={signature} alt="Signature" className="gmail-signature-img" /> : <p className="gmail-muted">No signature saved.</p>}
          <label className="gmail-text-btn">
            Upload signature
            <input type="file" accept="image/*" hidden onChange={(event) => void chooseSignature(event.target.files?.[0] || null)} />
          </label>
          {signature ? (
            <button
              type="button"
              className="gmail-text-btn"
              onClick={() => {
                saveSignature(mail.email, '');
                setSignature('');
              }}
            >
              Remove signature
            </button>
          ) : null}
        </div>
      ) : null}

      {composing ? (
        <form className="gmail-compose" onSubmit={(event) => void submitMail(event, false)}>
          <div className="gmail-compose-bar">
            <button type="button" className="gmail-icon-btn" onClick={discardCompose} aria-label="Close">
              <IcClose />
            </button>
            <div className="gmail-compose-bar-actions">
              <button type="button" className="gmail-icon-btn" disabled={busy} onClick={(event) => void submitMail(event, true)} aria-label="Save draft">
                <span className="gmail-compose-draft-label">Draft</span>
              </button>
              <button type="button" className="gmail-icon-btn" disabled={busy} onClick={discardCompose} aria-label="Discard">
                <IcDelete />
              </button>
              <button type="submit" className="gmail-send-icon" disabled={busy} aria-label="Send">
                <IcSend />
              </button>
            </div>
          </div>

          <ChipField
            label="To"
            value={to}
            onChange={setTo}
            placeholder="Recipients"
            trailing={
              !showCc || !showBcc ? (
                <span className="gmail-compose-cc-toggles">
                  {!showCc ? (
                    <button type="button" className="gmail-text-btn" onClick={() => setShowCc(true)}>
                      Cc
                    </button>
                  ) : null}
                  {!showBcc ? (
                    <button type="button" className="gmail-text-btn" onClick={() => setShowBcc(true)}>
                      Bcc
                    </button>
                  ) : null}
                </span>
              ) : null
            }
          />
          {showCc ? <ChipField label="Cc" value={cc} onChange={setCc} placeholder="Cc" /> : null}
          {showBcc ? <ChipField label="Bcc" value={bcc} onChange={setBcc} placeholder="Bcc" /> : null}

          <div className="gmail-compose-field gmail-compose-subject">
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Subject"
              aria-label="Subject"
            />
          </div>

          <div className="gmail-toolbar">
            <button type="button" className="gmail-format-btn" onClick={() => format('bold')} aria-label="Bold">
              <strong>B</strong>
            </button>
            <button type="button" className="gmail-format-btn" onClick={() => format('italic')} aria-label="Italic">
              <em>I</em>
            </button>
            <button type="button" className="gmail-format-btn" onClick={() => format('underline')} aria-label="Underline">
              <span style={{ textDecoration: 'underline' }}>U</span>
            </button>
            <select
              aria-label="Font"
              defaultValue=""
              onChange={(event) => {
                format('fontName', event.target.value);
                event.target.value = '';
              }}
            >
              <option value="" disabled>
                Font
              </option>
              {FONTS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
            <select
              aria-label="Font size"
              defaultValue=""
              onChange={(event) => {
                format('fontSize', event.target.value);
                event.target.value = '';
              }}
            >
              <option value="" disabled>
                Size
              </option>
              {SIZES.map((size) => (
                <option key={size.value} value={size.value}>
                  {size.label}
                </option>
              ))}
            </select>
          </div>

          <div ref={editorRef} className="gmail-editor" contentEditable role="textbox" aria-label="Message" />

          {attachments.length ? (
            <div className="mail-attach-list">
              {attachments.map((file) => (
                <div className="mail-attach-row" key={`${file.name}-${file.base64.slice(0, 12)}`}>
                  <span>{file.name}</span>
                  <button type="button" className="gmail-text-btn" onClick={() => setAttachments((current) => current.filter((item) => item !== file))}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="gmail-compose-footer">
            <button type="button" className="gmail-icon-btn" onClick={() => fileInputRef.current?.click()} aria-label="Attach files">
              <IcAttach />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
              onChange={(event) => void addAttachments(event.target.files)}
            />
            <label className="gmail-sig-check">
              <input type="checkbox" checked={includeSignature} onChange={(event) => setIncludeSignature(event.target.checked)} />
              Signature
            </label>
            <button type="button" className="gmail-text-btn" disabled={busy} onClick={(event) => void submitMail(event, true)}>
              Save draft
            </button>
          </div>
        </form>
      ) : null}

      {open && !composing ? (
        <article className="gmail-read">
          <div className="gmail-read-bar">
            <button type="button" className="gmail-icon-btn" onClick={() => { setOpen(null); setPreview(null); }} aria-label="Back">
              <IcBack />
            </button>
            <div className="gmail-read-bar-spacer" />
            <button type="button" className="gmail-icon-btn" disabled={busy} onClick={() => void act('archive')} aria-label="Archive">
              <IcArchive />
            </button>
            <button type="button" className="gmail-icon-btn" disabled={busy} onClick={() => void removeIds([open.id])} aria-label="Delete">
              <IcDelete />
            </button>
            <button type="button" className="gmail-icon-btn" disabled={busy} onClick={() => void act('spam')} aria-label="Report spam">
              <IcSpam />
            </button>
            <button
              type="button"
              className={`gmail-icon-btn ${open.starred ? 'is-starred' : ''}`}
              disabled={busy}
              onClick={() => void toggleStar(open.id, Boolean(open.starred))}
              aria-label={open.starred ? 'Unstar' : 'Star'}
            >
              <IcStar filled={Boolean(open.starred)} />
            </button>
          </div>
          <h3>{open.subject}</h3>
          <div className="gmail-read-meta">
            <span className="gmail-avatar" style={{ background: avatarColor(open.from) }}>
              {avatarLetter(open.from)}
            </span>
            <div>
              <strong>{displayName(open.from)}</strong>
              <small>{open.from}</small>
              <small>
                to {open.to.join(', ') || 'me'}
                {open.cc.length ? ` · cc ${open.cc.join(', ')}` : ''}
              </small>
            </div>
            <time>{open.date}</time>
          </div>
          <div className="mail-body gmail-body" dangerouslySetInnerHTML={{ __html: cleanHtml(open.html || `<p>${open.body}</p>`) }} />
          {open.attachments.length ? (
            <div className="mail-attach-list">
              <h4>Attachments</h4>
              {open.attachments.map((part) => (
                <div className="mail-attach-row" key={part.part}>
                  <span>
                    {part.name}
                    {part.size ? ` · ${sizeLabel(part.size)}` : ''}
                  </span>
                  <button type="button" className="gmail-text-btn" disabled={busy} onClick={() => void openAttachment(part)}>
                    Preview
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {preview ? (
            <div className="mail-attach-preview">
              <h4>{preview.name}</h4>
              {preview.type.startsWith('image/') ? (
                <img src={preview.url} alt={preview.name} />
              ) : preview.type === 'application/pdf' ? (
                <iframe title={preview.name} src={preview.url} className="mail-pdf-preview" />
              ) : (
                <p className="gmail-muted">Preview is not available for this file type. Download it to open on the phone.</p>
              )}
              <div className="doc-actions">
                <button type="button" className="gmail-primary-btn" disabled={busy} onClick={() => void downloadPreview()}>
                  Download
                </button>
                <button type="button" className="gmail-text-btn" onClick={() => setPreview(null)}>
                  Close preview
                </button>
              </div>
            </div>
          ) : null}
          <div className="gmail-reply-row">
            <button type="button" className="gmail-outline-btn" disabled={busy} onClick={() => startReply(open, false)}>
              <IcReply /> Reply
            </button>
            <button type="button" className="gmail-outline-btn" disabled={busy} onClick={() => startReply(open, true)}>
              <IcReplyAll /> Reply all
            </button>
            <button type="button" className="gmail-outline-btn" disabled={busy} onClick={() => void startForward(open)}>
              <IcForward /> Forward
            </button>
            <button
              type="button"
              className="gmail-text-btn"
              disabled={busy}
              onClick={() =>
                void tokenFor((token) => markMailRead(token, open.id, false, Boolean(open.isConversation))).then((result) => {
                  if (!result) return;
                  if (!result.ok) setError(result.detail);
                  else {
                    setMessage('Marked unread.');
                    setItems((current) => current.map((row) => (row.id === open.id ? { ...row, unread: true } : row)));
                    setOpen(null);
                  }
                })
              }
            >
              Mark unread
            </button>
          </div>
          {threadStack.length > 1 ? (
            <div className="gmail-thread-stack" style={{ marginTop: '1rem' }}>
              <h4>Conversation ({threadStack.length})</h4>
              {threadStack.map((msg) => (
                <button
                  key={msg.id}
                  type="button"
                  className={`gmail-row ${msg.id === open.id ? 'is-selected' : ''} ${msg.unread ? 'is-unread' : ''}`}
                  style={{ width: '100%' }}
                  disabled={busy}
                  onClick={() => void openItem({ ...msg, isConversation: false })}
                >
                  <span className="gmail-row-copy">
                    <span className="gmail-row-top">
                      <strong>{displayName(msg.from || msg.to)}</strong>
                      <time>{msg.whenShort || msg.date}</time>
                    </span>
                    <span className="gmail-row-preview">{msg.preview || msg.subject}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </article>
      ) : null}

      {!open && !composing && !settings ? (
        <div className="gmail-list">
          <div className="gmail-list-heading">
            <h2>
              {folderLabel}
              {searchApplied ? ` · “${searchApplied}”` : ''}
            </h2>
            <button type="button" className="gmail-text-btn" disabled={busy} onClick={() => void loadFolder(folder)}>
              {busy ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {filtered.length ? (
            <>
              {filtered.map((item) => (
                <div className={`gmail-row ${item.unread ? 'is-unread' : ''} ${selected.includes(item.id) ? 'is-selected' : ''}`} key={item.id}>
                  <button type="button" className="gmail-check" aria-label={`Select ${item.subject}`} onClick={() => toggle(item.id)}>
                    {selected.includes(item.id) ? <IcCheck /> : <IcUncheck />}
                  </button>
                  <button type="button" className="gmail-row-main" onClick={() => void openItem(item)}>
                    <span className="gmail-avatar" style={{ background: avatarColor(item.from || item.to) }}>
                      {avatarLetter(item.from || item.to)}
                    </span>
                    <span className="gmail-row-copy">
                      <span className="gmail-row-top">
                        <strong>
                          {displayName(item.from || item.to)}
                          {item.threadCount && item.threadCount > 1 ? ` (${item.threadCount})` : ''}
                        </strong>
                        <time>{item.whenShort || item.date}</time>
                      </span>
                      <span className="gmail-row-subject">{item.subject}</span>
                      <span className="gmail-row-preview">
                        {item.hasAttachment ? (
                          <span className="gmail-attach-mark">
                            <IcPaperclip />
                          </span>
                        ) : null}
                        {item.preview || ' '}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`gmail-star-btn ${item.starred ? 'is-starred' : ''}`}
                    aria-label={item.starred ? 'Unstar' : 'Star'}
                    disabled={busy}
                    onClick={(event) => {
                      event.stopPropagation();
                      void toggleStar(item.id, item.starred);
                    }}
                  >
                    <IcStar filled={item.starred} />
                  </button>
                </div>
              ))}
              {hasMoreMail ? (
                <button type="button" className="gmail-outline-btn" style={{ margin: '0.75rem' }} disabled={busy} onClick={() => void loadMoreMail()}>
                  {busy ? 'Loading…' : 'Load more'}
                </button>
              ) : null}
            </>
          ) : (
            <p className="gmail-empty">{busy ? 'Loading mail…' : `No messages in ${folderLabel}.`}</p>
          )}
        </div>
      ) : null}

      {!composing && !open ? (
        <button type="button" className="gmail-fab" onClick={() => startCompose()} aria-label="Compose">
          <IcEdit />
          Compose
        </button>
      ) : null}
    </div>
  );
}
