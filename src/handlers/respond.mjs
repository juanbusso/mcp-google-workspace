export function json(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

export function text(value) {
  return { content: [{ type: 'text', text: value }] }
}
