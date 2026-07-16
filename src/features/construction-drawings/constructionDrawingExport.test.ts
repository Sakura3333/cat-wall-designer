import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSvgPresentationStyle, downloadAllSheetSvgs } from './constructionDrawingExport'

describe('buildSvgPresentationStyle', () => {
  it('serializes computed SVG presentation styles for standalone downloads', () => {
    const style = {
      getPropertyValue(property: string) {
        return (
          {
            fill: 'rgba(111, 146, 127, 0.22)',
            stroke: 'rgb(63, 114, 92)',
            'stroke-width': '3px',
            'font-size': '12px',
            'font-weight': '900',
          }[property] ?? ''
        )
      },
    }

    expect(buildSvgPresentationStyle(style)).toContain('fill:rgba(111, 146, 127, 0.22)')
    expect(buildSvgPresentationStyle(style)).toContain('stroke:rgb(63, 114, 92)')
    expect(buildSvgPresentationStyle(style)).toContain('stroke-width:3px')
    expect(buildSvgPresentationStyle(style)).toContain('font-size:12px')
  })
})

describe('downloadAllSheetSvgs', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('inlines computed styles into the exported standalone SVG', () => {
    const sourceRect = new FakeSvgElement('rect')
    const sourceGroup = new FakeSvgElement('g', [sourceRect])
    const sourceSvg = new FakeSvgElement('svg', [sourceGroup])
    sourceGroup.setAttribute('class', 'construction-component')
    sourceSvg.setAttribute('data-sheet-id', 'wall-a')
    sourceSvg.setAttribute('data-sheet-title', '中间墙施工图')

    const styles = new Map<FakeSvgElement, Record<string, string>>([
      [
        sourceRect,
        {
          fill: 'rgba(111, 146, 127, 0.22)',
          stroke: 'rgb(63, 114, 92)',
          'stroke-width': '3px',
        },
      ],
    ])
    const blobs: FakeBlob[] = []
    const links: FakeDownloadLink[] = []

    vi.stubGlobal('window', {
      getComputedStyle(element: FakeSvgElement) {
        return {
          getPropertyValue(property: string) {
            return styles.get(element)?.[property] ?? ''
          },
        }
      },
    })
    vi.stubGlobal('document', {
      querySelectorAll(selector: string) {
        if (selector === '.construction-print-sheets .construction-sheet-svg') return [sourceSvg]
        return []
      },
      createElement() {
        const link = new FakeDownloadLink()
        links.push(link)
        return link
      },
    })
    vi.stubGlobal('XMLSerializer', FakeXmlSerializer)
    vi.stubGlobal('Blob', FakeBlob)
    vi.stubGlobal('URL', {
      createObjectURL(blob: FakeBlob) {
        blobs.push(blob)
        return `blob:test-${blobs.length}`
      },
      revokeObjectURL: vi.fn(),
    })

    downloadAllSheetSvgs('猫墙方案')

    expect(links).toHaveLength(1)
    expect(links[0].download).toContain('猫墙方案-中间墙施工图.svg')
    expect(blobs).toHaveLength(1)
    expect(blobs[0].type).toBe('image/svg+xml;charset=utf-8')
    expect(blobs[0].content).toContain('style="fill:rgba(111, 146, 127, 0.22);stroke:rgb(63, 114, 92);stroke-width:3px"')
  })
})

class FakeSvgElement {
  private readonly attributes = new Map<string, string>()

  constructor(
    private readonly tagName: string,
    private readonly children: FakeSvgElement[] = [],
  ) {}

  cloneNode(): FakeSvgElement {
    const clone = new FakeSvgElement(
      this.tagName,
      this.children.map((child) => child.cloneNode()),
    )
    this.attributes.forEach((value, key) => clone.setAttribute(key, value))
    return clone
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }

  querySelectorAll(): FakeSvgElement[] {
    return this.children.flatMap((child) => [child, ...child.querySelectorAll()])
  }

  toXml(): string {
    const attributes = Array.from(this.attributes, ([key, value]) => ` ${key}="${value}"`).join('')
    return `<${this.tagName}${attributes}>${this.children.map((child) => child.toXml()).join('')}</${this.tagName}>`
  }
}

class FakeBlob {
  readonly content: string
  readonly type: string

  constructor(parts: string[], options: { type: string }) {
    this.content = parts.join('')
    this.type = options.type
  }
}

class FakeDownloadLink {
  href = ''
  download = ''
  click = vi.fn()
}

class FakeXmlSerializer {
  serializeToString(element: FakeSvgElement) {
    return element.toXml()
  }
}
