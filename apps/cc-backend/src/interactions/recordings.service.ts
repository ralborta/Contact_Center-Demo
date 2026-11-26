import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync, mkdirSync, promises as fs } from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

const RETRY_DELAYS_MS = [0, 5_000, 15_000, 30_000, 60_000, 120_000, 180_000];

export type RecordingBackfillResult = {
  scanned: number;
  saved: number;
  skipped: number;
  failed: number;
  details: Array<{
    interactionId: string;
    conversationId: string;
    status: 'saved' | 'skipped' | 'failed';
    reason?: string;
  }>;
};

@Injectable()
export class RecordingsService {
  private readonly logger = new Logger(RecordingsService.name);
  private readonly dir: string;
  private readonly inFlight = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.dir =
      this.config.get<string>('RECORDINGS_DIR')?.trim() ||
      '/data/recordings';
    try {
      mkdirSync(this.dir, { recursive: true });
    } catch (err) {
      this.logger.warn(`No se pudo crear ${this.dir}: ${(err as Error).message}`);
    }
  }

  publicUrlFor(interactionId: string): string {
    return `/api/interactions/${interactionId}/recording`;
  }

  filePathFor(conversationId: string): string {
    const safe = String(conversationId).replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.dir, `${safe}.mp3`);
  }

  hasLocalFile(conversationId: string): boolean {
    return existsSync(this.filePathFor(conversationId));
  }

  /**
   * Descarga el audio de ElevenLabs y lo persiste en disco.
   * Idempotente: si ya hay archivo + recordingUrl, no vuelve a bajar.
   */
  async ensureRecording(params: {
    interactionId: string;
    conversationId: string;
    force?: boolean;
  }): Promise<{ ok: boolean; recordingUrl?: string; reason?: string }> {
    const { interactionId, conversationId, force } = params;
    if (!conversationId || !conversationId.startsWith('conv_')) {
      return { ok: false, reason: 'conversationId inválido' };
    }

    const detail = await this.prisma.callDetail.findUnique({
      where: { interactionId },
    });
    if (!detail) return { ok: false, reason: 'sin callDetail' };

    const filePath = this.filePathFor(conversationId);
    const publicUrl = this.publicUrlFor(interactionId);

    if (!force && existsSync(filePath) && detail.recordingUrl === publicUrl) {
      return { ok: true, recordingUrl: publicUrl, reason: 'ya_existia' };
    }

    if (!force && existsSync(filePath)) {
      await this.prisma.callDetail.update({
        where: { interactionId },
        data: { recordingUrl: publicUrl },
      });
      return { ok: true, recordingUrl: publicUrl, reason: 'archivo_local' };
    }

    const apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    if (!apiKey) {
      return { ok: false, reason: 'ELEVENLABS_API_KEY ausente' };
    }

    const url = `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}/audio`;
    let lastStatus = 0;
    let lastErr = '';

    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
      const wait = RETRY_DELAYS_MS[attempt];
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));

      try {
        const res = await fetch(url, {
          headers: { 'xi-api-key': apiKey },
        });
        lastStatus = res.status;
        if (res.status === 404 || res.status === 202 || res.status === 425) {
          lastErr = `HTTP ${res.status}`;
          // Aún no listo o no existe — seguir reintentando
          this.logger.debug(
            `Audio ${conversationId} intento ${attempt + 1}: ${res.status}`,
          );
          continue;
        }
        if (!res.ok) {
          lastErr = `HTTP ${res.status}`;
          const body = await res.text().catch(() => '');
          this.logger.warn(
            `Audio ${conversationId} falló ${res.status}: ${body.slice(0, 200)}`,
          );
          // 401/403 no mejoran con retry
          if (res.status === 401 || res.status === 403) break;
          continue;
        }

        const buf = Buffer.from(await res.arrayBuffer());
        if (!buf.length) {
          lastErr = 'audio vacío';
          continue;
        }

        mkdirSync(this.dir, { recursive: true });
        const tmp = `${filePath}.tmp`;
        await fs.writeFile(tmp, buf);
        await fs.rename(tmp, filePath);

        await this.prisma.callDetail.update({
          where: { interactionId },
          data: { recordingUrl: publicUrl },
        });

        this.logger.log(
          `Grabación guardada ${conversationId} → ${filePath} (${buf.length} bytes)`,
        );
        return { ok: true, recordingUrl: publicUrl };
      } catch (err) {
        lastErr = (err as Error).message;
        this.logger.warn(
          `Audio ${conversationId} error intento ${attempt + 1}: ${lastErr}`,
        );
      }
    }

    return {
      ok: false,
      reason: lastErr || `no_disponible status=${lastStatus}`,
    };
  }

  /** Lanza la descarga en background (post-call). No bloquea la respuesta. */
  scheduleFetch(interactionId: string, conversationId: string) {
    if (!conversationId?.startsWith('conv_')) return;
    const key = `${interactionId}:${conversationId}`;
    if (this.inFlight.has(key)) return;
    this.inFlight.add(key);
    setImmediate(() => {
      this.ensureRecording({ interactionId, conversationId })
        .then((r) => {
          if (!r.ok) {
            this.logger.warn(
              `No se pudo guardar audio ${conversationId}: ${r.reason}`,
            );
          }
        })
        .catch((err) =>
          this.logger.error(
            `scheduleFetch ${conversationId}: ${(err as Error).message}`,
          ),
        )
        .finally(() => this.inFlight.delete(key));
    });
  }

  async backfill(limit = 200): Promise<RecordingBackfillResult> {
    const rows = await this.prisma.callDetail.findMany({
      where: {
        externalCallId: { startsWith: 'conv_' },
        OR: [{ recordingUrl: null }, { recordingUrl: '' }],
      },
      take: Math.min(Math.max(limit, 1), 500),
      orderBy: { createdAt: 'desc' },
      select: {
        interactionId: true,
        externalCallId: true,
        recordingUrl: true,
      },
    });

    // También incluir las que tienen URL externa rota / no local
    const withUrlButMissingFile = await this.prisma.callDetail.findMany({
      where: {
        externalCallId: { startsWith: 'conv_' },
        recordingUrl: { not: null },
        NOT: { recordingUrl: { startsWith: '/api/interactions/' } },
      },
      take: Math.min(Math.max(limit, 1), 500),
      orderBy: { createdAt: 'desc' },
      select: {
        interactionId: true,
        externalCallId: true,
        recordingUrl: true,
      },
    });

    const seen = new Set<string>();
    const queue = [...rows, ...withUrlButMissingFile].filter((r) => {
      if (!r.externalCallId || seen.has(r.interactionId)) return false;
      seen.add(r.interactionId);
      return true;
    });

    const result: RecordingBackfillResult = {
      scanned: queue.length,
      saved: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };

    for (const row of queue) {
      const conversationId = row.externalCallId!;

      // Si el archivo ya está en disco, solo apuntar la URL
      if (this.hasLocalFile(conversationId)) {
        const publicUrl = this.publicUrlFor(row.interactionId);
        await this.prisma.callDetail.update({
          where: { interactionId: row.interactionId },
          data: { recordingUrl: publicUrl },
        });
        result.saved += 1;
        result.details.push({
          interactionId: row.interactionId,
          conversationId,
          status: 'saved',
          reason: 'archivo_local',
        });
        continue;
      }

      // Backfill: pocos intentos cortos (las llamadas viejas ya deberían tener audio listo)
      let saved = false;
      let lastReason = '';
      for (let i = 0; i < 3; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 2_000 * i));
        const single = await this.fetchOnce(conversationId);
        if (single.ok && single.buf) {
          const filePath = this.filePathFor(conversationId);
          mkdirSync(this.dir, { recursive: true });
          const tmp = `${filePath}.tmp`;
          await fs.writeFile(tmp, single.buf);
          await fs.rename(tmp, filePath);
          const publicUrl = this.publicUrlFor(row.interactionId);
          await this.prisma.callDetail.update({
            where: { interactionId: row.interactionId },
            data: { recordingUrl: publicUrl },
          });
          result.saved += 1;
          result.details.push({
            interactionId: row.interactionId,
            conversationId,
            status: 'saved',
          });
          saved = true;
          break;
        }
        lastReason = single.reason || 'desconocido';
      }

      if (saved) continue;

      if (/404|not found|vacío/i.test(lastReason)) {
        result.skipped += 1;
        result.details.push({
          interactionId: row.interactionId,
          conversationId,
          status: 'skipped',
          reason: lastReason,
        });
        this.logger.warn(`Backfill skip ${conversationId}: ${lastReason}`);
      } else {
        result.failed += 1;
        result.details.push({
          interactionId: row.interactionId,
          conversationId,
          status: 'failed',
          reason: lastReason,
        });
        this.logger.warn(`Backfill fail ${conversationId}: ${lastReason}`);
      }
    }

    return result;
  }

  private async fetchOnce(
    conversationId: string,
  ): Promise<{ ok: boolean; buf?: Buffer; reason?: string }> {
    const apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    if (!apiKey) return { ok: false, reason: 'ELEVENLABS_API_KEY ausente' };
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}/audio`,
        { headers: { 'xi-api-key': apiKey } },
      );
      if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) return { ok: false, reason: 'audio vacío' };
      return { ok: true, buf };
    } catch (err) {
      return { ok: false, reason: (err as Error).message };
    }
  }

  async openRecordingStream(interactionId: string): Promise<{
    stream: ReturnType<typeof createReadStream>;
    size: number;
    contentType: string;
    filePath: string;
  }> {
    const detail = await this.prisma.callDetail.findUnique({
      where: { interactionId },
    });
    if (!detail?.externalCallId) {
      throw new NotFoundException('Grabación no disponible');
    }
    const filePath = this.filePathFor(detail.externalCallId);
    if (!existsSync(filePath)) {
      // Intento puntual antes de fallar
      const got = await this.ensureRecording({
        interactionId,
        conversationId: detail.externalCallId,
      });
      if (!got.ok || !existsSync(filePath)) {
        throw new NotFoundException('Grabación no disponible');
      }
    }
    const stat = await fs.stat(filePath);
    if (!stat.size) {
      throw new ServiceUnavailableException('Grabación vacía');
    }
    return {
      stream: createReadStream(filePath),
      size: stat.size,
      contentType: 'audio/mpeg',
      filePath,
    };
  }
}
