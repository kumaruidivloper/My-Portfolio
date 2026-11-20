import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { ApiEncryptionService } from './api-encryption.service';
import { ProtectedDestination } from './dashboard-access.guard';
import { ACCESS_DETAILS_URL, PF_DATA_API_URL } from './api-resource-urls';

@Injectable({ providedIn: 'root' })
export class ApiKeyValidationService {
  private readonly http: HttpClient;

  constructor(backend: HttpBackend) {
    this.http = new HttpClient(backend);
  }

  async verify(passphrase: string, target: ProtectedDestination): Promise<void> {
    const url = target === 'dashboard' ? `${PF_DATA_API_URL}/2` : ACCESS_DETAILS_URL;
    const response = await firstValueFrom(this.http.get<unknown>(url).pipe(timeout(15_000)));
    const candidate = new ApiEncryptionService();
    candidate.setPassphrase(passphrase);
    try {
      const unwrapped = await candidate.decryptIfEncrypted(response);
      await candidate.decryptFields(unwrapped);
      if (unwrapped === response && !candidate.hasVerifiedEncryptedField) {
        throw new Error('No encrypted data is available to verify the encryption key.');
      }
    } finally {
      candidate.clearPassphrase();
    }
  }
}
