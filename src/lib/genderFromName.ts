const FEMALE = new Set([
  'abigael', 'agatha', 'agnes', 'alice', 'ann', 'anne', 'annah', 'beatrice', 'brenda', 'caren', 'carol', 'caroline',
  'catherine', 'cecilia', 'charity', 'christine', 'cynthia', 'daisy', 'diana', 'doris', 'dorothy', 'edith', 'elizabeth',
  'emily', 'emma', 'esther', 'eunice', 'eva', 'faith', 'florence', 'gladys', 'grace', 'hannah', 'hellen', 'irene',
  'jackline', 'jacqueline', 'jane', 'janet', 'joyce', 'judith', 'julia', 'juliet', 'lucy', 'lydia', 'margaret',
  'martha', 'mary', 'mercy', 'monica', 'nancy', 'naomi', 'patricia', 'pauline', 'peninah', 'phylis', 'phyllis',
  'rachel', 'rebecca', 'rose', 'rosemary', 'ruth', 'sarah', 'sharon', 'stella', 'susan', 'teresa', 'veronica',
  'winnie', 'roda', 'rhoda', 'chepkemboi', 'chepkoech', 'chebet', 'cherono', 'jepchirchir', 'jepkemboi', 'jepkoech',
  'jepngetich', 'jerop', 'chemutai', 'chepngeno',
]);

const MALE = new Set([
  'abraham', 'alfred', 'amos', 'andrew', 'anthony', 'benjamin', 'brian', 'charles', 'daniel', 'david', 'dennis',
  'edwin', 'elijah', 'emmanuel', 'eric', 'felix', 'francis', 'george', 'henry', 'isaac', 'james', 'john', 'joseph',
  'joshua', 'kelvin', 'kevin', 'kipchirchir', 'kipchumba', 'kipkoech', 'kiplagat', 'kiprotich', 'martin', 'michael',
  'moses', 'nicholas', 'patrick', 'paul', 'peter', 'philip', 'richard', 'robert', 'samuel', 'simon', 'stephen',
  'thomas', 'victor', 'vincent', 'william',
]);

/** Guess Male or Female from given names. An unknown name stays blank so the official can choose. */
export function inferGender(fullName: string): 'Male' | 'Female' | '' {
  const tokens = fullName.toLowerCase().split(/[^a-z]+/).filter((token) => token.length > 2);
  for (const token of tokens) {
    if (FEMALE.has(token)) return 'Female';
    if (MALE.has(token)) return 'Male';
  }
  return '';
}
