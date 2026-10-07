import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { MulterError } from 'multer';
import type { Response } from 'express';
import { MAX_UPLOAD_BYTES } from '../observations/file-validation';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception.code === 'LIMIT_FILE_SIZE') {
      response.status(HttpStatus.BAD_REQUEST).json({
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File exceeds the maximum size of ${MAX_UPLOAD_BYTES} bytes.`,
        },
      });
      return;
    }

    response.status(HttpStatus.BAD_REQUEST).json({
      error: {
        code: 'UPLOAD_INVALID',
        message: 'The uploaded file could not be accepted.',
      },
    });
  }
}
