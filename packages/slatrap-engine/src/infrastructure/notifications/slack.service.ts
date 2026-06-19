import { Inject, Injectable, Logger } from '@nestjs/common';
import { INSPECTOR_CORE_OPTIONS } from '../../config/inspector-core.constants';
import { type InspectorCoreModuleOptions } from '../../config/inspector-core.options';
import { validateSlackWebhookUrl } from '../../config/validate-slack-webhook-url';

const SLACK_WEBHOOK_TIMEOUT_MS = 5000;

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly webhookUrl?: string;

  constructor(
    @Inject(INSPECTOR_CORE_OPTIONS)
    options: InspectorCoreModuleOptions,
  ) {
    this.webhookUrl = options.slackWebhookUrl;

    validateSlackWebhookUrl(this.webhookUrl);
  }

  get isEnabled(): boolean {
    return Boolean(this.webhookUrl);
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
}
