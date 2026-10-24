import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import logo from '../assets/uwezo-fund-logo.png';
import { LINKS } from '../config';
import {
  assignApplicationNumber,
  createPacket,
  emptyDraft,
  emptyMember,
  fileSlots,
  MAJUU_MEMBER_FILE_SLOTS,
  listPackets,
  pushPacket,
  validateDraft,
  type ApplicationDraft,
  type FileSlot,
  type OfflinePacket,
  type OfflineProduct,
  type StoredFile,
} from '../lib/offlineApply';
import type { PortalId } from '../lib/portalStatus';
import { constituencyChoices, countyChoices, wardChoices } from '../lib/locations';
import {
  guaranteeConsentMessage,
  memberConsentMessage,
  newConsentCode,
  sendEbisSms,
  termsConsentMessage,
} from '../lib/ebisSms';
import { inferGender } from '../lib/genderFromName';
import { GROUP_BANKS, loadGroupBankBranches, type BankBranches } from '../lib/groupBanks';
import { checkMseaHealth, findMseaChairPartners, isMseaChairPartner, lookupMsea, phonesFromRecord } from '../lib/msea';
import { loadPendingLogin } from '../lib/pendingLogin';
import { probeOrigin } from '../lib/portalStatus';
import { searchAgencies, type AgencyHit } from '../lib/registries';
import { getActiveSession } from '../lib/session';

type OfflineApplyProps = {
  portal: PortalId;
  onBack: () => void;
};

const PRODUCT: Record<PortalId, OfflineProduct> = {
  loans: 'core',
  majuu: 'majuu',
};

const LOAN_STEPS = [
  'Group data',
  'Group members',
  'Loan conditions',
  'Proposed business',
  'Member confirmation',
  'Confirmations',
  'Documents',
  'Review',
];

const MAJUU_STEPS = [
  'Group Information',
  'Membership Profile',
  'Brief Background',
  'Member Details',
  'Loan Amount',
  'Terms & Conditions',
  'Bank Account',
  'Repayment Commitment',
  'Upload Documents',
  'Review',
];

const LOAN_FILE_BYTES = 30 * 1024 * 1024;
const MAJUU_FILE_BYTES = 10 * 1024 * 1024;

function stepsFor(product: OfflineProduct) {
  return product === 'majuu' ? MAJUU_STEPS : LOAN_STEPS;
}

export function OfflineApply({ portal, onBack }: OfflineApplyProps) {
  const product = PRODUCT[portal];
  const link = portal === 'majuu' ? LINKS.majuu : LINKS.loans;
  const steps = stepsFor(product);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ApplicationDraft>(() => emptyDraft(product));
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [saved, setSaved] = useState<OfflinePacket[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [agencies, setAgencies] = useState<AgencyHit[]>([]);
  const [registryNote, setRegistryNote] = useState('');
  const [mseaReachable, setMseaReachable] = useState<boolean | null>(product === 'majuu' ? null : false);
  const [mseaReason, setMseaReason] = useState('');
  const [bankBranches, setBankBranches] = useState<BankBranches>({});
  const [editingId, setEditingId] = useState('');

  useEffect(() => {
    if (product !== 'majuu') return;
    let cancelled = false;
    void checkMseaHealth().then((health) => {
      if (cancelled) return;
      setMseaReachable(health.reachable);
      setMseaReason(health.reachable ? '' : health.reason);
    });
    return () => {
      cancelled = true;
    };
  }, [product]);

  useEffect(() => {
    void listPackets().then((rows) => setSaved(rows.filter((row) => row.product === product)));
  }, [product]);

  useEffect(() => {
    if (product !== 'majuu' || steps[step] !== 'Bank Account') return;
    let cancelled = false;
    void loadGroupBankBranches()
      .then((rows) => {
        if (!cancelled) setBankBranches(rows);
      })
      .catch(() => {
        if (!cancelled) setRegistryNote('Bank branches did not load. Choose the bank, then type the branch.');
      });
    return () => {
      cancelled = true;
    };
  }, [product, step, steps]);

  function genderTotals(members: ApplicationDraft['members']) {
    const named = members.filter((member) => member.name.trim());
    return {
      totalMales: String(named.filter((member) => member.gender === 'Male').length),
      totalFemales: String(named.filter((member) => member.gender === 'Female').length),
    };
  }

  function setMember(index: number, patch: Partial<ApplicationDraft['members'][number]>, recount = false) {
    setDraft((current) => {
      const members = current.members.map((member, memberIndex) =>
        memberIndex === index ? { ...member, ...patch } : member,
      );
      return recount ? { ...current, members, ...genderTotals(members) } : { ...current, members };
    });
  }

  async function onFile(slot: FileSlot, list: FileList | null, memberIndex?: number) {
    const file = list?.[0];
    const same = (item: StoredFile) => item.slot === slot && item.memberIndex === memberIndex;
    if (!file) {
      setFiles((current) => current.filter((item) => !same(item)));
      return;
    }
    const limit = product === 'core' ? LOAN_FILE_BYTES : MAJUU_FILE_BYTES;
    if (file.size > limit) {
      setError(
        product === 'core'
          ? 'Each loan file must be 30 MB or smaller. JPG, PNG, or PDF.'
          : 'Each file must be 10 MB or smaller. JPG, PNG, or PDF.',
      );
      return;
    }
    const buffer = await file.arrayBuffer();
    setFiles((current) => [
      ...current.filter((item) => !same(item)),
      { slot, name: file.name, type: file.type, buffer, memberIndex },
    ]);
    setError('');
  }

  async function runMseaLookup() {
    setBusy(true);
    setRegistryNote('');
    const phone = getActiveSession()?.phone || loadPendingLogin()?.phone || '';
    const result = await lookupMsea(draft.registrationNumber, phone);
    setBusy(false);
    if (!result.available) {
      setDraft((current) => ({ ...current, mseaStatus: 'manual' }));
      setRegistryNote(result.message);
      return;
    }
    const partners = result.record.partners || [];
    const chairs = findMseaChairPartners(partners);
    const phones = phonesFromRecord(result.record);
    const members = partners.length
      ? partners.map((partner) => {
          const chair = isMseaChairPartner(partner);
          return {
            ...emptyMember(),
            name: partner.name || '',
            nationalId: (partner.id_number || '').replace(/\D/g, ''),
            phone: partner.phone_number || '',
            email: chair ? result.record.email || '' : '',
            gender: inferGender(partner.name || ''),
            position: partner.type || (chair ? 'Chair' : ''),
            purpose: 'Travelling Abroad for Work',
          };
        })
      : null;
    setDraft((current) => ({
      ...current,
      mseaStatus: 'found',
      groupName: result.record.business_name || current.groupName,
      registrationNumber: result.record.registration_number || current.registrationNumber,
      registrationDate: result.record.registration_date || current.registrationDate,
      contactPhone: phones[0] || current.contactPhone,
      mseaMemberCount: partners.length ? String(partners.length) : current.mseaMemberCount,
      mseaPhones: phones.join(','),
      mseaChairIds: chairs.map((chair) => (chair.id_number || '').replace(/\D/g, '')).filter(Boolean).join(','),
      mseaChairPhones: chairs.map((chair) => chair.phone_number || '').filter(Boolean).join(','),
      members: members && members.length ? members : current.members,
      ...(members && members.length ? genderTotals(members) : {}),
    }));
    setRegistryNote(
      partners.length
        ? `MSEA registration lists ${partners.length} member${partners.length === 1 ? '' : 's'}. Males, females, and PWD counts must add up to this total.`
        : 'MSEA found this registration.',
    );
  }

  async function runAgencySearch() {
    setBusy(true);
    const result = await searchAgencies(draft.agentNumber.trim() || draft.agency);
    setBusy(false);
    setAgencies(result.results);
    setRegistryNote(
      result.available
        ? result.results.length
          ? ''
          : 'No licensed agency matched. You can continue with the name you typed.'
        : result.message,
    );
  }

  async function sendMemberConsents(source = draft) {
    const next = source.members.map((member) => ({ ...member }));
    let sent = 0;
    let failed = 0;
    for (let index = 0; index < next.length; index += 1) {
      const member = next[index];
      if (!member.name.trim() || !member.phone.trim() || member.consentStatus === 'verified') continue;
      const code = member.consentCode || newConsentCode();
      const result = await sendEbisSms(
        member.phone,
        memberConsentMessage(member.name, member.loanAmount || '0', code),
      );
      if (result.ok) {
        next[index] = { ...member, consentCode: code, consentStatus: 'sent' };
        sent += 1;
      } else {
        failed += 1;
      }
    }
    setDraft((current) => ({ ...current, members: next }));
    return { sent, failed, members: next };
  }

  async function sendTermsNotices(source = draft) {
    const total = source.members.reduce((sum, member) => sum + Number(member.loanAmount || 0), 0);
    let sent = 0;
    for (const member of source.members) {
      if (!member.name.trim() || !member.phone.trim()) continue;
      const result = await sendEbisSms(member.phone, termsConsentMessage(member.name, source.groupName, String(total)));
      if (result.ok) sent += 1;
    }
    if (sent > 0) setDraft((current) => ({ ...current, termsSent: true }));
    return sent;
  }

  async function sendGuaranteeNotices(source = draft) {
    let sent = 0;
    for (const member of source.members) {
      if (!member.name.trim() || !member.phone.trim()) continue;
      const result = await sendEbisSms(member.phone, guaranteeConsentMessage(member.name, source.groupName));
      if (result.ok) sent += 1;
    }
    return sent;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    let ready = { ...draft, proposedNumber: draft.proposedNumber || assignApplicationNumber(product) };
    const errors = validateDraft(ready, files);
    if (errors.length) {
      setError(errors[0]);
      setMessage('');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (product === 'majuu') {
        const majuuUp = await probeOrigin(LINKS.majuu.url);
        if (majuuUp) {
          const checked = await lookupMsea(ready.registrationNumber, ready.contactPhone);
          if (checked.available) {
            const freshName = (checked.record.business_name || '').toUpperCase();
            const freshDate = checked.record.registration_date || '';
            if (freshName && ready.groupName.trim().toUpperCase() !== freshName) {
              setError(`MSEA lists this group as ${freshName}. The saved name must match before Majuu accepts it.`);
              return;
            }
            if (freshDate && ready.registrationDate && ready.registrationDate !== freshDate) {
              setError(`MSEA lists the date formed as ${freshDate}.`);
              return;
            }
          }
          const pending = ready.members.filter(
            (member) => member.name.trim() && member.phone.trim() && member.consentStatus !== 'verified',
          );
          if (pending.length) {
            const delivery = await sendMemberConsents(ready);
            ready = { ...ready, members: delivery.members };
            const stillOpen = delivery.members.filter(
              (member) => member.name.trim() && member.consentStatus === 'sent' && member.consentInput.trim() !== member.consentCode,
            );
            if (stillOpen.length) {
              setStep(MAJUU_STEPS.indexOf('Loan Amount'));
              setError('Enter the consent codes the members received, then save again.');
              return;
            }
          }
          if (!ready.termsSent) await sendTermsNotices(ready);
        }
      }
      const packet = await createPacket(ready, files, editingId);
      const sent = await pushPacket(packet);
      const number = sent.acknowledgementNumber || sent.applicationId || sent.payload.proposedNumber;
      setDraft(emptyDraft(product));
      setFiles([]);
      setEditingId('');
      setStep(0);
      setMessage(
        sent.status === 'synced'
          ? `Accepted. Application number ${number}.`
          : `Saved on this phone as ${number}. ${sent.lastError || 'It will be sent when Majuu is back. If MSEA is down at that time, Majuu still accepts it for checking in the LMS.'}`,
      );
      const rows = await listPackets();
      setSaved(rows.filter((row) => row.product === product));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this application.');
    } finally {
      setBusy(false);
    }
  }

  const title = steps[step];
  const last = step === steps.length - 1;
  const number = draft.proposedNumber || 'Assigned when you save';

  return (
    <div className="chat">
      <header className="chat-header">
        <button type="button" className="chat-back" onClick={onBack} aria-label="Back">
          ←
        </button>
        <img src={logo} alt="" className="chat-header__logo" width={36} height={36} />
        <div className="chat-header__text">
          <strong>{link.title}</strong>
          <span>
            Step {step + 1} of {steps.length}: {title}
          </span>
        </div>
      </header>

      <form className="chat-thread" onSubmit={(event) => void onSubmit(event)}>
        <p className="home-chat-note">
          You can complete this without signing in. Sign-in is tried when {link.url.replace(/^https:\/\//, '')} answers.
          The application number uses the same form as an online application.
        </p>
        {message ? <div className="bubble bubble--bot">{message}</div> : null}
        {error ? <div className="bubble bubble--system">{error}</div> : null}
        {registryNote ? <div className="bubble bubble--bot">{registryNote}</div> : null}

        {title === 'Group data' || title === 'Group Information' ? (
          <div className="account-form">
            {product === 'majuu' && mseaReachable === null ? (
              <p className="home-chat-note">Checking MSEA registration service...</p>
            ) : null}
            {product === 'majuu' && mseaReachable === false ? (
              <p className="home-chat-note">{mseaReason || 'MSEA registration service is unavailable. Please enter your group details manually.'}</p>
            ) : null}
            {product === 'majuu' && mseaReachable ? (
              <>
                <p className="home-chat-note">
                  Verify your MSEA registration number to auto-populate group details. Only the group chair listed
                  on the MSEA partners list can continue this group application; other members use individual applications.
                </p>
                <button type="button" className="btn-ghost" disabled={busy} onClick={() => void runMseaLookup()}>
                  {busy ? 'Verifying...' : 'Verify & Populate'}
                </button>
                {draft.mseaStatus !== 'found' ? (
                  <p className="home-chat-note">Verify a registered group before continuing.</p>
                ) : null}
              </>
            ) : null}
            <label>
              Group name
              <input
                value={draft.groupName}
                readOnly={product === 'majuu' && mseaReachable === true}
                onChange={(event) => setDraft({ ...draft, groupName: event.target.value })}
              />
            </label>
            <label>
              Registration number
              <input
                value={draft.registrationNumber}
                placeholder={product === 'majuu' ? 'e.g. RA-NNSRDM' : ''}
                readOnly={product === 'majuu' && mseaReachable === true && draft.mseaStatus === 'found'}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    registrationNumber: product === 'majuu' ? event.target.value.toUpperCase() : event.target.value,
                  })
                }
              />
            </label>
            <label>
              Date formed
              <input
                type="date"
                value={draft.registrationDate}
                readOnly={product === 'majuu' && mseaReachable === true}
                onChange={(event) => setDraft({ ...draft, registrationDate: event.target.value })}
              />
            </label>
            <label>
              County
              <select
                value={draft.county}
                onChange={(event) =>
                  setDraft({ ...draft, county: event.target.value, constituency: '', ward: '' })
                }
              >
                <option value="">Choose county</option>
                {countyChoices(product).map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Constituency
              <select
                value={draft.constituency}
                disabled={!draft.county}
                onChange={(event) => setDraft({ ...draft, constituency: event.target.value, ward: '' })}
              >
                <option value="">{draft.county ? 'Choose constituency' : 'Choose a county first'}</option>
                {constituencyChoices(product, draft.county).map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ward
              <select
                value={draft.ward}
                disabled={!draft.constituency}
                onChange={(event) => setDraft({ ...draft, ward: event.target.value })}
              >
                <option value="">{draft.constituency ? 'Choose ward' : 'Choose a constituency first'}</option>
                {wardChoices(product, draft.county, draft.constituency).map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>
            {product === 'majuu' ? (
              <>
                <label>
                  Location
                  <input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} />
                </label>
                <label>
                  Sub-location
                  <input
                    value={draft.subLocation}
                    onChange={(event) => setDraft({ ...draft, subLocation: event.target.value })}
                  />
                </label>
                <label>
                  Cluster category
                  <select
                    value={draft.clusterCategory}
                    onChange={(event) => setDraft({ ...draft, clusterCategory: event.target.value })}
                  >
                    <option value="">Choose cluster</option>
                    <option value="geographical">Geographical</option>
                    <option value="destination">Destination</option>
                    <option value="agency">Agency</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                {draft.clusterCategory === 'geographical' ? (
                  <>
                    <label>
                      Cluster by
                      <select
                        value={draft.geoLocationType}
                        onChange={(event) => setDraft({ ...draft, geoLocationType: event.target.value })}
                      >
                        <option value="">Choose</option>
                        <option value="county">County</option>
                        <option value="constituency">Constituency</option>
                      </select>
                    </label>
                    {draft.geoLocationType === 'county' ? (
                      <label>
                        Cluster county
                        <input
                          value={draft.clusterCounty}
                          onChange={(event) => setDraft({ ...draft, clusterCounty: event.target.value })}
                        />
                      </label>
                    ) : null}
                    {draft.geoLocationType === 'constituency' ? (
                      <label>
                        Cluster constituency
                        <input
                          value={draft.clusterConstituency}
                          onChange={(event) => setDraft({ ...draft, clusterConstituency: event.target.value })}
                        />
                      </label>
                    ) : null}
                  </>
                ) : null}
                {draft.clusterCategory === 'destination' ? (
                  <>
                    <label>
                      UN cluster / region
                      <input
                        value={draft.destinationRegion}
                        onChange={(event) => setDraft({ ...draft, destinationRegion: event.target.value })}
                      />
                    </label>
                    <label>
                      Country
                      <input
                        value={draft.destinationCountry}
                        onChange={(event) => setDraft({ ...draft, destinationCountry: event.target.value })}
                      />
                    </label>
                  </>
                ) : null}
                {draft.clusterCategory === 'agency' ? (
                  <>
                    <label>
                      Agent number
                      <input
                        value={draft.agentNumber}
                        onChange={(event) => setDraft({ ...draft, agentNumber: event.target.value })}
                      />
                    </label>
                    <label>
                      Local agent name
                      <input
                        value={draft.localAgentName}
                        onChange={(event) => setDraft({ ...draft, localAgentName: event.target.value })}
                      />
                    </label>
                    <label>
                      Agency
                      <input value={draft.agency} onChange={(event) => setDraft({ ...draft, agency: event.target.value })} />
                    </label>
                    <button type="button" className="btn-ghost" disabled={busy} onClick={() => void runAgencySearch()}>
                      Search NEAIMS agencies
                    </button>
                    {agencies.map((agency) => (
                      <button
                        type="button"
                        className="btn-ghost"
                        key={agency.neaRegNo}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            agentNumber: agency.neaRegNo,
                            agency: agency.agencyName,
                            localAgentName: agency.agencyName,
                          })
                        }
                      >
                        {agency.neaRegNo} — {agency.agencyName}
                      </button>
                    ))}
                  </>
                ) : null}
                {draft.clusterCategory === 'other' ? (
                  <label>
                    Other cluster
                    <input
                      value={draft.clusterOther}
                      onChange={(event) => setDraft({ ...draft, clusterOther: event.target.value })}
                    />
                  </label>
                ) : null}
              </>
            ) : null}
            {product === 'majuu' && mseaReachable && draft.mseaPhones ? (
              <label>
                Contact phone
                <select
                  value={draft.contactPhone}
                  onChange={(event) => setDraft({ ...draft, contactPhone: event.target.value })}
                >
                  <option value="">Choose a phone from MSEA</option>
                  {draft.mseaPhones.split(',').filter(Boolean).map((phone) => (
                    <option key={phone} value={phone}>
                      {phone}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Contact phone
                <input
                  value={draft.contactPhone}
                  inputMode="tel"
                  placeholder="07XXXXXXXX"
                  onChange={(event) => setDraft({ ...draft, contactPhone: event.target.value })}
                />
              </label>
            )}
            {product === 'core' ? (
              <>
                <label>
                  Meeting point
                  <input
                    value={draft.meetingPoint}
                    onChange={(event) => setDraft({ ...draft, meetingPoint: event.target.value })}
                  />
                </label>
                <label>
                  Nearest landmark
                  <input
                    value={draft.nearestLandmark}
                    onChange={(event) => setDraft({ ...draft, nearestLandmark: event.target.value })}
                  />
                </label>
                <label>
                  Purpose of the group
                  <textarea
                    rows={3}
                    value={draft.groupPurpose}
                    onChange={(event) => setDraft({ ...draft, groupPurpose: event.target.value })}
                  />
                </label>
                <label>
                  Key activities of the group
                  <textarea
                    rows={3}
                    value={draft.groupActivities}
                    onChange={(event) => setDraft({ ...draft, groupActivities: event.target.value })}
                  />
                </label>
                <label>
                  Value chain
                  <input value={draft.valueChain} onChange={(event) => setDraft({ ...draft, valueChain: event.target.value })} />
                </label>
                <label>
                  Other activity
                  <input value={draft.groupOther} onChange={(event) => setDraft({ ...draft, groupOther: event.target.value })} />
                </label>
                <label>
                  Years of table banking
                  <input
                    inputMode="numeric"
                    value={draft.tableBankingExperience}
                    onChange={(event) => setDraft({ ...draft, tableBankingExperience: event.target.value })}
                  />
                </label>
                <label>
                  Monthly share contribution
                  <input
                    inputMode="numeric"
                    value={draft.tableBankingShareContribution}
                    onChange={(event) => setDraft({ ...draft, tableBankingShareContribution: event.target.value })}
                  />
                </label>
                <label>
                  Total amount loaned out
                  <input
                    inputMode="numeric"
                    value={draft.tableBankingTotalLoanedOut}
                    onChange={(event) => setDraft({ ...draft, tableBankingTotalLoanedOut: event.target.value })}
                  />
                </label>
                <label>
                  Total revolving fund
                  <input
                    inputMode="numeric"
                    value={draft.tableBankingTotalRevolvingFund}
                    onChange={(event) => setDraft({ ...draft, tableBankingTotalRevolvingFund: event.target.value })}
                  />
                </label>
                <label className="btn-ghost">
                  Group credit history (optional)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      void onFile('groupCreditHistory', event.target.files)
                    }
                  />
                </label>
              </>
            ) : null}
          </div>
        ) : null}

        {title === 'Membership Profile' ? (
          <div className="account-form">
            <p className="home-chat-note">
              <strong>
                Total members:{' '}
                {Number(draft.mseaMemberCount || 0) > 0
                  ? draft.mseaMemberCount
                  : Number(draft.totalMales || 0) + Number(draft.totalFemales || 0)}
              </strong>
            </p>
            <p className="home-chat-note">
              {Number(draft.mseaMemberCount || 0) > 0
                ? `MSEA listed ${draft.mseaMemberCount} members at the start of this application. Gender can be changed. Males, females, and PWD counts must add up to that total.`
                : 'MSEA did not provide a member count. Total members are the number of males plus the number of females.'}
            </p>
            {draft.members.some((member) => member.name.trim()) ? (
              draft.members.map((member, index) =>
                member.name.trim() ? (
                  <label key={`gender-${index}`}>
                    {member.name}
                    <select
                      value={member.gender}
                      onChange={(event) => setMember(index, { gender: event.target.value }, true)}
                    >
                      <option value="">Gender</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  </label>
                ) : null,
              )
            ) : null}
            <label>
              Males
              <input
                inputMode="numeric"
                value={draft.totalMales}
                onChange={(event) => setDraft({ ...draft, totalMales: event.target.value })}
              />
            </label>
            <label>
              Females
              <input
                inputMode="numeric"
                value={draft.totalFemales}
                onChange={(event) => setDraft({ ...draft, totalFemales: event.target.value })}
              />
            </label>
            <label>
              Males with disability
              <input
                inputMode="numeric"
                value={draft.totalDisabledMales}
                onChange={(event) => setDraft({ ...draft, totalDisabledMales: event.target.value })}
              />
            </label>
            <label>
              Females with disability
              <input
                inputMode="numeric"
                value={draft.totalDisabledFemales}
                onChange={(event) => setDraft({ ...draft, totalDisabledFemales: event.target.value })}
              />
            </label>
          </div>
        ) : null}

        {title === 'Group members' || title === 'Member Details' ? (
          <div className="account-form">
            {product === 'core' ? (
              <label>
                Nature of the group
                <input
                  value={draft.natureOfGroup}
                  onChange={(event) => setDraft({ ...draft, natureOfGroup: event.target.value })}
                />
              </label>
            ) : (
              <p className="home-chat-note">Name at least 3 members. The MSEA chair, when listed, must be one of them.</p>
            )}
            {draft.members.map((member, index) => (
              <fieldset className="offline-member" key={index}>
                <legend>Member {index + 1}</legend>
                <label>
                  Name
                  <input value={member.name} onChange={(event) => setMember(index, { name: event.target.value })} />
                </label>
                <label>
                  National ID
                  <input
                    value={member.nationalId}
                    inputMode="numeric"
                    onChange={(event) => setMember(index, { nationalId: event.target.value })}
                  />
                </label>
                {product === 'core' ? (
                  <>
                    <label>
                      Gender
                      <select value={member.gender} onChange={(event) => setMember(index, { gender: event.target.value })}>
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </label>
                    <label>
                      Position
                      <input
                        value={member.position}
                        onChange={(event) => setMember(index, { position: event.target.value })}
                      />
                    </label>
                  </>
                ) : null}
                <label>
                  Phone
                  <input
                    value={member.phone}
                    inputMode="tel"
                    onChange={(event) => setMember(index, { phone: event.target.value })}
                  />
                </label>
                {product === 'core' ? (
                  <>
                    <label>
                      Economic activity
                      <input
                        value={member.economicActivity}
                        onChange={(event) => setMember(index, { economicActivity: event.target.value })}
                      />
                    </label>
                    <label>
                      PWD number
                      <input
                        value={member.pwdNumber}
                        onChange={(event) => setMember(index, { pwdNumber: event.target.value })}
                      />
                    </label>
                    <label className="btn-ghost">
                      Photo of national ID
                      <input
                        type="file"
                        accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          void onFile('photoOfId', event.target.files, index)
                        }
                      />
                    </label>
                  </>
                ) : null}
                {product === 'majuu' && title === 'Member Details' ? (
                  <>
                    <label>
                      Email
                      <input
                        type="email"
                        value={member.email}
                        onChange={(event) => setMember(index, { email: event.target.value })}
                      />
                    </label>
                    <label>
                      Passport number
                      <input
                        value={member.passportNo}
                        onChange={(event) => setMember(index, { passportNo: event.target.value })}
                      />
                    </label>
                    <label>
                      Purpose
                      <input
                        value={member.purpose}
                        onChange={(event) => setMember(index, { purpose: event.target.value })}
                      />
                    </label>
                    <label>
                      Loan amount (KES)
                      <input
                        inputMode="numeric"
                        value={member.loanAmount}
                        onChange={(event) => setMember(index, { loanAmount: event.target.value })}
                      />
                    </label>
                    <p className="home-chat-note">
                      This stage stores name, national ID, mobile, email, passport, purpose, and loan amount. Agency
                      and job placement are not stored on a member.
                    </p>
                  </>
                ) : null}
              </fieldset>
            ))}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setDraft({ ...draft, members: [...draft.members, emptyMember()] })}
            >
              Add member
            </button>
          </div>
        ) : null}

        {title === 'Loan conditions' ? (
          <div className="account-form">
            <label>
              Loan type
              <select value={draft.loanType} onChange={(event) => setDraft({ ...draft, loanType: event.target.value })}>
                <option value="Wezesha">Wezesha (50,000 to 100,000)</option>
                <option value="Endeleza">Endeleza (75,000 to 500,000)</option>
              </select>
            </label>
            <label>
              Group loan amount (KES)
              <input
                inputMode="numeric"
                value={draft.loanAmount}
                onChange={(event) => setDraft({ ...draft, loanAmount: event.target.value })}
              />
            </label>
            <label>
              Repayment period (months, 1 to 24)
              <input
                inputMode="numeric"
                value={draft.repaymentPeriod}
                onChange={(event) => setDraft({ ...draft, repaymentPeriod: event.target.value })}
              />
            </label>
            <label>
              Institution
              <select
                value={draft.institutionType}
                onChange={(event) => setDraft({ ...draft, institutionType: event.target.value })}
              >
                <option value="">Select</option>
                <option value="bank">Bank</option>
                <option value="sacco">SACCO</option>
              </select>
            </label>
            <label>
              Institution name
              <input value={draft.bankName} onChange={(event) => setDraft({ ...draft, bankName: event.target.value })} />
            </label>
            <label>
              Branch
              <input
                value={draft.bankBranch}
                onChange={(event) => setDraft({ ...draft, bankBranch: event.target.value })}
              />
            </label>
            <label>
              Account number
              <input
                value={draft.bankAccount}
                onChange={(event) => setDraft({ ...draft, bankAccount: event.target.value })}
              />
            </label>
          </div>
        ) : null}

        {title === 'Loan Amount' ? (
          <div className="account-form">
            <p className="home-chat-note">
              Each loan is from 1 to 166,666. The group total cannot exceed 500,000. Send a consent code by EBIS SMS
              when it is available. The official enters the code the member receives. If SMS cannot be sent now, enter
              the codes when this application is submitted and Majuu is reachable.
            </p>
            {draft.members.filter((member) => member.name.trim()).map((member) => {
              const index = draft.members.indexOf(member);
              return (
                <fieldset className="offline-member" key={index}>
                  <legend>{member.name}</legend>
                  <label>
                    Loan amount (KES)
                    <input
                      inputMode="numeric"
                      value={member.loanAmount}
                      onChange={(event) => setMember(index, { loanAmount: event.target.value })}
                    />
                  </label>
                  <p className="home-chat-note">
                    {member.consentStatus === 'verified'
                      ? 'Consent verified'
                      : member.consentStatus === 'sent'
                        ? 'Code sent. Enter the code from the member.'
                        : 'Consent code not sent yet.'}
                  </p>
                  {member.consentStatus !== 'verified' ? (
                    <label>
                      Consent code
                      <input
                        inputMode="numeric"
                        value={member.consentInput}
                        onChange={(event) => {
                          const consentInput = event.target.value;
                          const consentStatus =
                            member.consentCode && consentInput.trim() === member.consentCode ? 'verified' : member.consentStatus;
                          setMember(index, { consentInput, consentStatus });
                        }}
                      />
                    </label>
                  ) : null}
                </fieldset>
              );
            })}
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void sendMemberConsents().then((result) => {
                  setBusy(false);
                  setRegistryNote(
                    result.sent
                      ? `Consent codes sent to ${result.sent} member${result.sent === 1 ? '' : 's'}.`
                      : 'EBIS could not send the codes. They can be sent when you submit and Majuu is reachable.',
                  );
                });
              }}
            >
              {busy ? 'Sending codes…' : 'Send consent codes'}
            </button>
          </div>
        ) : null}

        {title === 'Proposed business' || title === 'Brief Background' ? (
          <div className="account-form">
            {title === 'Proposed business' ? (
              <>
                <label>
                  Nature of business
                  <input
                    value={draft.natureOfBusiness}
                    onChange={(event) => setDraft({ ...draft, natureOfBusiness: event.target.value })}
                  />
                </label>
                <label>
                  Business type
                  <input
                    value={draft.businessType}
                    onChange={(event) => setDraft({ ...draft, businessType: event.target.value })}
                  />
                </label>
                <label>
                  Years in business
                  <input
                    inputMode="numeric"
                    value={draft.yearsInBusiness}
                    onChange={(event) => setDraft({ ...draft, yearsInBusiness: event.target.value })}
                  />
                </label>
                <label>
                  Average income (KES)
                  <input
                    inputMode="numeric"
                    value={draft.averageIncome}
                    onChange={(event) => setDraft({ ...draft, averageIncome: event.target.value })}
                  />
                </label>
                <label>
                  Cost of goods/service per month
                  <input
                    inputMode="numeric"
                    value={draft.costOfGoods}
                    onChange={(event) => setDraft({ ...draft, costOfGoods: event.target.value })}
                  />
                </label>
                <label>
                  Rent for the business
                  <input
                    inputMode="numeric"
                    value={draft.rentForBusiness}
                    onChange={(event) => setDraft({ ...draft, rentForBusiness: event.target.value })}
                  />
                </label>
                <label>
                  Salaries/wages
                  <input
                    inputMode="numeric"
                    value={draft.salaries}
                    onChange={(event) => setDraft({ ...draft, salaries: event.target.value })}
                  />
                </label>
                <label>
                  Transport for business stock
                  <input
                    inputMode="numeric"
                    value={draft.transportForBusinessStock}
                    onChange={(event) => setDraft({ ...draft, transportForBusinessStock: event.target.value })}
                  />
                </label>
                {draft.customExpenses.map((expense, index) => (
                  <fieldset className="offline-member" key={index}>
                    <legend>Extra expense {index + 1}</legend>
                    <label>
                      Expense name
                      <input
                        value={expense.name}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            customExpenses: draft.customExpenses.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, name: event.target.value } : item,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Amount
                      <input
                        inputMode="numeric"
                        value={expense.amount}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            customExpenses: draft.customExpenses.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, amount: event.target.value } : item,
                            ),
                          })
                        }
                      />
                    </label>
                  </fieldset>
                ))}
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() =>
                    setDraft({ ...draft, customExpenses: [...draft.customExpenses, { name: '', amount: '' }] })
                  }
                >
                  Add expense
                </button>
              </>
            ) : (
              <>
                <label>
                  Purpose of the group
                  <textarea
                    rows={4}
                    value={draft.background}
                    onChange={(event) => setDraft({ ...draft, background: event.target.value })}
                  />
                </label>
                <label>
                  Proposed activities
                  <textarea
                    rows={4}
                    value={draft.proposedActivities}
                    onChange={(event) => setDraft({ ...draft, proposedActivities: event.target.value })}
                  />
                </label>
                <p className="home-chat-note">
                  This stage stores only the group purpose and proposed activities. The recruitment agency is stored
                  with the group information when the cluster is an agency.
                </p>
              </>
            )}
          </div>
        ) : null}

        {title === 'Member confirmation' ? (
          <div className="account-form">
            <p className="home-chat-note">
              When the portal is reachable, member confirmation codes are sent to this Uwezo Fund app and by SMS
              through EBIS Cloud. While the portal is down, confirm the list here and the codes are requested on sync.
            </p>
            <label className="account-check">
              <input
                type="checkbox"
                checked={draft.membersConfirmed}
                onChange={(event) => setDraft({ ...draft, membersConfirmed: event.target.checked })}
              />
              The named members are correct
            </label>
          </div>
        ) : null}

        {title === 'Confirmations' || title === 'Terms & Conditions' ? (
          <div className="account-form">
            {product === 'majuu' ? (
              <>
                <p>
                  We, the undersigned, being the members of <strong>{draft.groupName || 'this group'}</strong>, hereby
                  commit the group jointly and severally to repay{' '}
                  <strong>
                    KShs{' '}
                    {draft.members.reduce((sum, member) => sum + Number(member.loanAmount || 0), 0).toLocaleString('en-KE')}
                  </strong>
                  , being the total loan amount disbursed as per the terms and conditions listed below:
                </p>
                <ul>
                  <li>Repayment period shall be a maximum of twelve (12) months.</li>
                  <li>
                    Grace period shall not exceed one (1) month after the end of the probationary employment period,
                    where applicable.
                  </li>
                  <li>
                    Repayment shall be through check off, standing order, direct deposit into the Fund&apos;s account,
                    or any other approved method of payment.
                  </li>
                  <li>The loan shall be charged an 8% service charge of the approved loan amount, deductible upfront.</li>
                  <li>Insurance fees of 0.55% of the approved loan amount shall apply and will be deducted at disbursement.</li>
                </ul>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void sendTermsNotices().then((sent) => {
                      setBusy(false);
                      setRegistryNote(
                        sent
                          ? 'Terms consent messages were sent to members.'
                          : 'EBIS or the network could not send the terms messages. They can be sent when you submit and the servers are reachable.',
                      );
                    });
                  }}
                >
                  Send terms consent
                </button>
              </>
            ) : null}
            {product === 'majuu' ? (
              <label className="account-check">
                <input
                  type="checkbox"
                  checked={draft.termsAccepted}
                  onChange={(event) => setDraft({ ...draft, termsAccepted: event.target.checked })}
                />
                I agree to the terms and conditions
              </label>
            ) : null}
            {product === 'core' ? (
              <>
                <label className="account-check">
                  <input
                    type="checkbox"
                    checked={draft.membersConfirmed}
                    onChange={(event) => setDraft({ ...draft, membersConfirmed: event.target.checked })}
                  />
                  We confirm we are members of this group
                </label>
                <label className="account-check">
                  <input
                    type="checkbox"
                    checked={draft.correctInformationConfirm}
                    onChange={(event) => setDraft({ ...draft, correctInformationConfirm: event.target.checked })}
                  />
                  The information provided is true, and Uwezo Fund may verify it
                </label>
                <label className="account-check">
                  <input
                    type="checkbox"
                    checked={draft.liabilityConfirm}
                    onChange={(event) => setDraft({ ...draft, liabilityConfirm: event.target.checked })}
                  />
                  We are jointly and severally liable for repayment if the loan defaults
                </label>
                <label className="account-check">
                  <input
                    type="checkbox"
                    checked={draft.fundsEligibleConfirm}
                    onChange={(event) => setDraft({ ...draft, fundsEligibleConfirm: event.target.checked })}
                  />
                  We shall not be eligible for another loan until a default is cleared in full
                </label>
              </>
            ) : null}
          </div>
        ) : null}

        {title === 'Bank Account' ? (
          <div className="account-form">
            <label>
              Bank
              <select
                value={draft.bankName}
                onChange={(event) => setDraft({ ...draft, bankName: event.target.value, bankBranch: '' })}
              >
                <option value="">Choose bank</option>
                {GROUP_BANKS.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Branch
              {(bankBranches[draft.bankName] || []).length ? (
                <select
                  value={draft.bankBranch}
                  onChange={(event) => setDraft({ ...draft, bankBranch: event.target.value })}
                >
                  <option value="">Choose branch</option>
                  {(bankBranches[draft.bankName] || []).map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={draft.bankBranch}
                  placeholder={draft.bankName ? 'Type the branch' : 'Choose a bank first'}
                  onChange={(event) => setDraft({ ...draft, bankBranch: event.target.value })}
                />
              )}
            </label>
            <label>
              Account name
              <input
                value={draft.bankAccountName}
                onChange={(event) => setDraft({ ...draft, bankAccountName: event.target.value })}
              />
            </label>
            <label>
              Account number
              <input
                value={draft.bankAccount}
                onChange={(event) => setDraft({ ...draft, bankAccount: event.target.value })}
              />
            </label>
          </div>
        ) : null}

        {title === 'Repayment Commitment' ? (
          <div className="account-form">
            <p>We the undersigned hereby:</p>
            <ol>
              <li>(i) Confirm that we are members of the {draft.groupName || 'group'} group.</li>
              <li>(ii) Declare that the information provided herein is true to the best of our knowledge.</li>
              <li>(iii) We further authorize Uwezo Fund to verify the information and reference provided here-in.</li>
              <li>(iv) We agree that jointly and severally we are liable for repayment of the loan.</li>
              <li>(v) In the event of default, we shall be subjected to the terms and conditions of this loan.</li>
              <li>(vi) We shall not be eligible for additional loans until the amount in default has been cleared in full.</li>
            </ol>
            {draft.members.filter((member) => member.name.trim()).map((member) => {
              const index = draft.members.indexOf(member);
              return (
                <label className="account-check" key={index}>
                  <input
                    type="checkbox"
                    checked={member.signed}
                    onChange={(event) => setMember(index, { signed: event.target.checked })}
                  />
                  {member.name} — {member.nationalId || 'ID'} — {member.passportNo || 'passport'} — signed
                </label>
              );
            })}
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void sendGuaranteeNotices().then((sent) => {
                  setBusy(false);
                  setRegistryNote(
                    sent
                      ? 'Repayment consent messages were sent.'
                      : 'The consent link could not be sent. It can be sent after you submit, when EBIS and Majuu are reachable.',
                  );
                });
              }}
            >
              Request member consent
            </button>
            <label className="account-check">
              <input
                type="checkbox"
                checked={draft.guaranteeAccepted}
                onChange={(event) => setDraft({ ...draft, guaranteeAccepted: event.target.checked })}
              />
              The group accepts collective repayment responsibility
            </label>
          </div>
        ) : null}

        {title === 'Documents' || title === 'Upload Documents' ? (
          <div className="account-form">
            <p className="home-chat-note">
              {product === 'core'
                ? 'JPG, PNG, or PDF. Maximum 30 MB. Take a picture or choose a file, the same as the online loan form.'
                : 'JPG, PNG, or PDF. Maximum 10 MB. Take a picture or choose a file, the same as the online Majuu form.'}
            </p>
            {fileSlots(product).map((slot) => {
              const chosen = files.find((file) => file.slot === slot.slot);
              return (
                <div className="offline-member" key={slot.slot}>
                  <strong>{slot.label}</strong>
                  <div className="doc-actions">
                    <label className="btn-ghost">
                      Take picture
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(event: ChangeEvent<HTMLInputElement>) => void onFile(slot.slot, event.target.files)}
                      />
                    </label>
                    <span>or</span>
                    <label className="btn-ghost">
                      Choose file
                      <input
                        type="file"
                        accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                        onChange={(event: ChangeEvent<HTMLInputElement>) => void onFile(slot.slot, event.target.files)}
                      />
                    </label>
                  </div>
                  {chosen ? <span className="home-chat-note">{chosen.name}</span> : null}
                </div>
              );
            })}
            {product === 'majuu'
              ? draft.members
                  .map((member, index) => ({ member, index }))
                  .filter(({ member }) => member.name.trim())
                  .map(({ member, index }) => (
                    <div className="offline-member" key={`docs-${index}`}>
                      <strong>{member.name} documents</strong>
                      {MAJUU_MEMBER_FILE_SLOTS.map((slot) => {
                        const chosen = files.find((file) => file.slot === slot.slot && file.memberIndex === index);
                        return (
                          <div key={slot.slot}>
                            <span>{slot.label}</span>
                            <div className="doc-actions">
                              <label className="btn-ghost">
                                Take picture
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                    void onFile(slot.slot, event.target.files, index)
                                  }
                                />
                              </label>
                              <span>or</span>
                              <label className="btn-ghost">
                                Choose file
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                    void onFile(slot.slot, event.target.files, index)
                                  }
                                />
                              </label>
                            </div>
                            {chosen ? <span className="home-chat-note">{chosen.name}</span> : null}
                          </div>
                        );
                      })}
                    </div>
                  ))
              : null}
            {product === 'majuu' ? (
              <label className="account-check">
                <input
                  type="checkbox"
                  checked={draft.membersConfirmed}
                  onChange={(event) => setDraft({ ...draft, membersConfirmed: event.target.checked })}
                />
                Confirm the member list
              </label>
            ) : null}
          </div>
        ) : null}

        {title === 'Review' ? (
          <div className="account-form">
            <p>
              Application number <strong>{number}</strong>
            </p>
            <p className="home-chat-note">
              {product === 'majuu'
                ? 'Wezesha Majuu assigns UWZ- and the time, then keeps that number if no other application already has it.'
                : 'Loans assigns APP-, today’s date, and 6 letters or digits, the same as an online application.'}
            </p>
            <p>
              {draft.groupName || 'Group'} · {draft.registrationNumber || 'No registration number'}
            </p>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save on this phone'}
            </button>
          </div>
        ) : null}

        <div className="doc-actions">
          {step > 0 ? (
            <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)}>
              Back
            </button>
          ) : null}
          {!last ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (product === 'majuu' && title === 'Group Information' && mseaReachable && draft.mseaStatus !== 'found') {
                  setError('Verify a registered group before continuing.');
                  return;
                }
                setError('');
                setStep(step + 1);
              }}
            >
              Next
            </button>
          ) : null}
        </div>

        {saved.length ? (
          <div className="account-form">
            <strong>Saved on this phone</strong>
            {saved.map((packet) => (
              <div className="offline-member" key={packet.id}>
                <strong>{packet.payload.groupName || 'Application'}</strong>
                <span className="home-chat-note">
                  {packet.acknowledgementNumber || packet.applicationId || packet.payload.proposedNumber} ·{' '}
                  {packet.status === 'synced' ? 'Sent' : packet.lastError || 'Waiting for the site'}
                </span>
                {packet.status !== 'synced' && packet.product === 'majuu' ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setDraft({
                        ...emptyDraft('majuu'),
                        ...packet.payload,
                        members: (packet.payload.members || []).map((member) => ({ ...emptyMember(), ...member })),
                      });
                      setFiles(packet.files);
                      setEditingId(packet.id);
                      setStep(MAJUU_STEPS.indexOf('Loan Amount'));
                      setMessage('Enter consent codes if members have received them, then save again.');
                    }}
                  >
                    Continue saved application
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </form>
    </div>
  );
}
