import fs from 'node:fs';

const sqlPath =
  'C:/Users/Uwezo3/Downloads/Apps/Uwezo App/source/github/Wezesha-LAS-master/backups/majuu_portal_20260724.sql';
const lasPath =
  'C:/Users/Uwezo3/Downloads/Apps/Uwezo App/source/github/LAS-main/admin/web/modules/custom/uwezo_groups/data/kenya_counties_constituencies.json';
const outPath = new URL('../src/data/kenya-locations.ts', import.meta.url);

const sql = fs.readFileSync(sqlPath, 'utf8');
const las = JSON.parse(fs.readFileSync(lasPath, 'utf8'));

function sliceInsert(table) {
  const start = sql.indexOf(`INSERT INTO \`${table}\` VALUES`);
  const end = sql.indexOf('ENABLE KEYS', start);
  return sql.slice(start, end);
}

function tuples(block) {
  const rows = [];
  const pattern = /\(([^)]*)\)/g;
  let match;
  while ((match = pattern.exec(block))) {
    const values = [];
    let current = '';
    let quote = false;
    for (const char of match[1]) {
      if (char === "'") {
        quote = !quote;
        continue;
      }
      if (char === ',' && !quote) {
        values.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    if (current.trim()) values.push(current.trim());
    rows.push(values);
  }
  return rows;
}

function titleCaseLabel(name) {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const counties = tuples(sliceInsert('counties')).map(([id, name]) => ({
  id: Number(id),
  name,
}));
const constituencies = tuples(sliceInsert('constituencies')).map(([id, name, countyId]) => ({
  id: Number(id),
  name,
  countyId: Number(countyId),
}));
const wards = tuples(sliceInsert('wards')).map(([, name, constituencyId]) => ({
  name,
  constituencyId: Number(constituencyId),
}));

const lasByCode = new Map(las.counties.map((county) => [county.code, county]));
const unmatched = [];

const tree = counties
  .sort((a, b) => a.id - b.id)
  .map((county) => {
    const lasCounty = lasByCode.get(county.id);
    if (!lasCounty) unmatched.push(`county id ${county.id} ${county.name}`);
    const lasNames = new Map(
      (lasCounty?.constituencies || []).map((name) => [name.toUpperCase(), name]),
    );
    const rows = constituencies
      .filter((row) => row.countyId === county.id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((row) => {
        const loanOverrides = { 'MT. ELGON': 'Mount Elgon' };
        const loanName = loanOverrides[row.name] || lasNames.get(row.name.toUpperCase());
        if (!loanName) unmatched.push(`${county.name} / ${row.name}`);
        lasNames.delete(row.name.toUpperCase());
        if (loanOverrides[row.name]) lasNames.delete('MOUNT ELGON');
        return {
          name: row.name,
          loanName: loanName || titleCaseLabel(row.name),
          wards: wards
            .filter((ward) => ward.constituencyId === row.id)
            .map((ward) => ward.name)
            .sort((a, b) => a.localeCompare(b)),
        };
      });
    if (county.id === 13 && lasNames.has("CHUKA/IGAMBANG'OMBE")) {
      rows.push({
        name: "CHUKA/IGAMBANG'OMBE",
        loanName: "Chuka/Igambang'ombe",
        wards: ["IGAMBANG'OMBE", 'KARINGANI', 'MAGUMONI', 'MARIANI', 'MUGWE'],
      });
      lasNames.delete("CHUKA/IGAMBANG'OMBE");
    }
    for (const leftover of lasNames.values()) unmatched.push(`LAS only ${county.name} / ${leftover}`);
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return {
      code: county.id,
      name: county.name,
      loanName: lasCounty?.name || county.name,
      constituencies: rows,
    };
  });

const body = `/** County, constituency, and ward names from the Majuu portal database.
 * Loan names follow LAS kenya_counties_constituencies.json where they match.
 */
export type KenyaWard = { name: string; loanName: string };
export type KenyaConstituency = { name: string; loanName: string; wards: KenyaWard[] };
export type KenyaCounty = { code: number; name: string; loanName: string; constituencies: KenyaConstituency[] };

export const kenyaLocations: KenyaCounty[] = ${JSON.stringify(
  tree.map((county) => ({
    ...county,
    constituencies: county.constituencies.map((row) => ({
      name: row.name,
      loanName: row.loanName,
      wards: row.wards.map((name) => ({ name, loanName: titleCaseLabel(name) })),
    })),
  })),
  null,
  2,
)};
`;

fs.mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true });
fs.writeFileSync(outPath, body);
console.log(
  JSON.stringify(
    {
      counties: tree.length,
      constituencies: constituencies.length,
      wards: wards.length,
      unmatched,
    },
    null,
    2,
  ),
);
