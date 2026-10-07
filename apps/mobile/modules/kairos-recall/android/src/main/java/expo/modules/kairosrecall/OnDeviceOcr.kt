package expo.modules.kairosrecall

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.math.max

data class OcrResult(
  val text: String,
  val confidence: Double?,
  val lineCount: Int,
  val blockCount: Int,
)

class OnDeviceOcr {
  private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

  suspend fun extract(bitmap: Bitmap): OcrResult {
    val prepared = prepareForOcr(bitmap)
    val image = InputImage.fromBitmap(prepared, 0)
    return try {
      suspendCancellableCoroutine { cont ->
        recognizer.process(image)
          .addOnSuccessListener { result ->
            val assembled = assembleReadingOrder(result)
            if (cont.isActive) {
              cont.resume(assembled)
            }
          }
          .addOnFailureListener {
            if (cont.isActive) {
              cont.resume(OcrResult(text = "", confidence = null, lineCount = 0, blockCount = 0))
            }
          }
      }
    } finally {
      if (prepared !== bitmap && !prepared.isRecycled) {
        prepared.recycle()
      }
    }
  }

  /**
   * Mild contrast boost + ensure short side is large enough for small UI type.
   * Does not invent pixels beyond a modest upscale.
   */
  internal fun prepareForOcr(bitmap: Bitmap): Bitmap {
    val shortSide = minOf(bitmap.width, bitmap.height)
    val target = 1080
    val scaled =
      if (shortSide in 1 until 720) {
        val factor = target.toFloat() / shortSide
        val w = (bitmap.width * factor).toInt().coerceAtLeast(1)
        val h = (bitmap.height * factor).toInt().coerceAtLeast(1)
        Bitmap.createScaledBitmap(bitmap, w, h, true)
      } else {
        bitmap
      }

    // Light contrast stretch helps grey-on-white product UI without destroying color OCR.
    val out = Bitmap.createBitmap(scaled.width, scaled.height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(out)
    val paint = Paint(Paint.FILTER_BITMAP_FLAG)
    val matrix = ColorMatrix(
      floatArrayOf(
        1.15f, 0f, 0f, 0f, 8f,
        0f, 1.15f, 0f, 0f, 8f,
        0f, 0f, 1.15f, 0f, 8f,
        0f, 0f, 0f, 1f, 0f,
      ),
    )
    paint.colorFilter = ColorMatrixColorFilter(matrix)
    canvas.drawBitmap(scaled, 0f, 0f, paint)
    if (scaled !== bitmap && !scaled.isRecycled) {
      scaled.recycle()
    }
    return out
  }

  /**
   * Rebuild text from blocks/lines sorted by spatial reading order (top→bottom, left→right).
   */
  internal fun assembleReadingOrder(result: Text): OcrResult {
    val blocks = result.textBlocks.sortedWith(
      compareBy<Text.TextBlock>(
        { it.boundingBox?.top ?: 0 },
        { it.boundingBox?.left ?: 0 },
      ),
    )
    val lines = ArrayList<String>()
    var confSum = 0.0
    var confCount = 0
    for (block in blocks) {
      val orderedLines = block.lines.sortedWith(
        compareBy<Text.Line>(
          { it.boundingBox?.top ?: 0 },
          { it.boundingBox?.left ?: 0 },
        ),
      )
      for (line in orderedLines) {
        val t = line.text?.trim().orEmpty()
        if (t.isEmpty()) continue
        lines.add(t)
        val c = line.confidence
        if (c > 0f) {
          confSum += c.toDouble()
          confCount += 1
        }
      }
    }
    val text = if (lines.isNotEmpty()) {
      lines.joinToString("\n")
    } else {
      result.text?.trim().orEmpty()
    }
    val confidence = confSum.takeIf { confCount > 0 }?.div(confCount)
    return OcrResult(
      text = text,
      confidence = confidence,
      lineCount = lines.size.coerceAtLeast(if (text.isBlank()) 0 else max(1, text.lines().size)),
      blockCount = blocks.size,
    )
  }

  fun close() {
    recognizer.close()
  }
}
