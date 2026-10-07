import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MulterExceptionFilter } from './common/multer-exception.filter';
import { assertProductionConfig, resolveCorsOrigin } from './config/env';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  assertProductionConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Authenticated JSON APIs should never be HTTP-cached. Express ETags otherwise
  // make Android OkHttp revalidate GETs as 304 Not Modified.
  app.set('etag', false);
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'private, no-store');
    next();
  });

  app.enableCors({
    origin: (origin, callback) => {
      const allowed = resolveCorsOrigin(origin);
      if (allowed === false) {
        callback(new Error('Not allowed by CORS'), false);
        return;
      }
      callback(null, allowed);
    },
    credentials: true,
  });
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });
  app.useGlobalFilters(new MulterExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
