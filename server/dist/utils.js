import { randomUUID } from 'node:crypto';
export function makeReceiptRef() {
    // Example: RCPT-20260118-AB12CD
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const short = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
    return `RCPT-${y}${m}${day}-${short}`;
}
