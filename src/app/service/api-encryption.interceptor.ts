import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { defer, from, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ApiEncryptionService } from './api-encryption.service';

function isEncryptedApiUrl(url: string): boolean {
  const parsedUrl = new URL(url, globalThis.location?.origin ?? 'http://localhost');
  return parsedUrl.hostname.endsWith('.mockapi.io')
    || parsedUrl.href === new URL(environment.baseUrl).href;
}

function isMockApiUrl(url: string): boolean {
  return new URL(url, globalThis.location?.origin ?? 'http://localhost').hostname
    === '64b76091df0839c97e168d79.mockapi.io';
}

@Injectable()
export class ApiEncryptionInterceptor implements HttpInterceptor {
  constructor(private readonly encryption: ApiEncryptionService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!isEncryptedApiUrl(request.url)) {
      return next.handle(request);
    }

    return defer(() => {
      const encryptedRequest = request.body === null || request.method === 'GET' || request.method === 'HEAD'
        ? of(request)
        : from(isMockApiUrl(request.url)
          ? this.encryption.encryptFields(request.body)
          : this.encryption.encrypt(request.body)).pipe(
          map((body) => request.clone({ body }))
        );

      return encryptedRequest.pipe(
        switchMap((preparedRequest) => next.handle(preparedRequest)),
        switchMap((event) => {
          if (!(event instanceof HttpResponse)) {
            return of(event);
          }
          const decrypted = isMockApiUrl(request.url)
            ? this.encryption.decryptIfEncrypted(event.body).then((body) => this.encryption.decryptFields(body))
            : this.encryption.decryptIfEncrypted(event.body);
          return from(decrypted).pipe(
            map((body) => event.clone({ body }))
          );
        })
      );
    });
  }
}
