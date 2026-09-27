/**
 * Clean & Format Headers before saving (.eml export)
 *
 * Header Templates Configuration & Rules:
 * 1. From:
 *    - If enabled: applies user template (e.g., '"Sender" <user@[RDNS]>', '[RDNS]', etc.)
 *    - If disabled: keeps original From intact.
 *
 * 2. To:
 *    - If enabled: replaces with user template (e.g., '[*to]')
 *    - If disabled: keeps original To intact.
 *
 * 3. Cc:
 *    - If enabled: replaces with user template (e.g., '[*to]')
 *    - If 'Always present' is checked and no Cc line exists, inserts after To:.
 *    - If disabled: keeps original Cc intact.
 *
 * 4. Date:
 *    - If enabled: replaces with user template (e.g., '[DATE]', '[*Date]')
 *    - If disabled: keeps original Date intact.
 *
 * 5. Subject:
 *    - If enabled: prepends prefix (e.g., 'RE: ') to original subject.
 *    - If disabled: preserves original subject 100% intact.
 *
 * 6. Message-ID:
 *    - If enabled: injects tag before @ (e.g., '<123456[EID]@domain.com>').
 *    - If disabled: keeps original Message-ID intact.
 *
 * 7. Body & other headers:
 *    - Body is 100% preserved byte-for-byte.
 */

import { CleanHeadersConfig, DEFAULT_CLEAN_HEADERS_CONFIG } from '../types.js';

interface HeaderBlock {
  name: string; // lowercased header name for matching
  originalName: string;
  lines: string[];
}

const DEFAULT_HEADERS_TO_REMOVE = new Set([
  'received-spf',
  'authentication-results',
  'dkim-signature',
  'return-path',
  'sender',
]);

/**
 * Format From: header line by replacing ONLY the domain part after @.
 * Preserves original sender Display Name (e.g. "Quartz Crypto") and username (e.g. crypto) 100% intact.
 * Example:
 *   From: "Quartz Crypto" <crypto@sgssdgsfzfzezzzfzf>
 *   => From: "Quartz Crypto" <crypto@[RDNS]>
 */
export function formatFromLine(originalLine: string, domainReplacement: string): string {
  if (!originalLine || !originalLine.includes('@')) {
    return originalLine;
  }

  // Sanitize user-provided replacement: default to '[RDNS]' if blank
  let cleanDomain = (domainReplacement ?? '').trim() || '[RDNS]';
  // If user accidentally entered leading '@', strip it so we don't end up with @@[RDNS]
  if (cleanDomain.startsWith('@')) {
    cleanDomain = cleanDomain.slice(1).trim() || '[RDNS]';
  }
  // If user entered a full template string like <...@macro>, extract the domain/macro
  const domainMatch = cleanDomain.match(/@([^>\s,]+)/);
  if (domainMatch) {
    cleanDomain = domainMatch[1];
  }

  // Replace only the domain part after @ up to the closing > or whitespace/comma
  // In: From: "Quartz Crypto" <crypto@sgssdgsfzfzezzzfzf>
  // Out: From: "Quartz Crypto" <crypto@[RDNS]>
  return originalLine.replace(/(@)[^>\s,]+/, (_, at) => `${at}${cleanDomain}`);
}

/**
 * Transforms header block lines according to user's saved template configuration
 */
export function cleanAndFormatHeadersString(
  rawHeadersStr: string,
  config: Partial<CleanHeadersConfig> = {}
): string {
  const fullConfig: CleanHeadersConfig = {
    ...DEFAULT_CLEAN_HEADERS_CONFIG,
    ...config,
  };

  // If header cleaning is globally disabled, return original string untouched
  if (!fullConfig.enabled) {
    return rawHeadersStr;
  }

  const rawLines = rawHeadersStr.split(/\r?\n/);

  // 1. Trim lines before Return-Path: header (if enabled)
  let returnPathLineIdx = -1;
  if (fullConfig.trimBeforeReturnPath !== false) {
    for (let i = 0; i < rawLines.length; i++) {
      if (/^Return-Path:\s*/i.test(rawLines[i])) {
        returnPathLineIdx = i;
        break;
      }
    }
  }

  const linesAfterTrim =
    returnPathLineIdx !== -1 ? rawLines.slice(returnPathLineIdx) : rawLines;

  // 2. Parse into logical header blocks (handling multiline folding)
  const headerBlocks: HeaderBlock[] = [];
  let currentBlock: HeaderBlock | null = null;

  for (const line of linesAfterTrim) {
    // Folded line (starts with space or tab)
    if (/^[ \t]/.test(line) && currentBlock) {
      currentBlock.lines.push(line);
    } else {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const originalName = line.slice(0, colonIdx).trim();
        currentBlock = {
          name: originalName.toLowerCase(),
          originalName,
          lines: [line],
        };
        headerBlocks.push(currentBlock);
      } else if (currentBlock) {
        currentBlock.lines.push(line);
      }
    }
  }

  // 3. Remove specific security/SPF headers if enabled
  const headersToRemove = fullConfig.removeSpfAuthHeaders !== false
    ? DEFAULT_HEADERS_TO_REMOVE
    : new Set<string>();

  const filteredBlocks = headerBlocks.filter(
    (b) => !headersToRemove.has(b.name)
  );

  // Pre-check if a Cc: header exists anywhere
  const hasCc = filteredBlocks.some((b) => b.name === 'cc');
  let seenCc = false;

  // 4. Apply header transformations
  for (const block of filteredBlocks) {
    // FROM:
    if (block.name === 'from') {
      if (fullConfig.fromEnabled) {
        const replacement = fullConfig.fromDomainReplacement || fullConfig.fromTemplate || '[RDNS]';
        block.lines = block.lines.map((line) => formatFromLine(line, replacement));
      }
    }

    // TO:
    if (block.name === 'to') {
      if (fullConfig.toEnabled) {
        const toVal = (fullConfig.toTemplate || '[*to]').replace(/^To:\s*/i, '').trim();
        block.lines = [`To: ${toVal}`];

        // If Cc is enabled, always present, and no original Cc existed, insert it after To:
        if (fullConfig.ccEnabled && fullConfig.ccAlwaysPresent && !hasCc) {
          const ccVal = (fullConfig.ccTemplate || '[*to]').replace(/^Cc:\s*/i, '').trim();
          block.lines.push(`Cc: ${ccVal}`);
        }
      }
    }

    // CC:
    if (block.name === 'cc') {
      if (fullConfig.ccEnabled) {
        if (!seenCc) {
          const ccVal = (fullConfig.ccTemplate || '[*to]').replace(/^Cc:\s*/i, '').trim();
          block.lines = [`Cc: ${ccVal}`];
          seenCc = true;
        } else {
          block.lines = []; // Discard any duplicate Cc blocks
        }
      }
    }

    // DATE:
    if (block.name === 'date') {
      if (fullConfig.dateEnabled) {
        const dateVal = (fullConfig.dateTemplate || '[DATE]').replace(/^Date:\s*/i, '').trim();
        block.lines = [`Date: ${dateVal}`];
      }
    }

    // SUBJECT:
    if (block.name === 'subject') {
      if (fullConfig.subjectEnabled) {
        const firstLine = block.lines[0] || '';
        const colonIdx = firstLine.indexOf(':');
        const origSubject = colonIdx !== -1 ? firstLine.slice(colonIdx + 1).trim() : '';
        const prefix = (fullConfig.subjectPrefix || 'RE: ').trimEnd() + ' ';
        
        // Avoid duplicate prefix if already present
        const hasPrefix = origSubject.toLowerCase().startsWith(prefix.trim().toLowerCase());
        const finalSubject = hasPrefix ? origSubject : `${prefix}${origSubject}`;
        block.lines = [`Subject: ${finalSubject}`];
      }
      // If subjectEnabled is false, keep original subject intact!
    }

    // MESSAGE-ID:
    if (block.name === 'message-id') {
      if (fullConfig.messageIdEnabled) {
        const tag = (fullConfig.messageIdTag || '[EID]').trim();
        block.lines = block.lines.map((line) => {
          if (!line.includes(`${tag}@`) && line.includes('@')) {
            return line.replace(/@/, `${tag}@`);
          }
          return line;
        });
      }
    }
  }

  // Reassemble headers
  const finalLines: string[] = [];
  for (const block of filteredBlocks) {
    for (const line of block.lines) {
      if (line.trim().length > 0) {
        finalLines.push(line);
      }
    }
  }

  return finalLines.join('\r\n');
}

/**
 * Splits email bytes into Header and untouched Body, applies header transformations,
 * and recombines with \r\n\r\n while keeping the body 100% untouched byte-for-byte.
 */
export function cleanAndFormatEmlBytes(
  rawBytes: Uint8Array,
  config: Partial<CleanHeadersConfig> = {}
): Uint8Array {
  // If cleaning is not enabled, return raw bytes untouched
  if (config.enabled === false) {
    return rawBytes;
  }

  let headerEndIdx = -1;
  let bodyStartIdx = -1;

  for (let i = 0; i < rawBytes.length - 1; i++) {
    // Check for \r\n\r\n
    if (
      i + 3 < rawBytes.length &&
      rawBytes[i] === 13 &&
      rawBytes[i + 1] === 10 &&
      rawBytes[i + 2] === 13 &&
      rawBytes[i + 3] === 10
    ) {
      headerEndIdx = i;
      bodyStartIdx = i + 4;
      break;
    }
    // Check for \n\n
    if (rawBytes[i] === 10 && rawBytes[i + 1] === 10) {
      headerEndIdx = i;
      bodyStartIdx = i + 2;
      break;
    }
  }

  let headersBytes: Uint8Array;
  let bodyBytes: Uint8Array;

  if (headerEndIdx !== -1) {
    headersBytes = rawBytes.subarray(0, headerEndIdx);
    bodyBytes = rawBytes.subarray(bodyStartIdx);
  } else {
    // Entire message is headers, empty body
    headersBytes = rawBytes;
    bodyBytes = new Uint8Array(0);
  }

  const rawHeadersStr = new TextDecoder('utf-8').decode(headersBytes);
  const transformedHeadersStr = cleanAndFormatHeadersString(rawHeadersStr, config);
  const transformedHeadersBytes = new TextEncoder().encode(transformedHeadersStr);

  const crlf2 = new Uint8Array([13, 10, 13, 10]);
  const resultBytes = new Uint8Array(
    transformedHeadersBytes.length + crlf2.length + bodyBytes.length
  );

  resultBytes.set(transformedHeadersBytes, 0);
  resultBytes.set(crlf2, transformedHeadersBytes.length);
  resultBytes.set(bodyBytes, transformedHeadersBytes.length + crlf2.length);

  return resultBytes;
}
