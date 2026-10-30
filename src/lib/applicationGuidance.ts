/** Static prepare / common-mistakes copy adapted from live LAS application-guidance. */

export type GuidancePanel = {
  title: string;
  prepare: string[];
  commonMistakes: string[];
};

const CORE: Record<string, GuidancePanel> = {
  'Group data': {
    title: 'Group data',
    prepare: [
      'Have the group registration certificate, members list, and meeting minutes ready.',
      'Confirm county, constituency, ward, and meeting point.',
      'Match the group name and registration number to the certificate.',
    ],
    commonMistakes: [
      'Uploading unclear scans or empty placeholder files.',
      'Selecting the wrong constituency for the group location.',
      'Typing a registration number that does not match the certificate.',
    ],
  },
  'Group members': {
    title: 'Group members',
    prepare: [
      'Collect each member’s National ID and mobile number.',
      'Assign chairperson, secretary, and treasurer correctly.',
      'Use phones that can receive SMS confirmation.',
    ],
    commonMistakes: [
      'Reusing the same phone or National ID within the group.',
      'Wrong mobile digits that block SMS confirmation.',
      'Leaving required officer roles unassigned.',
    ],
  },
  'Loan conditions': {
    title: 'Loan conditions',
    prepare: [
      'Agree the loan amount and repayment period with members.',
      'Confirm the group bank account details if required.',
    ],
    commonMistakes: [
      'Requesting an amount the group cannot justify.',
      'Mismatched repayment period versus group capacity.',
    ],
  },
  'Proposed business': {
    title: 'Proposed business',
    prepare: [
      'Describe the business activities clearly and honestly.',
      'Link activities to the group’s purpose and value chain.',
    ],
    commonMistakes: [
      'Vague or copy-pasted business descriptions.',
      'Activities that do not match the group type.',
    ],
  },
  'Member confirmation': {
    title: 'Member confirmation',
    prepare: [
      'Ensure every member has a valid phone for SMS links.',
      'Brief members before they receive confirmation messages.',
    ],
    commonMistakes: [
      'Sending confirmations before member details are correct.',
      'Using phones members cannot access.',
    ],
  },
  Confirmations: {
    title: 'Confirmations',
    prepare: [
      'Read each declaration with the group before ticking.',
      'Keep a copy of agreed statements for your records.',
    ],
    commonMistakes: [
      'Submitting while required declarations are unchecked.',
      'Agreeing without confirming details with officers.',
    ],
  },
  Documents: {
    title: 'Documents',
    prepare: [
      'Scan or photograph clear copies of the three group files.',
      'Keep each file under 30 MB (JPG, PNG, or PDF).',
    ],
    commonMistakes: [
      'Blurry or cropped certificates.',
      'Uploading the wrong file into a slot.',
    ],
  },
  Review: {
    title: 'Review & submit',
    prepare: [
      'Review every section for accuracy before save.',
      'Confirm documents and member details are complete.',
    ],
    commonMistakes: [
      'Saving with placeholder documents.',
      'Skipping a final check of phone numbers and IDs.',
    ],
  },
};

export function guidanceForLoanStep(stepTitle: string): GuidancePanel | null {
  return CORE[stepTitle] || null;
}
