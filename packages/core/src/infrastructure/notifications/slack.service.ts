import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALLOWED_SLACK_WEBHOOK_HOSTS = new Set([
  'hooks.slack.com',
  'hooks.slack-gov.com',
]);
const SLACK_WEBHOOK_TIMEOUT_MS = 5000;

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly webhookUrl?: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookUrl = this.configService.get<string>('SLACK_WEBHOOK_URL');
    this.validateWebhookUrl(this.webhookUrl);
  }

  async sendMessage(text: string) {
    if (!this.webhookUrl) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      SLACK_WEBHOOK_TIMEOUT_MS,
    );

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const responseText = await response.text();
        this.logger.error(
          `Slack notification failed with status ${response.status}`,
          responseText.slice(0, 500),
        );
      }
    } catch (error: unknown) {
      this.logger.error('Slack notification failed', error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private validateWebhookUrl(webhookUrl?: string): void {
    if (!webhookUrl) {
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(webhookUrl);
    } catch {
      throw new Error('Invalid SLACK_WEBHOOK_URL: must be a valid URL.');
    }

    if (parsed.protocol !== 'https:') {
      throw new Error('Invalid SLACK_WEBHOOK_URL: only HTTPS is allowed.');
    }

    if (!ALLOWED_SLACK_WEBHOOK_HOSTS.has(parsed.hostname)) {
      throw new Error(
        `Invalid SLACK_WEBHOOK_URL host: ${parsed.hostname}. Allowed hosts: ${Array.from(ALLOWED_SLACK_WEBHOOK_HOSTS).join(', ')}`,
      );
    }
  }
}
