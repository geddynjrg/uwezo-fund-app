import { kenyaLocations, type KenyaCounty } from '../data/kenya-locations';
import type { OfflineProduct } from './offlineApply';

export type LocationChoice = { label: string; value: string };

/** Same ward label casing as Wezesha-LAS titleCaseLabel. */
function titleCaseLabel(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function countyLabel(county: KenyaCounty, product: OfflineProduct) {
  return product === 'majuu' ? county.name : county.loanName;
}

function findCounty(name: string) {
  const key = name.trim().toLowerCase();
  return kenyaLocations.find(
    (county) => county.name.toLowerCase() === key || county.loanName.toLowerCase() === key,
  );
}

/** Loans keep the LAS county order. Majuu lists counties alphabetically. */
export function countyChoices(product: OfflineProduct): LocationChoice[] {
  const rows = kenyaLocations.map((county) => {
    const value = countyLabel(county, product);
    return { label: value, value };
  });
  if (product === 'majuu') rows.sort((a, b) => a.label.localeCompare(b.label));
  return rows;
}

export function constituencyChoices(product: OfflineProduct, countyName: string): LocationChoice[] {
  const county = findCounty(countyName);
  if (!county) return [];
  return county.constituencies
    .map((row) => {
      const value = product === 'majuu' ? row.name : row.loanName;
      return { label: value, value };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function wardChoices(
  product: OfflineProduct,
  countyName: string,
  constituencyName: string,
): LocationChoice[] {
  const county = findCounty(countyName);
  if (!county) return [];
  const key = constituencyName.trim().toLowerCase();
  const constituency = county.constituencies.find(
    (row) => row.name.toLowerCase() === key || row.loanName.toLowerCase() === key,
  );
  if (!constituency) return [];
  return constituency.wards
    .map((ward) => ({
      label: product === 'majuu' ? titleCaseLabel(ward.name) : ward.loanName,
      value: product === 'majuu' ? ward.name : ward.loanName,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
