/**
 * Bundled loans taxonomy snapshot for OfflineApply (CheckboxGroup / selects).
 * Sourced from live Drupal vocabularies + LMS application samples when the
 * taxonomy API is unreachable. Values are term *names* compatible with
 * purposeOfTheGroup / keyActivitiesOfTheGroup on loans.uwezo.go.ke.
 */

export type TaxonomyOption = {
  label: string;
  value: string;
  limitedRole?: boolean;
};

/** group_background → groupPurpose */
export const GROUP_PURPOSE_OPTIONS: TaxonomyOption[] = [
  { label: 'Welfare issues', value: 'Welfare issues' },
  { label: 'Income generating activities', value: 'Income generating activities' },
  { label: 'Common group project', value: 'Common group project' },
];

/**
 * Top-level group_activities (parents). Value-chain children are separate.
 * Includes terms seen in LMS payloads plus live Value chain / Other parents.
 */
export const GROUP_ACTIVITY_OPTIONS: TaxonomyOption[] = [
  { label: 'Value chain', value: 'Value chain' },
  { label: 'Table banking', value: 'Table banking' },
  { label: 'Agribusiness', value: 'Agribusiness' },
  { label: 'Agroforestry', value: 'Agroforestry' },
  { label: 'Apiculture( bee- keeping)', value: 'Apiculture( bee- keeping)' },
  { label: 'Art and Crafts', value: 'Art and Crafts' },
  { label: 'Carpentry and woodwork', value: 'Carpentry and woodwork' },
  { label: 'Catering and food processing', value: 'Catering and food processing' },
  { label: 'Digital and creative economy', value: 'Digital and creative economy' },
  { label: 'Financial services (e.g m-pesa)', value: 'Financial services (e.g m-pesa)' },
  { label: 'Personalized services(salon, barber)', value: 'Personalized services(salon, barber)' },
  { label: 'Wholesale and Retail trade', value: 'Wholesale and Retail trade' },
  { label: 'Other', value: 'Other' },
];

/** Children of “Value chain” (formerly value_chain vocabulary). */
export const VALUE_CHAIN_OPTIONS: TaxonomyOption[] = [
  { label: 'Leather and leather products', value: 'Leather and leather products' },
  { label: 'Cotton and textiles', value: 'Cotton and textiles' },
  { label: 'Blue economy', value: 'Blue economy' },
  { label: 'Edible oils', value: 'Edible oils' },
  { label: 'Construction and building materials', value: 'Construction and building materials' },
  { label: 'Dairy and dairy products', value: 'Dairy and dairy products' },
];

/** position_of_member */
export const MEMBER_POSITION_OPTIONS: TaxonomyOption[] = [
  { label: 'Chairperson', value: 'Chairperson', limitedRole: true },
  { label: 'Chairman', value: 'Chairman', limitedRole: true },
  { label: 'Secretary', value: 'Secretary', limitedRole: true },
  { label: 'Treasurer', value: 'Treasurer', limitedRole: true },
  { label: 'Member', value: 'Member' },
  { label: 'Other', value: 'Other' },
];

/** nature_of_group list_string */
export const NATURE_OF_GROUP_OPTIONS: TaxonomyOption[] = [
  { label: 'Youth', value: 'youth' },
  { label: 'Women', value: 'women' },
  { label: 'People with disabilities', value: 'pwd' },
];

/** nature_of_business */
export const NATURE_OF_BUSINESS_OPTIONS: TaxonomyOption[] = [
  { label: 'Start-up', value: 'startup' },
  { label: 'Expansion', value: 'expansion' },
];

/** business_types */
export const BUSINESS_TYPE_OPTIONS: TaxonomyOption[] = [
  { label: 'Trade', value: 'Trade' },
  { label: 'Service', value: 'Service' },
  { label: 'Manufacturing', value: 'Manufacturing' },
  { label: 'Agriculture', value: 'Agriculture' },
];

export const LOAN_TYPE_OPTIONS: TaxonomyOption[] = [
  {
    label: 'Wezesha (50,000 to 100,000)',
    value: 'Wezesha',
  },
  {
    label: 'Endeleza (75,000 to 500,000)',
    value: 'Endeleza',
  },
];
