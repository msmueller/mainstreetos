// ============================================================
// MainStreetOS — Notion Server Client (Phase 12.13)
// ------------------------------------------------------------
// Thin wrapper around @notionhq/client for AI draft pipelines.
// Requires NOTION_API_KEY + NOTION_AI_DRAFTS_ROOT_PAGE_ID in env.
// The integration must be explicitly shared with the root page
// via Notion Connections.
// ============================================================

import { Client } from '@notionhq/client'

// ─── Lazy-init singleton ──────────────────────────────────────
let _client: Client | null = null

export function getNotionClient(): Client {
  if (_client) return _client
  const auth = process.env.NOTION_API_KEY
  if (!auth) {
    throw new Error(
      '[notion/client] NOTION_API_KEY is not set. Create an internal integration at https://www.notion.so/profile/integrations and add the secret to your env.'
    )
  }
  _client = new Client({ auth })
  return _client
}

export function getAiDraftsRootPageId(): string {
  const id = process.env.NOTION_AI_DRAFTS_ROOT_PAGE_ID
  if (!id) {
    throw new Error(
      '[notion/client] NOTION_AI_DRAFTS_ROOT_PAGE_ID is not set. This should point to the "MSOS AI Drafts" root page.'
    )
  }
  return id
}

// ─── Markdown → Notion blocks (minimal converter) ─────────────
// Handles: H1/H2/H3 headings, bulleted lists (- or *), numbered
// lists (1.), fenced code blocks, blockquotes (>), horizontal
// rules (---), and paragraphs. Inline bold (**x**) and italic
// (*x*) are converted to rich_text annotations. No images/tables.
// Notion's API caps 100 blocks per request.

type NotionBlock = {
  object: 'block'
  type: string
  [k: string]: unknown
}

type RichText = {
  type: 'text'
  text: { content: string }
  annotations?: {
    bold?: boolean
    italic?: boolean
    code?: boolean
  }
}

function parseInlineToRichText(line: string): RichText[] {
  const out: RichText[] = []
  // Simple tokenizer: **bold**, *italic*, `code`
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g
  let lastIdx = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    if (m.index > lastIdx) {
      out.push({ type: 'text', text: { content: line.slice(lastIdx, m.index) } })
    }
    if (m[2] !== undefined) {
      out.push({ type: 'text', text: { content: m[2] }, annotations: { bold: true } })
    } else if (m[3] !== undefined) {
      out.push({ type: 'text', text: { content: m[3] }, annotations: { italic: true } })
    } else if (m[4] !== undefined) {
      out.push({ type: 'text', text: { content: m[4] }, annotations: { code: true } })
    }
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < line.length) {
    out.push({ type: 'text', text: { content: line.slice(lastIdx) } })
  }
  return out.length > 0 ? out : [{ type: 'text', text: { content: line } }]
}

export function markdownToBlocks(md: string): NotionBlock[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: NotionBlock[] = []

  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    const line = raw ?? ''

    // Blank line → skip
    if (line.trim() === '') {
      i++
      continue
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line.trim())) {
      blocks.push({ object: 'block', type: 'divider', divider: {} })
      i++
      continue
    }

    // Fenced code
    if (/^```/.test(line.trim())) {
      const lang = line.trim().replace(/^```/, '').trim() || 'plain text'
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        buf.push(lines[i])
        i++
      }
      i++ // skip closing fence
      blocks.push({
        object: 'block',
        type: 'code',
        code: {
          language: lang,
          rich_text: [{ type: 'text', text: { content: buf.join('\n') } }],
        },
      })
      continue
    }

    // Headings
    const h = /^(#{1,3})\s+(.+)$/.exec(line)
    if (h) {
      const level = h[1].length
      const text = h[2].trim()
      const type = level === 1 ? 'heading_1' : level === 2 ? 'heading_2' : 'heading_3'
      blocks.push({
        object: 'block',
        type,
        [type]: { rich_text: parseInlineToRichText(text) },
      })
      i++
      continue
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const text = line.replace(/^>\s?/, '')
      blocks.push({
        object: 'block',
        type: 'quote',
        quote: { rich_text: parseInlineToRichText(text) },
      })
      i++
      continue
    }

    // Bulleted list item
    if (/^\s*[-*]\s+/.test(line)) {
      const text = line.replace(/^\s*[-*]\s+/, '')
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: parseInlineToRichText(text) },
      })
      i++
      continue
    }

    // Numbered list item
    if (/^\s*\d+\.\s+/.test(line)) {
      const text = line.replace(/^\s*\d+\.\s+/, '')
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: parseInlineToRichText(text) },
      })
      i++
      continue
    }

    // Paragraph (collapse consecutive non-blank lines into one paragraph)
    const paraLines: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,3}\s|>|\s*[-*]\s|\s*\d+\.\s|```|---+\s*$)/.test(lines[i])
    ) {
      paraLines.push(lines[i])
      i++
    }
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: parseInlineToRichText(paraLines.join(' ')) },
    })
  }

  return blocks
}

// ─── Create an AI draft child page under the root ────────────

export interface CreateDraftPageArgs {
  rootPageId: string
  title: string
  bodyMarkdown: string
  icon?: string // emoji, e.g. "📄"
}

export interface CreateDraftPageResult {
  pageId: string
  pageUrl: string
  blocksWritten: number
}

export async function createDraftPage(args: CreateDraftPageArgs): Promise<CreateDraftPageResult> {
  const { rootPageId, title, bodyMarkdown, icon = '📄' } = args
  const notion = getNotionClient()

  const blocks = markdownToBlocks(bodyMarkdown)
  // Notion caps children per create request at 100; we'll take the first 100
  // and append the rest via append_block_children.
  const FIRST_BATCH_LIMIT = 100
  const firstBatch = blocks.slice(0, FIRST_BATCH_LIMIT)
  const rest = blocks.slice(FIRST_BATCH_LIMIT)

  const createResponse = await notion.pages.create({
    parent: { type: 'page_id', page_id: rootPageId },
    icon: { type: 'emoji', emoji: icon as `${string}` },
    properties: {
      title: {
        title: [{ type: 'text', text: { content: title } }],
      },
    },
    // @notionhq/client's typings for nested block objects are strict; cast
    // to unknown here because our markdown converter emits a compatible
    // superset shape.
    children: firstBatch as unknown as Parameters<typeof notion.pages.create>[0]['children'],
  })

  const pageId = (createResponse as { id: string }).id
  const pageUrl = (createResponse as { url?: string }).url ?? `https://www.notion.so/${pageId.replace(/-/g, '')}`

  let blocksWritten = firstBatch.length
  if (rest.length > 0) {
    for (let offset = 0; offset < rest.length; offset += FIRST_BATCH_LIMIT) {
      const chunk = rest.slice(offset, offset + FIRST_BATCH_LIMIT)
      await notion.blocks.children.append({
        block_id: pageId,
        children: chunk as unknown as Parameters<typeof notion.blocks.children.append>[0]['children'],
      })
      blocksWritten += chunk.length
    }
  }

  return { pageId, pageUrl, blocksWritten }
}
