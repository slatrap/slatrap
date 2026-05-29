const ALLOWED_SLACK_WEBHOOK_HOSTS = new Set([
  'hooks.slack.com',
  'hooks.slack-gov.com',
]);

export function validateSlackWebhookUrl(webhookUrl?: string): void {
  if (!webhookUrl) {
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(webhookUrl);
  } catch {
    throw new Error('Invalid slackWebhookUrl: must be a valid URL.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Invalid slackWebhookUrl: only HTTPS is allowed.');
  }

  if (!ALLOWED_SLACK_WEBHOOK_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `Invalid slackWebhookUrl host: ${parsed.hostname}. Allowed hosts: ${Array.from(ALLOWED_SLACK_WEBHOOK_HOSTS).join(', ')}`,
    );
  }
}
