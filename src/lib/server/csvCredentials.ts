import fs from 'node:fs';
import path from 'node:path';

export interface SafeDeviceRecord {
	name: string;
	ip: string;
	port: string;
	user: string;
	notes: string;
	hasPassword: boolean;
}

export function parseRfc4180Csv(raw: string): string[][] {
	const rows: string[][] = [];
	let currentRow: string[] = [];
	let currentField = '';
	let inQuotes = false;

	for (let i = 0; i < raw.length; i++) {
		const ch = raw[i];
		const next = raw[i + 1];
		if (inQuotes) {
			if (ch === '"' && next === '"') {
				currentField += '"';
				i++;
			} else if (ch === '"') {
				inQuotes = false;
			} else {
				currentField += ch;
			}
		} else {
			if (ch === '"') {
				inQuotes = true;
			} else if (ch === ',') {
				currentRow.push(currentField.trim());
				currentField = '';
			} else if (ch === '\r' && next === '\n') {
				currentRow.push(currentField.trim());
				rows.push(currentRow);
				currentRow = [];
				currentField = '';
				i++;
			} else if (ch === '\n' || ch === '\r') {
				currentRow.push(currentField.trim());
				rows.push(currentRow);
				currentRow = [];
				currentField = '';
			} else {
				currentField += ch;
			}
		}
	}
	if (currentField.length > 0 || currentRow.length > 0) {
		currentRow.push(currentField.trim());
		rows.push(currentRow);
	}
	return rows.filter((r) => r.some((cell) => cell.length > 0));
}

export function loadSafeDeviceInventory(csvPath?: string): SafeDeviceRecord[] {
	const resolved = csvPath || process.env.ACCESS_CSV_PATH || path.resolve('secrets.csv');
	const fallbackExample = path.resolve('secrets.csv.example');
	const targetPath = fs.existsSync(resolved) ? resolved : fallbackExample;
	if (!fs.existsSync(targetPath)) return [];

	const rows = parseRfc4180Csv(fs.readFileSync(targetPath, 'utf-8'));
	if (rows.length < 2) return [];

	const headers = rows[0].map((h) => h.toLowerCase());
	const idxName = headers.indexOf('name');
	const idxIp = headers.indexOf('ip');
	const idxPort = headers.indexOf('port');
	const idxUser = headers.indexOf('user');
	const idxPass = headers.indexOf('password');
	const idxNotes = headers.indexOf('notes');

	return rows.slice(1).map((cols) => ({
		name: cols[idxName] ?? '',
		ip: cols[idxIp] ?? '',
		port: cols[idxPort] ?? '22',
		user: cols[idxUser] ?? '',
		notes: cols[idxNotes] ?? '',
		hasPassword: Boolean(idxPass >= 0 && cols[idxPass])
	}));
}
