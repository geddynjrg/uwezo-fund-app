import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, PointerEvent, ReactNode } from 'react';
import logo from '../assets/uwezo-fund-logo.png';
import { GROUP_BANKS, loadGroupBankBranches, type BankBranches } from '../lib/groupBanks';
import { inferGender } from '../lib/genderFromName';
import { constituencyChoices, countyChoices, wardChoices } from '../lib/locations';
import { isMseaChairPartner, isMseaOfficialPartner, lookupMsea, partnerByNationalId } from '../lib/msea';
import {
  AGENT_NUMBER,
  GROUP_ACTIVITIES,
  GROUP_PURPOSE,
  INDIVIDUAL_LOAN_CAP,
  applyPlacement,
  budgetTotal,
  checkJobseekerPlacement,
  checkMemberOnCertificate,
  confirmMajuuUpload,
  copyGroupLocation,
  emptyGroup,
  emptyIndividual,
  genderTotals,
  individualAcknowledgement,
  isKenyanPassport,
  individualsFor,
  listMajuu,
  newLoanNumber,
  officialMayFile,
  queueMajuuNotice,
  rosterFromPartners,
  saveMajuu,
  sendGuarantorOtps,
  submitGroupOnline,
  submitIndividualOnline,
  validateGroup,
  validateIndividual,
  withBudgetAmount,
  guarantorConfirmationError,
  type GroupMajuu,
  type IndividualMajuu,
  type RosterPerson,
} from '../lib/majuuApply';

const INDIVIDUAL_STEPS = [
  'Group link',
  'Individual Information',
  'Location',
  'Guarantor',
  'Recruitment Details',
  'Budget Breakdown',
  'Bank Account',
  'Credit History',
  'Passport',
  'Signature and terms',
  'Tripartite Agreement',
];

const GROUP_STEPS = ['Certificate', 'Males and females', 'Members received', 'Group Information', 'Group bank account', 'Loan number'];

type Mode = 'choose' | 'individual' | 'group' | 'record' | 'group-record';

export function MajuuApply({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<Mode>('choose');
  const [step, setStep] = useState(0);
  const [person, setPerson] = useState<IndividualMajuu>(emptyIndividual());
  const [group, setGroup] = useState<GroupMajuu>(emptyGroup());
  const [saved, setSaved] = useState<IndividualMajuu[]>([]);
  const [groups, setGroups] = useState<GroupMajuu[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [branches, setBranches] = useState<BankBranches>({});
  const [groupReady, setGroupReady] = useState(false);

  async function reload() {
    const rows = await listMajuu();
    setSaved(rows.filter((row): row is IndividualMajuu => row.kind === 'individual' && row.status !== 'draft'));
    setGroups(rows.filter((row): row is GroupMajuu => row.kind === 'group' && (row.status === 'complete' || Boolean(row.loanNumber) || Boolean(row.registrationNumber.trim()))));
  }

  useEffect(() => {
    void reload();
    void loadGroupBankBranches().then(setBranches).catch(() => setBranches({}));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function confirmGroup() {
      if (saved.some((row) => row.uploadedToMajuu)) {
        if (!cancelled) setGroupReady(true);
        return;
      }
      for (const row of saved) {
        const uploaded = await confirmMajuuUpload(row.id);
        if (uploaded) {
          await saveMajuu({ ...row, uploadedToMajuu: true });
          if (!cancelled) setGroupReady(true);
          return;
        }
      }
      if (!cancelled) setGroupReady(false);
    }
    void confirmGroup();
    return () => {
      cancelled = true;
    };
  }, [saved]);

  const steps = mode === 'group' ? GROUP_STEPS : INDIVIDUAL_STEPS;
  const title = mode === 'choose' ? 'Wezesha Majuu' : steps[step];

  async function refreshChecks(current: IndividualMajuu, force: boolean) {
    if (!force && current.mseaMember === 'matched' && (current.neaims === 'placed' || current.neaims === 'offline')) return current;
    const membership = await checkMemberOnCertificate(current.registrationNumber, current.nationalId);
    const placement = await checkJobseekerPlacement(current.nationalId);
    const partner = partnerByNationalId(membership.record?.partners || [], current.nationalId);
    return applyPlacement(
      {
        ...current,
        mseaMember: membership.state,
        mseaDetail: membership.detail,
        groupName: membership.record?.business_name || current.groupName,
        registrationDate: membership.record?.registration_date || current.registrationDate,
        registrationNumber: (membership.record?.registration_number || current.registrationNumber).toUpperCase(),
        name: partner?.name || current.name,
        phone: partner?.phone_number || current.phone,
        gender: current.gender || inferGender(partner?.name || ''),
        email: current.email || (partner && isMseaChairPartner(partner) ? membership.record?.email || '' : ''),
        neaims: placement.state,
        neaimsDetail: placement.detail,
      },
      placement,
    );
  }

  async function savePerson(current: IndividualMajuu) {
    if (current.uploadedToMajuu) return;
    const checked = await refreshChecks(withBudgetAmount({ ...current, accountName: current.accountName || current.name, signed: Boolean(current.signatureImage) }), true);
    const errors = validateIndividual(checked, true);
    if (errors.length) {
      setPerson(checked);
      setError(errors[0]);
      return;
    }
    const loanNumber = checked.loanNumber || newLoanNumber();
    const stored: IndividualMajuu = {
      ...checked,
      passportNo: checked.passportNo.trim().toUpperCase(),
      agentNumber: checked.agentNumber.trim().toUpperCase(),
      status: 'saved',
      loanNumber,
      individualNumber: checked.individualNumber || individualAcknowledgement(loanNumber, checked.nationalId),
      submitRequested: false,
      uploadedToMajuu: false,
    };
    await saveMajuu(stored);
    await queueMajuuNotice(stored, {
      name: stored.name,
      phone: stored.phone,
      title: 'Wezesha Majuu individual application',
      body: `Dear ${stored.name}, your individual application ${stored.individualNumber} is saved on this phone and is waiting to be submitted to majuu.uwezo.go.ke.`,
    });
    setPerson(stored);
    await reload();
    setMode('record');
    setMessage('Saved on this phone. It is waiting to be submitted to the online portal. You can still change any step.');
    setError('');
  }

  async function sendOtp(index: number) {
    setBusy(true);
    setError('');
    const consented = await sendGuarantorOtps(person, { onlyIndex: index, resend: person.guarantors[index]?.otpSent });
    setPerson(consented);
    if (consented.status !== 'draft') await saveMajuu({ ...consented, submitRequested: false });
    setBusy(false);
    const guarantor = consented.guarantors[index];
    if (guarantor?.otpSent) {
      setMessage(`OTP sent to guarantor ${index + 1}. Type it in the Guarantor OTP field under that phone.`);
      return;
    }
    setMessage('');
    setError(guarantor && !guarantor.phone.trim()
      ? `Enter a Kenyan mobile number for guarantor ${index + 1} before sending the OTP.`
      : `The OTP could not be sent to guarantor ${index + 1}. Tap Send OTP again.`);
  }

  async function submitSavedPerson() {
    if (person.uploadedToMajuu) return;
    const errors = validateIndividual(person, true);
    if (errors.length) {
      setError(errors[0]);
      return;
    }
    const requested = { ...person, submitRequested: true };
    await saveMajuu(requested);
    const uploaded = await submitIndividualOnline(requested);
    setPerson(uploaded.person);
    await reload();
    if (uploaded.ok) {
      setMessage(`${uploaded.detail} This application can no longer be changed.`);
      setError('');
    } else {
      setMessage('');
      setError(`${uploaded.detail} The application is still saved on this phone.`);
    }
  }

  async function submitSavedGroup() {
    if (group.uploadedToMajuu) return;
    const requested = { ...group, submitRequested: true };
    await saveMajuu(requested);
    const uploaded = await submitGroupOnline(requested);
    setGroup(uploaded.group);
    await reload();
    setMessage(uploaded.ok ? 'Submitted to majuu.uwezo.go.ke. This group loan can no longer be changed.' : `${uploaded.detail} It is still saved on this phone and can still be changed.`);
    setError('');
  }

  async function completeGroup(event: FormEvent) {
    event.preventDefault();
    if (group.uploadedToMajuu) return;
    setBusy(true);
    setError('');
    try {
      const members = saved.filter((row) => group.memberIds.includes(row.id));
      const location = copyGroupLocation(group.officialNationalId, members);
      let ready: GroupMajuu = { ...group, ...location, purpose: GROUP_PURPOSE, proposedActivities: GROUP_ACTIVITIES };
      const looked = await lookupMsea(ready.registrationNumber, '', { skipApplicantCheck: true });
      if (looked.available) {
        const partner = partnerByNationalId(looked.record.partners || [], ready.officialNationalId);
        ready = {
          ...ready,
          groupName: looked.record.business_name || ready.groupName,
          registrationDate: looked.record.registration_date || ready.registrationDate,
          registrationNumber: (looked.record.registration_number || ready.registrationNumber).toUpperCase(),
          officialName: partner?.name || ready.officialName,
          officialPhone: partner?.phone_number || ready.officialPhone,
        };
      }
      const officialError = await officialMayFile(ready);
      const errors = [officialError, ...validateGroup(ready, members)].filter(Boolean);
      if (errors.length) {
        setGroup(ready);
        setError(errors[0]);
        return;
      }
      const loanNumber = ready.loanNumber || newLoanNumber();
      const completed: GroupMajuu = { ...ready, loanNumber, status: 'complete', lastError: '', submitRequested: false, uploadedToMajuu: false };
      await saveMajuu(completed);
      for (const member of members) {
        const numbered: IndividualMajuu = {
          ...member,
          loanNumber,
          individualNumber: individualAcknowledgement(loanNumber, member.nationalId),
          status: member.uploadedToMajuu ? member.status : 'numbered',
        };
        await saveMajuu(numbered);
        await queueMajuuNotice(numbered, {
          name: member.name,
          phone: member.phone,
          title: 'Wezesha Majuu loan number',
          body: `Dear ${member.name}, ${completed.officialName || 'A group official'} saved the group loan for ${completed.groupName}. Your loan number is ${numbered.individualNumber}. It is waiting to be submitted online.`,
        });
      }
      await queueMajuuNotice(completed, {
        name: completed.officialName,
        phone: completed.officialPhone,
        title: 'Wezesha Majuu group loan',
        body: `The group loan for ${completed.groupName} is saved on this phone. Loan number ${loanNumber}. It is waiting to be submitted online.`,
      });
      setGroup(completed);
      await reload();
      setMode('group-record');
      setMessage(`Loan number ${loanNumber} is saved on this phone and is waiting to be submitted to the online portal.`);
    } finally {
      setBusy(false);
    }
  }

  function setRosterGender(index: number, gender: RosterPerson['gender']) {
    const roster = group.roster.map((person, personIndex) => (personIndex === index ? { ...person, gender } : person));
    setGroup({ ...group, roster, ...genderTotals(roster) });
  }

  async function loadCertificate(current: GroupMajuu) {
    if (current.registrationNumber.trim().length < 2 || !/^\d{6,9}$/.test(current.officialNationalId.trim())) {
      setError('MSEA certificate number and national ID are required.');
      return false;
    }
    const looked = await lookupMsea(current.registrationNumber, '', { skipApplicantCheck: true });
    if (!looked.available) {
      if (/unavailable/i.test(looked.message)) {
        setMessage(looked.message);
        setError('');
        return true;
      }
      setError(looked.message);
      return false;
    }
    const partner = partnerByNationalId(looked.record.partners || [], current.officialNationalId);
    if (!partner) {
      setError('This national ID is not on the MSEA certificate.');
      return false;
    }
    if (!isMseaOfficialPartner(partner)) {
      setError('A group official listed on the MSEA certificate can file the group loan.');
      return false;
    }
    const fresh = rosterFromPartners(looked.record.partners || []);
    const roster = fresh.map((person) => {
      const kept = current.roster.find((row) => row.nationalId && row.nationalId === person.nationalId);
      return kept?.gender ? { ...person, gender: kept.gender } : person;
    });
    setGroup({
      ...current,
      groupName: looked.record.business_name || current.groupName,
      registrationDate: looked.record.registration_date || current.registrationDate,
      registrationNumber: (looked.record.registration_number || current.registrationNumber).toUpperCase(),
      officialName: partner.name || current.officialName,
      officialPhone: partner.phone_number || current.officialPhone,
      roster,
      ...genderTotals(roster),
    });
    setMessage(`${partner.name || 'This official'} is on this MSEA certificate.`);
    setError('');
    return true;
  }

  async function next() {
    setError('');
    if (mode === 'individual' && (title === 'Group link' || title === 'Individual Information') && person.mseaMember === 'missing') {
      setError(person.mseaDetail || 'This national ID is not on the MSEA certificate.');
      return;
    }
    if (mode === 'individual' && title === 'Group link') {
      if (person.registrationNumber.trim().length < 2 || !/^\d{6,9}$/.test(person.nationalId.trim())) {
        setError('MSEA certificate number and national ID are required.');
        return;
      }
      setBusy(true);
      const checked = await refreshChecks(person, true);
      setBusy(false);
      setPerson(checked);
      if (checked.mseaMember === 'missing') {
        setError(checked.mseaDetail || 'This national ID is not on the MSEA certificate.');
        return;
      }
    }
    if (mode === 'individual' && title === 'Individual Information') {
      const passport = person.passportNo.trim().toUpperCase();
      if (!person.recruitmentLocked.includes('passportNo') && !isKenyanPassport(passport)) {
        setError('Enter a Kenyan passport number: one or two capital letters followed by 7 digits, such as A1234567 or AK1234567.');
        return;
      }
      setPerson({ ...person, passportNo: passport });
    }
    if (mode === 'individual' && title === 'Recruitment Details') {
      const agentNumber = person.agentNumber.trim().toUpperCase();
      if (!AGENT_NUMBER.test(agentNumber)) {
        setError('Agent number must be capital letters and numbers.');
        return;
      }
      setPerson({ ...person, agentNumber });
    }
    if (mode === 'individual' && title === 'Budget Breakdown') {
      const applied = budgetTotal(person.budget);
      if (applied < 1 || applied > INDIVIDUAL_LOAN_CAP) {
        setError('The amount applied is the budget total and must be from 1 to 166,666.');
        return;
      }
    }
    if (mode === 'individual' && title === 'Guarantor') {
      setBusy(true);
      const consented = await sendGuarantorOtps(person);
      setPerson(consented);
      setBusy(false);
      const otpError = guarantorConfirmationError(consented);
      const sent = consented.guarantors.every((guarantor) => guarantor.otpSent);
      if (otpError && sent) {
        setError(otpError);
        setMessage('The OTP is in the Guarantor OTP field under each guarantor’s phone. Type it there before continuing.');
        return;
      }
      setMessage(
        otpError
          ? 'An OTP could not be sent. Use Send OTP under that guarantor’s phone. The application can be saved, and it can be submitted online only after the Guarantor OTP is entered.'
          : 'Guarantor OTP accepted.',
      );
    }
    if (mode === 'group' && title === 'Certificate') {
      setBusy(true);
      const loaded = await loadCertificate(group);
      setBusy(false);
      if (!loaded) return;
    }
    if (mode === 'group' && title === 'Males and females') {
      const males = Number(group.totalMales || 0);
      const females = Number(group.totalFemales || 0);
      if (group.roster.length && group.roster.some((person) => !person.gender)) {
        setError('Choose male or female for each member listed on the certificate.');
        return;
      }
      if (group.roster.length && males + females !== group.roster.length) {
        setError(`Males and females must add up to ${group.roster.length} members on the MSEA certificate.`);
        return;
      }
      if (!group.roster.length && males + females < 3) {
        setError('Enter the number of males and females. Together they must be at least 3.');
        return;
      }
    }
    setStep(step + 1);
  }

  const received = individualsFor(saved, group.registrationNumber);

  return (
    <div className="chat">
      <header className="chat-header">
        <button type="button" className="chat-back" onClick={onBack} aria-label="Back">
          ←
        </button>
        <img src={logo} alt="" className="chat-header__logo" width={36} height={36} />
        <div className="chat-header__text">
          <strong>Wezesha Majuu</strong>
          <span>
            {mode === 'choose'
              ? 'Individual, then group loan'
              : mode === 'record' || mode === 'group-record'
                ? (mode === 'record' ? person.uploadedToMajuu : group.uploadedToMajuu)
                  ? 'Submitted online'
                  : 'Saved, awaiting submission'
                : `Step ${step + 1} of ${steps.length}: ${title}`}
          </span>
        </div>
      </header>
      <form
        className="chat-thread"
        onSubmit={(event) => {
          event.preventDefault();
          if (mode === 'group' && title === 'Loan number') void completeGroup(event);
        }}
      >
        {message ? <div className="bubble bubble--bot">{message}</div> : null}
        {error ? <div className="bubble bubble--system">{error}</div> : null}

        {mode === 'choose' ? (
          <div className="account-form">
            <p className="home-chat-note">
              A member completes an individual application first. Any group official can then file the group loan for
              the members already saved. Each saved application keeps its loan number here, before and after it is submitted online.
            </p>
            <ApplicationList
              people={saved}
              groups={groups}
              onOpenPerson={(row) => {
                setPerson(row);
                setMode('record');
                setMessage('');
                setError('');
              }}
              onOpenGroup={(row) => {
                setGroup(row);
                setMode('group-record');
                setMessage('');
                setError('');
              }}
            />
            <button type="button" className="btn-primary" onClick={() => { setMode('individual'); setStep(0); setPerson(emptyIndividual()); }}>
              Individual application
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={!groupReady}
              onClick={() => {
                if (!groupReady) return;
                setMode('group');
                setStep(0);
                setGroup(emptyGroup());
              }}
            >
              Group Application
            </button>
            {groupReady ? null : (
              <p className="home-chat-note">
                Group Application stays off until an individual application has been submitted to majuu.uwezo.go.ke.
              </p>
            )}
          </div>
        ) : null}

        {mode === 'individual' && title === 'Group link' ? (
          <div className="account-form">
            <label>
              MSEA certificate number
              <input value={person.registrationNumber} onChange={(event) => setPerson({ ...person, registrationNumber: event.target.value.toUpperCase(), mseaMember: 'unchecked' })} />
            </label>
            <label>
              National ID
              <input inputMode="numeric" value={person.nationalId} onChange={(event) => setPerson({ ...person, nationalId: event.target.value, mseaMember: 'unchecked' })} />
            </label>
            <p className="home-chat-note">When this national ID is on the certificate, the member’s name, phone, and gender are filled from MSEA.</p>
          </div>
        ) : null}

        {mode === 'individual' && title === 'Individual Information' ? (
          <div className="account-form">
            <label>
              National ID
              <input inputMode="numeric" value={person.nationalId} onChange={(event) => setPerson({ ...person, nationalId: event.target.value, mseaMember: 'unchecked' })} />
            </label>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void refreshChecks(person, true).then((nextPerson) => {
                  setPerson(nextPerson);
                  setMessage([nextPerson.mseaDetail, nextPerson.neaimsDetail].filter(Boolean).join(' '));
                  setBusy(false);
                });
              }}
            >
              Check national ID
            </button>
            <p className="home-chat-note">{person.neaimsDetail || 'Online, the national ID is checked now. Offline, MSEA and NEAIMS are checked when you save.'}</p>
            <label>
              Name
              <input value={person.name} onChange={(event) => setPerson({ ...person, name: event.target.value })} />
            </label>
            <label>
              Gender
              <select value={person.gender} onChange={(event) => setPerson({ ...person, gender: event.target.value as IndividualMajuu['gender'] })}>
                <option value="">Choose</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </label>
            <label>
              Date of birth
              <input type="date" value={person.dob} onChange={(event) => setPerson({ ...person, dob: event.target.value })} />
            </label>
            <label>
              Passport number
              <input
                value={person.passportNo}
                readOnly={person.recruitmentLocked.includes('passportNo') || person.uploadedToMajuu}
                onChange={(event) => setPerson({ ...person, passportNo: event.target.value.toUpperCase() })}
              />
            </label>
            <label>
              KRA PIN
              <input value={person.kraPin} onChange={(event) => setPerson({ ...person, kraPin: event.target.value.toUpperCase() })} />
            </label>
            <label>
              Education
              <select value={person.educationLevel} onChange={(event) => setPerson({ ...person, educationLevel: event.target.value })}>
                <option value="">Choose</option>
                {['KCPE', 'KCSE', 'None', 'University', 'Other'].map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </label>
            <label>
              Phone
              <input inputMode="tel" value={person.phone} onChange={(event) => setPerson({ ...person, phone: event.target.value })} />
            </label>
            <label>
              Email
              <input type="email" value={person.email} onChange={(event) => setPerson({ ...person, email: event.target.value })} />
            </label>
            <label>
              P.O. Box
              <input value={person.poBox} onChange={(event) => setPerson({ ...person, poBox: event.target.value })} />
            </label>
            <label>
              Postal code
              <input value={person.postalCode} onChange={(event) => setPerson({ ...person, postalCode: event.target.value })} />
            </label>
            <label>
              Town
              <input value={person.town} onChange={(event) => setPerson({ ...person, town: event.target.value })} />
            </label>
            <label>
              Number of dependants
              <input inputMode="numeric" value={person.dependants} onChange={(event) => setPerson({ ...person, dependants: event.target.value })} />
            </label>
          </div>
        ) : null}

        {mode === 'individual' && title === 'Location' ? (
          <div className="account-form">
            <label>
              County
              <select value={person.county} onChange={(event) => setPerson({ ...person, county: event.target.value, constituency: '', ward: '' })}>
                <option value="">Choose county</option>
                {countyChoices('majuu').map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
              </select>
            </label>
            <label>
              Constituency
              <select value={person.constituency} onChange={(event) => setPerson({ ...person, constituency: event.target.value, ward: '' })}>
                <option value="">Choose constituency</option>
                {constituencyChoices('majuu', person.county).map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
              </select>
            </label>
            <label>
              Ward
              <select value={person.ward} onChange={(event) => setPerson({ ...person, ward: event.target.value })}>
                <option value="">Choose ward</option>
                {wardChoices('majuu', person.county, person.constituency).map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
              </select>
            </label>
          </div>
        ) : null}

        {mode === 'individual' && title === 'Guarantor' ? (
          <div className="account-form">
            {person.guarantors.map((guarantor, index) => (
              <fieldset className="offline-member" key={index}>
                <legend>Guarantor {index + 1}</legend>
                <label>
                  Name
                  <input value={guarantor.name} onChange={(event) => setPerson({ ...person, guarantors: person.guarantors.map((row, rowIndex) => rowIndex === index ? { ...row, name: event.target.value } : row) as IndividualMajuu['guarantors'] })} />
                </label>
                <label>
                  Gender
                  <select value={guarantor.gender} onChange={(event) => setPerson({ ...person, guarantors: person.guarantors.map((row, rowIndex) => rowIndex === index ? { ...row, gender: event.target.value as GuarantorDraftGender } : row) as IndividualMajuu['guarantors'] })}>
                    <option value="">Choose</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                  </select>
                </label>
                <label>
                  County
                  <select value={guarantor.county} onChange={(event) => setPerson({ ...person, guarantors: person.guarantors.map((row, rowIndex) => rowIndex === index ? { ...row, county: event.target.value, constituency: '', ward: '' } : row) as IndividualMajuu['guarantors'] })}>
                    <option value="">Choose county</option>
                    {countyChoices('majuu').map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                  </select>
                </label>
                <label>
                  Constituency
                  <select value={guarantor.constituency} onChange={(event) => setPerson({ ...person, guarantors: person.guarantors.map((row, rowIndex) => rowIndex === index ? { ...row, constituency: event.target.value, ward: '' } : row) as IndividualMajuu['guarantors'] })}>
                    <option value="">Choose constituency</option>
                    {constituencyChoices('majuu', guarantor.county).map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                  </select>
                </label>
                <label>
                  Ward
                  <select value={guarantor.ward} onChange={(event) => setPerson({ ...person, guarantors: person.guarantors.map((row, rowIndex) => rowIndex === index ? { ...row, ward: event.target.value } : row) as IndividualMajuu['guarantors'] })}>
                    <option value="">Choose ward</option>
                    {wardChoices('majuu', guarantor.county, guarantor.constituency).map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                  </select>
                </label>
                <label>
                  National ID
                  <input inputMode="numeric" value={guarantor.nationalId} onChange={(event) => setPerson({ ...person, guarantors: person.guarantors.map((row, rowIndex) => rowIndex === index ? { ...row, nationalId: event.target.value } : row) as IndividualMajuu['guarantors'] })} />
                </label>
                <label>
                  Phone
                  <input inputMode="tel" value={guarantor.phone} onChange={(event) => setPerson({ ...person, guarantors: person.guarantors.map((row, rowIndex) => rowIndex === index ? { ...row, phone: event.target.value, otpCode: '', otpEntered: '', otpSent: false, consentPending: false } : row) as IndividualMajuu['guarantors'] })} />
                </label>
                <label>
                  Guarantor OTP
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="OTP texted to this guarantor"
                    value={guarantor.otpEntered}
                    onChange={(event) => setPerson({ ...person, guarantors: person.guarantors.map((row, rowIndex) => rowIndex === index ? { ...row, otpEntered: event.target.value.replace(/\s/g, '') } : row) as IndividualMajuu['guarantors'] })}
                  />
                </label>
                <button type="button" className="btn-ghost" disabled={busy || person.uploadedToMajuu} onClick={() => { void sendOtp(index); }}>
                  {guarantor.otpSent ? 'Send OTP again' : 'Send OTP'}
                </button>
                <p className="home-chat-note">
                  {guarantor.otpSent
                    ? 'The OTP was sent to this phone. The applicant types it in Guarantor OTP, above, before the application is submitted online.'
                    : 'Tap Send OTP. The guarantor receives the code by text. The applicant types it in Guarantor OTP, above.'}
                </p>
              </fieldset>
            ))}
          </div>
        ) : null}

        {mode === 'individual' && title === 'Recruitment Details' ? (
          <div className="account-form">
            <p className="home-chat-note">{person.neaimsDetail || 'If the job placement service answers, matching fields are filled from it.'}</p>
            <label>Agent number<input value={person.agentNumber} readOnly={person.recruitmentLocked.includes('agentNumber') || person.uploadedToMajuu} onChange={(event) => setPerson({ ...person, agentNumber: event.target.value.toUpperCase() })} /></label>
            <label>Local agent name<input value={person.localAgentName} readOnly={person.recruitmentLocked.includes('localAgentName')} onChange={(event) => setPerson({ ...person, localAgentName: event.target.value })} /></label>
            <label>Employer abroad<input value={person.employerAbroad} readOnly={person.recruitmentLocked.includes('employerAbroad')} onChange={(event) => setPerson({ ...person, employerAbroad: event.target.value })} /></label>
            <label>Employer code<input value={person.recruiterCode} readOnly={person.recruitmentLocked.includes('recruiterCode')} onChange={(event) => setPerson({ ...person, recruiterCode: event.target.value })} /></label>
            <label>Country of destination<input value={person.countryOfDestination} readOnly={person.recruitmentLocked.includes('countryOfDestination')} onChange={(event) => setPerson({ ...person, countryOfDestination: event.target.value })} /></label>
            <label>Nature of work<input value={person.natureOfWork} readOnly={person.recruitmentLocked.includes('natureOfWork')} onChange={(event) => setPerson({ ...person, natureOfWork: event.target.value })} /></label>
            <label>
              Duration type
              <select value={person.durationType} onChange={(event) => setPerson({ ...person, durationType: event.target.value as IndividualMajuu['durationType'] })}>
                <option value="">Choose</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
            </label>
            <label>Work duration<input inputMode="numeric" value={person.workDuration} onChange={(event) => setPerson({ ...person, workDuration: event.target.value })} /></label>
            <label>
              Currency
              <select value={person.currency} onChange={(event) => setPerson({ ...person, currency: event.target.value as IndividualMajuu['currency'] })}>
                <option value="">Choose</option>
                <option value="KWD">KWD</option>
                <option value="AED">AED</option>
                <option value="RUB">RUB</option>
              </select>
            </label>
            <label>Monthly pay<input inputMode="decimal" value={person.monthlyRemuneration} onChange={(event) => setPerson({ ...person, monthlyRemuneration: event.target.value })} /></label>
            <label>Pay in Kenya shillings<input inputMode="decimal" value={person.convertedKesAmount} onChange={(event) => setPerson({ ...person, convertedKesAmount: event.target.value })} /></label>
          </div>
        ) : null}

        {mode === 'individual' && title === 'Budget Breakdown' ? (
          <div className="account-form">
            <p className="home-chat-note">
              Amount applied: KES {budgetTotal(person.budget).toLocaleString('en-KE')}. This total is the loan amount and cannot exceed {INDIVIDUAL_LOAN_CAP.toLocaleString('en-KE')}.
            </p>
            {person.budget.map((line, index) => (
              <fieldset className="offline-member" key={index}>
                <legend>Item {index + 1}</legend>
                <label>Item<input value={line.item} onChange={(event) => setPerson(withBudgetAmount({ ...person, budget: person.budget.map((row, rowIndex) => rowIndex === index ? { ...row, item: event.target.value } : row) }))} /></label>
                <label>Cost<input inputMode="numeric" value={line.cost} onChange={(event) => setPerson(withBudgetAmount({ ...person, budget: person.budget.map((row, rowIndex) => rowIndex === index ? { ...row, cost: event.target.value } : row) }))} /></label>
              </fieldset>
            ))}
            <button type="button" className="btn-ghost" onClick={() => setPerson(withBudgetAmount({ ...person, budget: [...person.budget, { item: '', cost: '' }] }))}>
              Add item
            </button>
          </div>
        ) : null}

        {mode === 'individual' && title === 'Bank Account' ? (
          <BankFields
            bankName={person.bankName}
            bankBranch={person.bankBranch}
            accountName={person.accountName || person.name}
            accountNumber={person.accountNumber}
            branches={branches}
            onChange={(patch) => setPerson({ ...person, ...patch })}
          />
        ) : null}

        {mode === 'individual' && title === 'Credit History' ? (
          <div className="account-form">
            <label>
              Have you had a loan before?
              <select value={person.hasLoanHistory} onChange={(event) => setPerson({ ...person, hasLoanHistory: event.target.value as IndividualMajuu['hasLoanHistory'] })}>
                <option value="">Choose</option>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
            {person.hasLoanHistory === 'yes' ? person.creditLoans.map((loan, index) => (
              <fieldset className="offline-member" key={index}>
                <legend>Loan {index + 1}</legend>
                <label>Lender<input value={loan.lender} onChange={(event) => setPerson({ ...person, creditLoans: person.creditLoans.map((row, rowIndex) => rowIndex === index ? { ...row, lender: event.target.value } : row) })} /></label>
                <label>Date<input type="date" value={loan.date} onChange={(event) => setPerson({ ...person, creditLoans: person.creditLoans.map((row, rowIndex) => rowIndex === index ? { ...row, date: event.target.value } : row) })} /></label>
                <label>Amount<input inputMode="numeric" value={loan.amount} onChange={(event) => setPerson({ ...person, creditLoans: person.creditLoans.map((row, rowIndex) => rowIndex === index ? { ...row, amount: event.target.value } : row) })} /></label>
                <label>Duration<input value={loan.duration} onChange={(event) => setPerson({ ...person, creditLoans: person.creditLoans.map((row, rowIndex) => rowIndex === index ? { ...row, duration: event.target.value } : row) })} /></label>
                <label>Monthly instalment<input inputMode="numeric" value={loan.monthlyInstallment} onChange={(event) => setPerson({ ...person, creditLoans: person.creditLoans.map((row, rowIndex) => rowIndex === index ? { ...row, monthlyInstallment: event.target.value } : row) })} /></label>
                <label>Outstanding balance<input inputMode="numeric" value={loan.outstandingAmount} onChange={(event) => setPerson({ ...person, creditLoans: person.creditLoans.map((row, rowIndex) => rowIndex === index ? { ...row, outstandingAmount: event.target.value } : row) })} /></label>
              </fieldset>
            )) : null}
            {person.hasLoanHistory === 'yes' ? (
              <button type="button" className="btn-ghost" onClick={() => setPerson({ ...person, creditLoans: [...person.creditLoans, { lender: '', date: '', amount: '', duration: '', monthlyInstallment: '', outstandingAmount: '' }] })}>
                Add loan
              </button>
            ) : null}
          </div>
        ) : null}

        {mode === 'individual' && title === 'Passport' ? (
          <PassportCapture person={person} onChange={setPerson} />
        ) : null}

        {mode === 'individual' && title === 'Signature and terms' ? (
          <div className="account-form">
            <h2>Loan terms and repayment commitment</h2>
            <p className="home-chat-note">Amount applied: KES {budgetTotal(person.budget).toLocaleString('en-KE')}.</p>
            <LoanTerms groupName={person.groupName} />
            <label className="account-check">
              <input type="checkbox" checked={person.termsAccepted} onChange={(event) => setPerson({ ...person, termsAccepted: event.target.checked })} />
              I agree to these loan terms and the repayment commitment
            </label>
            <p className="home-chat-note">Sign with a finger or a mouse.</p>
            <SignaturePad
              value={person.signatureImage}
              onChange={(signatureImage) => setPerson({ ...person, signatureImage, signed: Boolean(signatureImage) })}
            />
          </div>
        ) : null}

        {mode === 'individual' && title === 'Tripartite Agreement' ? (
          <div className="account-form">
            <TripartiteText person={person} />
            <label className="account-check">
              <input type="checkbox" checked={person.tripartiteAccepted} onChange={(event) => setPerson({ ...person, tripartiteAccepted: event.target.checked })} />
              I accept the tripartite agreement
            </label>
            <button type="button" className="btn-primary" disabled={busy || person.uploadedToMajuu} onClick={() => { setBusy(true); void savePerson(person).finally(() => setBusy(false)); }}>
              {busy ? 'Saving…' : person.uploadedToMajuu ? 'Submitted online' : 'Save individual application'}
            </button>
            {person.individualNumber ? <p className="home-chat-note">Loan application number {person.individualNumber}</p> : <p className="home-chat-note">A loan application number is issued when you save.</p>}
          </div>
        ) : null}

        {mode === 'group' && title === 'Certificate' ? (
          <div className="account-form">
            <label>MSEA certificate number<input value={group.registrationNumber} onChange={(event) => setGroup({ ...group, registrationNumber: event.target.value.toUpperCase() })} /></label>
            <label>National ID<input inputMode="numeric" value={group.officialNationalId} onChange={(event) => setGroup({ ...group, officialNationalId: event.target.value })} /></label>
            <p className="home-chat-note">The certificate number and national ID identify the group official. The official’s name and phone are taken from MSEA.</p>
          </div>
        ) : null}

        {mode === 'group' && title === 'Males and females' ? (
          <div className="account-form">
            <p className="home-chat-note">
              {group.roster.length
                ? `MSEA lists ${group.roster.length} members. Gender is read from each name and can be changed. Males and females must add up to ${group.roster.length}.`
                : 'MSEA did not return the member names. Enter the number of males and females.'}
            </p>
            {group.roster.map((member, index) => (
              <label key={`${member.nationalId}-${index}`}>
                {member.name}
                <select value={member.gender} onChange={(event) => setRosterGender(index, event.target.value as RosterPerson['gender'])}>
                  <option value="">Gender</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </label>
            ))}
            <label>
              Males
              <input inputMode="numeric" value={group.totalMales} onChange={(event) => setGroup({ ...group, totalMales: event.target.value })} />
            </label>
            <label>
              Females
              <input inputMode="numeric" value={group.totalFemales} onChange={(event) => setGroup({ ...group, totalFemales: event.target.value })} />
            </label>
          </div>
        ) : null}

        {mode === 'group' && title === 'Members received' ? (
          <div className="account-form">
            <p className="home-chat-note">Select the members whose individual applications are already on this phone. At least 3. Other partners can apply later.</p>
            {received.length ? received.map((member) => (
              <label className="account-check" key={member.id}>
                <input
                  type="checkbox"
                  checked={group.memberIds.includes(member.id)}
                  onChange={(event) => setGroup({
                    ...group,
                    memberIds: event.target.checked ? [...group.memberIds, member.id] : group.memberIds.filter((id) => id !== member.id),
                  })}
                />
                {member.name} · {member.nationalId} · {member.loanNumber ? member.individualNumber : 'No loan number yet'}
              </label>
            )) : <p className="home-chat-note">No saved individual applications for this certificate number yet.</p>}
          </div>
        ) : null}

        {mode === 'group' && title === 'Group Information' ? (
          <div className="account-form">
            <label>Group name<input readOnly value={group.groupName} /></label>
            <label>Registration number<input readOnly value={group.registrationNumber} /></label>
            <label>Date formed<input readOnly value={group.registrationDate} /></label>
            <label>Purpose<textarea readOnly rows={3} value={GROUP_PURPOSE} /></label>
            <label>Proposed activities<textarea readOnly rows={2} value={GROUP_ACTIVITIES} /></label>
          </div>
        ) : null}

        {mode === 'group' && title === 'Group bank account' ? (
          <BankFields
            bankName={group.bankName}
            bankBranch={group.bankBranch}
            accountName={group.accountName}
            accountNumber={group.accountNumber}
            branches={branches}
            onChange={(patch) => setGroup({ ...group, ...patch })}
          />
        ) : null}

        {mode === 'group' && title === 'Loan number' ? (
          <div className="account-form">
            <p className="home-chat-note">Saving assigns the loan number and keeps the group on this phone until you submit it to the online portal.</p>
            <button type="submit" className="btn-primary" disabled={busy || group.uploadedToMajuu}>{busy ? 'Saving…' : group.loanNumber ? 'Save group application' : 'Finish group loan'}</button>
            {group.loanNumber ? <p>Loan number {group.loanNumber}</p> : null}
          </div>
        ) : null}

        {mode === 'record' ? (
          <>
          <SavedRecord
            title={person.name || 'Individual application'}
            number={person.individualNumber || person.loanNumber}
            uploaded={person.uploadedToMajuu}
            busy={busy}
            steps={INDIVIDUAL_STEPS}
            onEdit={person.uploadedToMajuu ? undefined : (index) => {
              setStep(index);
              setMode('individual');
              setMessage('');
              setError('');
            }}
            beforeSubmit={person.uploadedToMajuu ? null : (
              <GuarantorOtpFields
                person={person}
                busy={busy}
                onChange={setPerson}
                onSend={(index) => { void sendOtp(index); }}
              />
            )}
            onSubmit={() => {
              setBusy(true);
              void submitSavedPerson().finally(() => setBusy(false));
            }}
          />
          <button type="button" className="btn-ghost" onClick={() => { setMode('choose'); setMessage(''); setError(''); }}>All applications</button>
          </>
        ) : null}

        {mode === 'group-record' ? (
          <>
          <SavedRecord
            title={group.groupName || group.registrationNumber || 'Group application'}
            number={group.loanNumber}
            uploaded={group.uploadedToMajuu}
            busy={busy}
            steps={GROUP_STEPS}
            onEdit={group.uploadedToMajuu ? undefined : (index) => {
              setStep(index);
              setMode('group');
              setMessage('');
              setError('');
            }}
            onSubmit={() => {
              setBusy(true);
              void submitSavedGroup().finally(() => setBusy(false));
            }}
          />
          <button type="button" className="btn-ghost" onClick={() => { setMode('choose'); setMessage(''); setError(''); }}>All applications</button>
          </>
        ) : null}

        {mode === 'individual' || mode === 'group' ? (
          <div className="doc-actions">
            {step > 0 ? <button type="button" className="btn-ghost" onClick={() => setStep(step - 1)}>Back</button> : (
              <button type="button" className="btn-ghost" onClick={() => setMode(mode === 'group' ? (group.status === 'complete' ? 'group-record' : 'choose') : person.status === 'draft' ? 'choose' : 'record')}>
                {mode === 'group' ? (group.status === 'complete' ? 'Saved application' : 'Choose again') : person.status === 'draft' ? 'Choose again' : 'Saved application'}
              </button>
            )}
            {mode === 'individual' && person.status !== 'draft' && step > 0 ? (
              <button type="button" className="btn-ghost" onClick={() => { void saveMajuu({ ...person, passportNo: person.passportNo.toUpperCase(), agentNumber: person.agentNumber.toUpperCase(), submitRequested: false }).then(() => { setMode('record'); void reload(); }); }}>
                Saved application
              </button>
            ) : null}
            {mode === 'group' && group.status === 'complete' && step > 0 ? (
              <button type="button" className="btn-ghost" onClick={() => { void saveMajuu(group).then(() => { setMode('group-record'); void reload(); }); }}>
                Saved application
              </button>
            ) : null}
            {step < steps.length - 1 && !(mode === 'individual' && person.uploadedToMajuu) && !(mode === 'group' && group.uploadedToMajuu) ? <button type="button" className="btn-primary" onClick={next}>Next</button> : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}

type GuarantorDraftGender = '' | 'Male' | 'Female';

function BankFields({
  bankName,
  bankBranch,
  accountName,
  accountNumber,
  branches,
  onChange,
}: {
  bankName: string;
  bankBranch: string;
  accountName: string;
  accountNumber: string;
  branches: BankBranches;
  onChange: (patch: { bankName?: string; bankBranch?: string; accountName?: string; accountNumber?: string }) => void;
}) {
  const knownBanks: readonly string[] = GROUP_BANKS;
  const [useOther, setUseOther] = useState(() => Boolean(bankName) && !knownBanks.includes(bankName));
  const knownBank = !useOther && knownBanks.includes(bankName);
  const selectValue = useOther ? 'Other' : bankName;
  const options = knownBank ? branches[bankName] || [] : [];
  return (
    <div className="account-form">
      <label>
        Bank
        <select
          value={selectValue}
          onChange={(event) => {
            if (event.target.value === 'Other') {
              setUseOther(true);
              onChange({ bankName: knownBanks.includes(bankName) ? '' : bankName, bankBranch: '' });
              return;
            }
            setUseOther(false);
            onChange({ bankName: event.target.value, bankBranch: '' });
          }}
        >
          <option value="">Choose bank</option>
          {GROUP_BANKS.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
          <option value="Other">Other</option>
        </select>
      </label>
      {selectValue === 'Other' ? (
        <label>
          Bank name
          <input value={bankName} onChange={(event) => onChange({ bankName: event.target.value })} />
        </label>
      ) : null}
      <label>
        Branch
        {options.length ? (
          <select value={bankBranch} onChange={(event) => onChange({ bankBranch: event.target.value })}>
            <option value="">Choose branch</option>
            {options.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
          </select>
        ) : (
          <input value={bankBranch} onChange={(event) => onChange({ bankBranch: event.target.value })} placeholder="Branch name" />
        )}
      </label>
      <label>Account name<input value={accountName} onChange={(event) => onChange({ accountName: event.target.value })} /></label>
      <label>Account number<input value={accountNumber} onChange={(event) => onChange({ accountNumber: event.target.value })} /></label>
    </div>
  );
}

function readPassport(file: File, person: IndividualMajuu, onChange: (next: IndividualMajuu) => void) {
  const allowed = !file.type || file.type.startsWith('image/') || file.type === 'application/pdf';
  if (!allowed) return;
  void file.arrayBuffer().then((buffer) => onChange({ ...person, passportFile: { name: file.name, type: file.type || 'image/jpeg', buffer } }));
}

function PassportCapture({ person, onChange }: { person: IndividualMajuu; onChange: (next: IndividualMajuu) => void }) {
  return (
    <div className="account-form">
      <p className="home-chat-note">Passport biodata page. Use the camera or upload a photo or PDF.</p>
      <div className="capture-box">
        <span>{person.passportFile?.name || 'No file yet'}</span>
        <div className="capture-box__actions">
          <label title="Take a photo" aria-label="Take a photo">
            <CameraIcon />
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={person.uploadedToMajuu}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                if (file) readPassport(file, person, onChange);
              }}
            />
          </label>
          <label title="Upload a file" aria-label="Upload a file">
            <UploadIcon />
            <input
              type="file"
              accept="image/*,application/pdf,.pdf"
              disabled={person.uploadedToMajuu}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                if (file) readPassport(file, person, onChange);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="currentColor" d="M9 4l1.5 2h3L15 4h3a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h3zm3 5a4 4 0 100 8 4 4 0 000-8z" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="currentColor" d="M12 3l4 4h-3v6h-2V7H8l4-4zm-7 14h14v2H5v-2z" />
    </svg>
  );
}

function LoanTerms({ groupName }: { groupName: string }) {
  const group = groupName || 'group';
  return (
    <>
      <h3>Loan terms</h3>
      <ul>
        <li>We confirm we are members of this group.</li>
        <li>Declare that the information provided herein is true to the best of our knowledge. We further authorize Uwezo Fund to verify the information given herein and make reference provided here in.</li>
        <li>We agree that we are jointly and severally liable for repayment of loan in event of default.</li>
        <li>We shall not be eligible for additional loans unless the amount in default has been cleared in full.</li>
      </ul>
      <h3>Repayment commitment</h3>
      <p>We the undersigned hereby:</p>
      <ol>
        <li>(i) Confirm that we are members of the {group} group.</li>
        <li>(ii) Declare that the information provided herein is true to the best of our knowledge.</li>
        <li>(iii) We further authorize Uwezo Fund to verify the information and reference provided here-in.</li>
        <li>(iv) We agree that jointly and severally we are liable for repayment of the loan.</li>
        <li>(v) In the event of default, we shall be subjected to the terms and conditions of this loan.</li>
        <li>(vi) We shall not be eligible for additional loans until the amount in default has been cleared in full.</li>
      </ol>
    </>
  );
}

export function MajuuApplicationList() {
  const [people, setPeople] = useState<IndividualMajuu[]>([]);
  const [groups, setGroups] = useState<GroupMajuu[]>([]);
  useEffect(() => {
    void listMajuu().then((rows) => {
      setPeople(rows.filter((row): row is IndividualMajuu => row.kind === 'individual' && row.status !== 'draft'));
      setGroups(rows.filter((row): row is GroupMajuu => row.kind === 'group' && (row.status === 'complete' || Boolean(row.loanNumber))));
    });
  }, []);
  return <ApplicationList people={people} groups={groups} />;
}

function ApplicationList({
  people,
  groups,
  onOpenPerson,
  onOpenGroup,
}: {
  people: IndividualMajuu[];
  groups: GroupMajuu[];
  onOpenPerson?: (row: IndividualMajuu) => void;
  onOpenGroup?: (row: GroupMajuu) => void;
}) {
  if (!people.length && !groups.length) {
    return <p className="home-chat-note">No group or individual applications are saved on this phone yet.</p>;
  }
  return (
    <div className="account-form">
      <h2>Applications on this phone</h2>
      {people.map((row) => {
        const body = (
          <>
            <strong>Individual · {row.name || row.nationalId || 'Applicant'}</strong>
            <span>Loan application number {row.individualNumber || row.loanNumber || 'Pending'}</span>
            <span>{row.uploadedToMajuu ? 'Submitted online' : 'Saved, awaiting submission'}</span>
          </>
        );
        return onOpenPerson ? (
          <button key={row.id} type="button" className="application-card" onClick={() => onOpenPerson(row)}>{body}</button>
        ) : (
          <div key={row.id} className="application-card">{body}</div>
        );
      })}
      {groups.map((row) => {
        const body = (
          <>
            <strong>Group · {row.groupName || row.registrationNumber || 'Group'}</strong>
            <span>Loan application number {row.loanNumber || 'Pending'}</span>
            <span>{row.uploadedToMajuu ? 'Submitted online' : 'Saved, awaiting submission'}</span>
          </>
        );
        return onOpenGroup ? (
          <button key={row.id} type="button" className="application-card" onClick={() => onOpenGroup(row)}>{body}</button>
        ) : (
          <div key={row.id} className="application-card">{body}</div>
        );
      })}
    </div>
  );
}

function SavedRecord({
  title,
  number,
  uploaded,
  busy,
  steps,
  onEdit,
  onSubmit,
  beforeSubmit,
}: {
  title: string;
  number: string;
  uploaded: boolean;
  busy: boolean;
  steps: string[];
  onEdit?: (index: number) => void;
  onSubmit: () => void;
  beforeSubmit?: ReactNode;
}) {
  return (
    <div className="account-form">
      <h2>{uploaded ? 'Submitted online' : 'Saved, awaiting submission'}</h2>
      <p>{title}</p>
      <p className="home-chat-note">Loan application number {number || 'Pending'}</p>
      <p className="home-chat-note">
        {uploaded
          ? 'This application has been submitted to the online portal. No further changes can be made.'
          : 'This application is saved on this phone and is waiting to be submitted to the online portal. You can still open any step and change it.'}
      </p>
      {beforeSubmit}
      {onEdit ? steps.map((label, index) => (
        <button key={label} type="button" className="btn-ghost" onClick={() => onEdit(index)}>
          Edit {label}
        </button>
      )) : null}
      {uploaded ? null : (
        <button type="button" className="btn-primary" disabled={busy} onClick={onSubmit}>
          {busy ? 'Submitting…' : 'Submit to the online portal'}
        </button>
      )}
    </div>
  );
}

function GuarantorOtpFields({
  person,
  busy,
  onChange,
  onSend,
}: {
  person: IndividualMajuu;
  busy: boolean;
  onChange: (person: IndividualMajuu) => void;
  onSend: (index: number) => void;
}) {
  return (
    <div className="account-form">
      <h2>Guarantor OTP</h2>
      <p className="home-chat-note">
        The same field is on step 4, Guarantor, under each guarantor’s phone. Type the code that was texted to that phone before submitting online.
      </p>
      {person.guarantors.map((guarantor, index) => (
        <fieldset className="offline-member" key={index}>
          <legend>Guarantor {index + 1} OTP</legend>
          <p className="home-chat-note">{guarantor.name || 'Guarantor'} · {guarantor.phone || 'No phone yet'}</p>
          <label>
            Guarantor OTP
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="OTP texted to this guarantor"
              value={guarantor.otpEntered}
              onChange={(event) => onChange({
                ...person,
                guarantors: person.guarantors.map((row, rowIndex) => rowIndex === index ? { ...row, otpEntered: event.target.value.replace(/\s/g, '') } : row) as IndividualMajuu['guarantors'],
              })}
            />
          </label>
          <button type="button" className="btn-ghost" disabled={busy || person.uploadedToMajuu} onClick={() => onSend(index)}>
            {guarantor.otpSent ? 'Send OTP again' : 'Send OTP'}
          </button>
        </fieldset>
      ))}
    </div>
  );
}

function SignaturePad({ value, onChange }: { value: string; onChange: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function finish() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL('image/png'));
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={640}
        height={180}
        style={{ width: '100%', height: 180, touchAction: 'none', background: '#fff', border: '1px solid #c8c8c8' }}
        onPointerDown={(event) => {
          drawing.current = true;
          const canvas = canvasRef.current;
          const context = canvas?.getContext('2d');
          if (!context) return;
          const start = point(event);
          context.lineWidth = 2;
          context.lineCap = 'round';
          context.beginPath();
          context.moveTo(start.x, start.y);
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const context = canvasRef.current?.getContext('2d');
          if (!context) return;
          const next = point(event);
          context.lineTo(next.x, next.y);
          context.stroke();
        }}
        onPointerUp={finish}
        onPointerLeave={finish}
      />
      {value ? <img src={value} alt="Signature saved on this application" style={{ maxWidth: '100%', maxHeight: 80 }} /> : null}
      <button
        type="button"
        className="btn-ghost"
        onClick={() => {
          const canvas = canvasRef.current;
          const context = canvas?.getContext('2d');
          if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
          onChange('');
        }}
      >
        Clear signature
      </button>
    </div>
  );
}

function TripartiteText({ person }: { person: IndividualMajuu }) {
  return (
    <article className="home-chat-note">
      <p><strong>REPUBLIC OF KENYA</strong></p>
      <p>MINISTRY OF LABOUR AND SOCIAL PROTECTION, STATE DEPARTMENT FOR LABOUR AND SKILLS DEVELOPMENT</p>
      <p>AND</p>
      <p>MINISTRY OF COOPERATIVES AND MICRO SMALL AND MEDIUM ENTERPRISES DEVELOPMENT, STATE DEPARTMENT OF MICRO SMALL AND MEDIUM ENTERPRISES DEVELOPMENT</p>
      <p><strong>TRIPARTITE AGREEMENT FOR WEZESHA MAJUU LOAN PRODUCT</strong></p>
      <p>This is a tripartite agreement between the Ministry of Labour and Social Protection, Ministry of Cooperatives and Micro Small and Medium Enterprises Development and Labour Migrants.</p>
      <p><strong>1. The Ministry of Labour and Social Protection</strong> commits to oversee Wezesha Majuu, coordinate partners, facilitate labour mobility and job placements, verify opportunities, attest contracts, and provide reasonable assurance to the Fund for repayment of funds on-lent to prospective migrant workers.</p>
      <p><strong>2. The Ministry of Cooperatives and Micro Small and Medium Enterprises Development</strong>, through Uwezo Fund, is the financier. The Fund allocates the labour mobility loan budget, clusters and registers groups, receives and processes applications, disburses approved loans, structures repayment with the Ministry of Labour, and reports programme performance.</p>
      <p>
        <strong>3. Labour migrant.</strong> I, {person.name || '________________'}, ID No {person.nationalId || '________'}, Passport no. {person.passportNo || '________'}, am responsible for seeking employment through the Ministry or its agencies, expressing interest for Wezesha Majuu funding, adhering to the loan terms including cluster formation and repayment, taking pre-departure training, and providing the information the programme requires. The amount applied is KES {budgetTotal(person.budget).toLocaleString('en-KE')}.
      </p>
      <p>Applicant signature saved in the previous step:</p>
      {person.signatureImage ? <img src={person.signatureImage} alt="Applicant signature" style={{ maxWidth: '100%', maxHeight: 100, background: '#fff' }} /> : <p>No signature has been saved yet.</p>}
    </article>
  );
}
