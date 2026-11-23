function columnToNumber(col) {
  let n = 0
  for (const ch of String(col).toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

function numberToColumn(n) {
  let col = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    col = String.fromCharCode(65 + rem) + col
    n = Math.floor((n - 1) / 26)
  }
  return col
}

function truncate(cell) {
  return cell.length > 80 ? cell.slice(0, 80) + '…' : cell
}

// 'Sheet 1'!D2:D35 | Sheet1!D2:E | D2:D35 → { sheetPrefix, startCol, endCol, startRow }
function parseA1Range(range) {
  const str = String(range || '')
  const bang = str.lastIndexOf('!')
  const sheetPrefix = bang >= 0 ? str.slice(0, bang + 1) : ''
  const cells = bang >= 0 ? str.slice(bang + 1) : str
  const m = cells.match(/^\$?([A-Za-z]+)\$?(\d+)?(?::\$?([A-Za-z]+)\$?(\d+)?)?$/)
  if (!m) return null
  return {
    sheetPrefix,
    startCol: m[1].toUpperCase(),
    endCol: (m[3] || m[1]).toUpperCase(),
    startRow: m[2] ? Number(m[2]) : 1
  }
}

// Refuses writes that would overwrite formulas in the target range or break an
// ARRAYFORMULA spilling into it from above, unless explicitly allowed.
export async function assertSafeSheetWrite(sheets, spreadsheetId, range, values, { allowFormulaOverwrite = false } = {}) {
  if (allowFormulaOverwrite) return

  const existing = await sheets.spreadsheets.values.get({ spreadsheetId, range, valueRenderOption: 'FORMULA' })
  const parsed = parseA1Range(range)
  const startColNum = parsed ? columnToNumber(parsed.startCol) : 1
  const startRow = parsed ? parsed.startRow : 1
  const toA1 = (r, c) => `${numberToColumn(startColNum + c)}${startRow + r}`

  const formulaCells = []
  ;(existing.data.values || []).forEach((row, r) => {
    ;(row || []).forEach((cell, c) => {
      // null/undefined are skipped by the API; '' does clear the cell
      const willWrite = values?.[r]?.[c] !== undefined && values?.[r]?.[c] !== null
      if (willWrite && typeof cell === 'string' && cell.startsWith('=')) {
        formulaCells.push(`${toA1(r, c)} (${truncate(cell)})`)
      }
    })
  })
  if (formulaCells.length) {
    throw new Error(
      `Write blocked: range ${range} has ${formulaCells.length} formula cell(s) that would be overwritten: ${formulaCells.slice(0, 20).join('; ')}` +
      `${formulaCells.length > 20 ? ' …' : ''}. Pass allowFormulaOverwrite: true only if replacing those formulas is intended.`
    )
  }

  if (parsed && startRow > 1) {
    const above = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${parsed.sheetPrefix}${parsed.startCol}1:${parsed.endCol}${startRow - 1}`,
      valueRenderOption: 'FORMULA'
    })
    const arrayFormulas = []
    ;(above.data.values || []).forEach((row, r) => {
      ;(row || []).forEach((cell, c) => {
        if (typeof cell === 'string' && cell.startsWith('=') && /ARRAYFORMULA\s*\(/i.test(cell)) {
          arrayFormulas.push(`${numberToColumn(startColNum + c)}${r + 1} (${truncate(cell)})`)
        }
      })
    })
    if (arrayFormulas.length) {
      throw new Error(
        `Write blocked: an ARRAYFORMULA above ${range} spills into those rows: ${arrayFormulas.join('; ')}. ` +
        'Writing values there breaks it with #REF!. Change the source formula or pass allowFormulaOverwrite: true only if intended.'
      )
    }
  }
}

const SHEET_FORMULA_ERRORS = ['#REF!', '#ERROR!', '#NAME?', '#N/A', '#VALUE!', '#DIV/0!']

function isNonEmptyCell(cell) {
  return cell !== null && cell !== undefined && cell !== ''
}

function countNonEmpty(matrix) {
  let n = 0
  for (const row of matrix || []) for (const cell of row || []) if (isNonEmptyCell(cell)) n++
  return n
}

// Reads back what was written: a 200 from values.update does not guarantee the cell
// shows the value (e.g. an ARRAYFORMULA overriding it, or a #REF!). On mismatch it
// throws so the caller gets isError instead of confirming a write that did not land.
export async function verifySheetWrite(sheets, spreadsheetId, verifiedRange, values, { updatedRows } = {}) {
  const readback = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: verifiedRange,
    valueRenderOption: 'FORMATTED_VALUE'
  })
  const readValues = readback.data.values || []
  const expectedNonEmpty = countNonEmpty(values)
  const actualNonEmpty = countNonEmpty(readValues)

  const formulaErrors = []
  readValues.forEach((row, r) => {
    ;(row || []).forEach((cell, c) => {
      if (isNonEmptyCell(values?.[r]?.[c]) && SHEET_FORMULA_ERRORS.includes(String(cell).trim())) {
        formulaErrors.push({ row: r, col: c, value: cell })
      }
    })
  })

  const problems = []
  if (expectedNonEmpty > 0 && actualNonEmpty < expectedNonEmpty) {
    problems.push(`expected ${expectedNonEmpty} non-empty cells but read back ${actualNonEmpty}`)
  }
  if (updatedRows === 0 && expectedNonEmpty > 0) problems.push('the API reported updatedRows = 0')
  if (formulaErrors.length) {
    problems.push(`formula errors in written cells: ${formulaErrors.slice(0, 10).map((e) => `[row ${e.row + 1}, col ${e.col + 1}] ${e.value}`).join('; ')}`)
  }
  if (problems.length) {
    throw new Error(
      `Post-write verification FAILED for ${verifiedRange}: ${problems.join(' | ')}. ` +
      `Do not report the write as successful. Read-back sample: ${JSON.stringify(readValues.slice(0, 5))}`
    )
  }

  return {
    verifiedOk: true,
    verifiedRange,
    expectedNonEmpty,
    actualNonEmpty,
    readRowsCount: readValues.length,
    sampleRows: readValues.slice(0, 3)
  }
}
