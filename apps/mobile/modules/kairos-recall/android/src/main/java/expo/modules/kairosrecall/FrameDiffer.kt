package expo.modules.kairosrecall

import android.graphics.Bitmap
import kotlin.math.abs
import kotlin.math.max

/**
 * Grid luminance differencing with regional sensitivity.
 * Global average alone misses localized UI updates (titles, prices, results).
 */
object FrameDiffer {
  private const val GRID = 16

  data class DiffResult(
    val changed: Boolean,
    /** 0..1 average cell delta / 255 */
    val avgNorm: Double,
    /** 0..1 max cell delta / 255 */
    val maxNorm: Double,
    /** Fraction of cells above a small delta */
    val changedCellFraction: Double,
    val strongChange: Boolean,
  )

  fun signature(bitmap: Bitmap): LongArray {
    val w = bitmap.width.coerceAtLeast(1)
    val h = bitmap.height.coerceAtLeast(1)
    val cellW = (w / GRID).coerceAtLeast(1)
    val cellH = (h / GRID).coerceAtLeast(1)
    val out = LongArray(GRID * GRID)
    var idx = 0
    for (gy in 0 until GRID) {
      for (gx in 0 until GRID) {
        var sum = 0L
        var count = 0
        val x0 = gx * cellW
        val y0 = gy * cellH
        val x1 = (x0 + cellW).coerceAtMost(w)
        val y1 = (y0 + cellH).coerceAtMost(h)
        var y = y0
        while (y < y1) {
          var x = x0
          while (x < x1) {
            val c = bitmap.getPixel(x, y)
            val r = (c shr 16) and 0xff
            val g = (c shr 8) and 0xff
            val b = c and 0xff
            sum += (r * 30L + g * 59L + b * 11L) / 100L
            count += 1
            x += 2
          }
          y += 2
        }
        out[idx++] = if (count == 0) 0 else sum / count
      }
    }
    return out
  }

  fun diff(previous: LongArray?, current: LongArray): DiffResult {
    if (previous == null || previous.size != current.size) {
      return DiffResult(
        changed = true,
        avgNorm = 1.0,
        maxNorm = 1.0,
        changedCellFraction = 1.0,
        strongChange = true,
      )
    }
    var sum = 0L
    var maxDelta = 0L
    var changedCells = 0
    for (i in current.indices) {
      val d = abs(current[i] - previous[i])
      sum += d
      if (d > maxDelta) maxDelta = d
      // Localized content edits often move a cell by ~12–40 luminance.
      if (d >= 12) changedCells += 1
    }
    val avg = sum.toDouble() / current.size
    val avgNorm = avg / 255.0
    val maxNorm = maxDelta.toDouble() / 255.0
    val frac = changedCells.toDouble() / current.size

    // Trigger OCR when either:
    // - enough cells moved (scroll / results refresh), or
    // - a region changed a lot (title/price/hero), or
    // - modest global shift.
    val changed = frac >= 0.06 || maxDelta >= 22 || avg >= 8
    val strong = frac >= 0.18 || maxDelta >= 40 || avg >= 18
    return DiffResult(changed, avgNorm, maxNorm, frac, strong)
  }

  /** Adaptive sample interval: active UI → faster; static → slower. */
  fun nextSampleIntervalMs(diff: DiffResult, baselineMs: Long): Long {
    return when {
      diff.strongChange -> max(400L, baselineMs / 2)
      diff.changed -> baselineMs
      else -> (baselineMs * 2).coerceAtMost(2500L)
    }
  }
}
