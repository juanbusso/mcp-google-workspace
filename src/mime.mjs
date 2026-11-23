import fs from 'node:fs'
import path from 'node:path'

function encodeAttachment(att) {
  const contentType = att.contentType || 'application/octet-stream'
  if (att.filePath) {
    if (!fs.existsSync(att.filePath)) throw new Error(`Attachment not found: ${att.filePath}`)
    return {
      filename: att.filename || path.basename(att.filePath),
      contentType,
      base64: fs.readFileSync(att.filePath).toString('base64')
    }
  }
  if (att.content) {
    const base64 = typeof att.content === 'string'
      ? Buffer.from(att.content).toString('base64')
      : att.content.toString('base64')
    return { filename: att.filename || 'attachment', contentType, base64 }
  }
  return null
}

function alternativeParts(boundary, plainText, htmlBody) {
  return [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    plainText,
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    htmlBody,
    `--${boundary}--`
  ]
}

// Builds an RFC 2822 message (plain, plain+HTML, with or without attachments)
// encoded as base64url, ready for gmail.users.messages.send / drafts.create.
export function createMimeMessage({
  to,
  subject,
  body = '',
  htmlBody = '',
  from,
  cc,
  bcc,
  replyTo,
  inReplyTo,
  references,
  attachments = []
}) {
  const headers = []
  if (to) headers.push(`To: ${to}`)
  if (from) headers.push(`From: ${from}`)
  if (cc) headers.push(`Cc: ${cc}`)
  if (bcc) headers.push(`Bcc: ${bcc}`)
  if (replyTo) headers.push(`Reply-To: ${replyTo}`)
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`)
  if (references) headers.push(`References: ${references}`)
  headers.push(`Subject: =?UTF-8?B?${Buffer.from(subject || '').toString('base64')}?=`)
  headers.push('MIME-Version: 1.0')

  const encoded = (attachments || []).map(encodeAttachment).filter(Boolean)
  const hasHtml = Boolean(htmlBody)
  const plainText = body || (htmlBody ? htmlBody.replace(/<[^>]+>/g, '') : '')
  const stamp = Date.now().toString(16)
  let mimeString

  if (!encoded.length && !hasHtml) {
    headers.push('Content-Type: text/plain; charset="UTF-8"')
    headers.push('Content-Transfer-Encoding: 8bit')
    mimeString = `${headers.join('\r\n')}\r\n\r\n${plainText}`
  } else if (!encoded.length) {
    const altBoundary = `__ALT_BOUNDARY_${stamp}__`
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`)
    mimeString = [headers.join('\r\n'), '', ...alternativeParts(altBoundary, plainText, htmlBody)].join('\r\n')
  } else {
    const mixedBoundary = `__MIXED_BOUNDARY_${stamp}__`
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`)
    const parts = [headers.join('\r\n'), '', `--${mixedBoundary}`]

    if (hasHtml) {
      const altBoundary = `__ALT_BOUNDARY_${stamp}__`
      parts.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`, '')
      parts.push(...alternativeParts(altBoundary, plainText, htmlBody))
    } else {
      parts.push('Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: 8bit', '', plainText)
    }

    for (const file of encoded) {
      parts.push(
        `--${mixedBoundary}`,
        `Content-Type: ${file.contentType}; name="${file.filename}"`,
        `Content-Disposition: attachment; filename="${file.filename}"`,
        'Content-Transfer-Encoding: base64',
        '',
        file.base64
      )
    }

    parts.push(`--${mixedBoundary}--`)
    mimeString = parts.join('\r\n')
  }

  return Buffer.from(mimeString)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
