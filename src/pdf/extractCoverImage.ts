import type { PDFPageProxy } from 'pdfjs-dist'
import { getPdfjs } from './pdfjs'

// A crop only counts as "the cover photo" (rather than a small logo or the
// whole page background) when it covers a plausible fraction of the page —
// below this it's probably a badge/icon, above it the crop wouldn't
// meaningfully differ from just using the full page.
const MIN_COVER_AREA_RATIO = 0.08
const MAX_COVER_AREA_RATIO = 0.97

type Pdfjs = Awaited<ReturnType<typeof getPdfjs>>

// Finds the largest single embedded image on the page, in PDF user-space
// points, by replaying the page's operator list and tracking the current
// transformation matrix through save/restore/cm — the same imaging model
// pdf.js's own renderer uses. An image XObject is always painted into the
// unit square under the CTM in effect at that point in the stream, so its
// on-page bounding box is that unit square mapped through the CTM.
async function findLargestImageRect(page: PDFPageProxy, pdfjs: Pdfjs): Promise<[number, number, number, number] | null> {
  const { OPS, Util } = pdfjs
  const opList = await page.getOperatorList()

  let ctm: number[] = [1, 0, 0, 1, 0, 0]
  const stack: number[][] = []
  let bestArea = 0
  let bestRect: [number, number, number, number] | null = null

  for (let i = 0; i < opList.fnArray.length; i += 1) {
    const fn = opList.fnArray[i]
    if (fn === OPS.save) {
      stack.push(ctm)
    } else if (fn === OPS.restore) {
      ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0]
    } else if (fn === OPS.transform) {
      const args = opList.argsArray[i] as number[]
      ctm = Util.transform(ctm, args)
    } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      const bbox = [Infinity, Infinity, -Infinity, -Infinity]
      Util.axialAlignedBoundingBox([0, 0, 1, 1], ctm, bbox)
      const width = bbox[2]! - bbox[0]!
      const height = bbox[3]! - bbox[1]!
      const area = width * height
      if (width > 0 && height > 0 && area > bestArea) {
        bestArea = area
        bestRect = [bbox[0]!, bbox[1]!, bbox[2]!, bbox[3]!]
      }
    }
  }

  return bestRect
}

// Crops an already-rendered full-page canvas down to its largest embedded
// image, converted from PDF user space to the canvas's own pixel space via
// the same viewport transform used to render it. Returns null (caller
// keeps the full-page render) whenever no image is found, the detected
// region is implausible, or anything in the operator list doesn't match
// what this heuristic expects — real-world PDFs vary enough that failing
// safe matters more than a cropped cover.
export async function cropToCoverImage(page: PDFPageProxy, viewportTransform: number[], sourceCanvas: HTMLCanvasElement): Promise<Blob | null> {
  try {
    const pdfjs = await getPdfjs()
    const userRect = await findLargestImageRect(page, pdfjs)
    if (!userRect) return null

    const pixelBox = [Infinity, Infinity, -Infinity, -Infinity]
    pdfjs.Util.axialAlignedBoundingBox(userRect, viewportTransform, pixelBox)

    const x = Math.max(0, Math.round(pixelBox[0]!))
    const y = Math.max(0, Math.round(pixelBox[1]!))
    const width = Math.min(sourceCanvas.width - x, Math.round(pixelBox[2]! - pixelBox[0]!))
    const height = Math.min(sourceCanvas.height - y, Math.round(pixelBox[3]! - pixelBox[1]!))
    if (width <= 0 || height <= 0) return null

    const pageArea = sourceCanvas.width * sourceCanvas.height
    const cropRatio = (width * height) / pageArea
    if (cropRatio < MIN_COVER_AREA_RATIO || cropRatio > MAX_COVER_AREA_RATIO) return null

    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = width
    cropCanvas.height = height
    const context = cropCanvas.getContext('2d')
    if (!context) return null
    context.drawImage(sourceCanvas, x, y, width, height, 0, 0, width, height)

    return await new Promise<Blob | null>((resolve) => {
      cropCanvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8)
    })
  } catch (error) {
    console.error('Failed to crop pattern cover to its embedded image', error)
    return null
  }
}
