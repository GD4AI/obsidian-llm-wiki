// A notice that tells the user to run a command by name must name a real one.
//
// `watchIngestNotice` used to carry a hardcoded translation of "Ingest Sources"
// in all eleven locales. No command is registered under that name: the palette
// says "Ingest from folder" (`cmdIngestFolder`), so a user who followed the
// notice went looking for something that does not exist. Each locale was free
// to invent its own wrong name, which is why the fix is not eleven hand edits.
//
// The message now carries `{command}` and the call site fills it from the same
// table the palette reads. `i18n-command-name-parity.test.ts` covers the
// READMEs for the same class of defect (#793); this covers the notices.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TEXTS } from '../../texts';

const LOCALES = Object.keys(TEXTS) as Array<keyof typeof TEXTS>;

describe('#1048 — a notice names the command the palette registers', () => {
  it.each(LOCALES)('locale "%s" leaves the command name to the call site', (locale) => {
    const notice = (TEXTS[locale] as unknown as Record<string, string>).watchIngestNotice;
    expect(notice, `${locale} has no watchIngestNotice`).toBeTruthy();
    expect(notice, `${locale} hardcodes a command name instead of {command}`).toContain('{command}');
  });

  it('the call site fills {command} from the command table', () => {
    const source = readFileSync(join(process.cwd(), 'src', 'schema', 'auto-maintain.ts'), 'utf8');
    const at = source.indexOf('texts.watchIngestNotice');
    expect(at).toBeGreaterThan(-1);
    const chain = source.slice(at, at + 500);
    expect(chain).toContain(".replace('{count}'");
    expect(chain).toContain(".replace('{command}', texts.cmdIngestFolder)");
  });
});
